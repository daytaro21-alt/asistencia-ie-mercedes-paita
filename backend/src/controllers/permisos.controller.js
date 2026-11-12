// src/controllers/permisos.controller.js
const pool = require('../config/db');
const { enviarAlertaSalidaWhatsApp } = require('../utils/whatsappService');

const obtenerFechaHoraPeru = () => {
    const ahora = new Date();
    const fechaSQL = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Lima',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(ahora);
    const horaSQL = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Lima',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(ahora);
    return { fechaSQL, horaSQL };
};

/**
 * GET /api/permisos/buscar/:dni
 * Busca los datos del estudiante al escanear su carnet QR antes de elegir el motivo de salida.
 */
const buscarEstudiantePorQrPermiso = async (req, res) => {
    const dni = String(req.params.dni || '').trim();
    if (!/^\d{8}$/.test(dni)) {
        return res.status(400).json({ error: 'DNI inválido. El código QR debe tener 8 dígitos.' });
    }

    try {
        const [estudiantes] = await pool.query(
            `SELECT id_estudiante, dni, nombres, apellidos, grado, seccion, telefono_apoderado,
                    COALESCE(estado_matricula, 'DEFINITIVA') AS estado_matricula
             FROM Estudiante WHERE dni = ?`,
            [dni]
        );

        if (estudiantes.length === 0) {
            return res.status(404).json({ error: 'Estudiante no encontrado en el padrón de 5to de Secundaria.' });
        }

        const est = estudiantes[0];
        if (est.estado_matricula !== 'DEFINITIVA') {
            return res.status(403).json({ error: `El estudiante figura dado de baja (${est.estado_matricula}).` });
        }

        const { fechaSQL } = obtenerFechaHoraPeru();
        const [permisosHoy] = await pool.query(
            `SELECT id_permiso, hora_salida, motivo, detalle, autorizado_por
             FROM PermisoSalida
             WHERE estudiante_id = ? AND fecha = ?
             ORDER BY hora_salida DESC`,
            [est.id_estudiante, fechaSQL]
        );

        return res.status(200).json({
            estudiante: est,
            permisosHoy
        });
    } catch (error) {
        console.error('❌ Error al buscar estudiante para permiso:', error);
        return res.status(500).json({ error: 'Error interno al consultar los datos del estudiante.' });
    }
};

/**
 * POST /api/permisos
 * Registra un nuevo permiso de salida en la tabla independiente PermisoSalida.
 */
const registrarPermisoSalida = async (req, res) => {
    const { dni, motivo, detalle, notificarWhatsApp } = req.body || {};

    if (!dni || !/^\d{8}$/.test(String(dni).trim())) {
        return res.status(400).json({ error: 'DNI inválido.' });
    }
    if (!motivo || !String(motivo).trim()) {
        return res.status(400).json({ error: 'Debes seleccionar o indicar el motivo de salida.' });
    }

    try {
        const [estudiantes] = await pool.query(
            `SELECT id_estudiante, dni, nombres, apellidos, grado, seccion, telefono_apoderado,
                    COALESCE(estado_matricula, 'DEFINITIVA') AS estado_matricula
             FROM Estudiante WHERE dni = ?`,
            [String(dni).trim()]
        );

        if (estudiantes.length === 0) {
            return res.status(404).json({ error: 'Estudiante no encontrado en el padrón.' });
        }

        const est = estudiantes[0];
        if (est.estado_matricula !== 'DEFINITIVA') {
            return res.status(403).json({ error: `Estudiante dado de baja (${est.estado_matricula}).` });
        }

        const { fechaSQL, horaSQL } = obtenerFechaHoraPeru();
        const motivoLimpio = String(motivo).trim().slice(0, 100);
        const detalleLimpio = detalle ? String(detalle).trim().slice(0, 255) : null;
        const autorizadoPor = req.usuario?.username || 'auxiliar';

        const [resultado] = await pool.query(
            `INSERT INTO PermisoSalida (estudiante_id, fecha, hora_salida, motivo, detalle, autorizado_por)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [est.id_estudiante, fechaSQL, horaSQL, motivoLimpio, detalleLimpio, autorizadoPor]
        );

        let whatsappEncolado = false;
        if (notificarWhatsApp && est.telefono_apoderado) {
            whatsappEncolado = enviarAlertaSalidaWhatsApp(
                est.telefono_apoderado,
                `${est.nombres} ${est.apellidos}`,
                horaSQL,
                motivoLimpio,
                fechaSQL,
                detalleLimpio
            );
        }

        console.log(`🚪 [Permiso de Salida] ${est.apellidos}, ${est.nombres} (5to "${est.seccion}") | Motivo: ${motivoLimpio} | Autorizado por: ${autorizadoPor}`);

        return res.status(201).json({
            mensaje: 'Permiso de salida registrado correctamente.',
            whatsappEncolado,
            permiso: {
                id_permiso: resultado.insertId,
                dni: est.dni,
                nombres: est.nombres,
                apellidos: est.apellidos,
                grado: est.grado,
                seccion: est.seccion,
                fecha: fechaSQL,
                hora_salida: horaSQL,
                motivo: motivoLimpio,
                detalle: detalleLimpio,
                autorizado_por: autorizadoPor
            }
        });
    } catch (error) {
        console.error('❌ Error al registrar permiso de salida:', error);
        return res.status(500).json({ error: 'Error interno al guardar el permiso de salida.' });
    }
};

/**
 * GET /api/permisos?fecha=YYYY-MM-DD&seccion=A
 * Lista los permisos de salida emitidos (tabla independiente de la asistencia).
 */
const listarPermisosSalida = async (req, res) => {
    try {
        const { fechaSQL } = obtenerFechaHoraPeru();
        const fechaConsulta = req.query.fecha || fechaSQL;
        const seccionFiltro = req.query.seccion ? String(req.query.seccion).trim().toUpperCase() : null;

        let sql = `
            SELECT p.id_permiso, p.fecha, p.hora_salida, p.motivo, p.detalle, p.autorizado_por,
                   COALESCE(p.verificado_porteria, 0) AS verificado_porteria, p.hora_verificacion,
                   e.dni, e.nombres, e.apellidos, e.grado, e.seccion
            FROM PermisoSalida p
            INNER JOIN Estudiante e ON p.estudiante_id = e.id_estudiante
            WHERE p.fecha = ?
        `;
        const params = [fechaConsulta];

        if (seccionFiltro) {
            sql += ' AND e.seccion = ?';
            params.push(seccionFiltro);
        }

        sql += ' ORDER BY p.hora_salida DESC, p.id_permiso DESC';

        const [permisos] = await pool.query(sql, params);
        return res.status(200).json({
            fecha: fechaConsulta,
            seccion: seccionFiltro || 'TODAS',
            total: permisos.length,
            permisos
        });
    } catch (error) {
        console.error('❌ Error al listar permisos de salida:', error);
        return res.status(500).json({ error: 'Error al consultar la tabla de permisos de salida.' });
    }
};

/**
 * DELETE /api/permisos/:id
 * Anula/elimina un permiso de salida registrado por error.
 */
const eliminarPermisoSalida = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!id) {
            return res.status(400).json({ error: 'ID de permiso inválido.' });
        }

        const [resDel] = await pool.query('DELETE FROM PermisoSalida WHERE id_permiso = ?', [id]);
        if (resDel.affectedRows === 0) {
            return res.status(404).json({ error: 'Permiso no encontrado.' });
        }

        console.log(`🗑️ [Permiso Anulado] ID ${id} eliminado por ${req.usuario?.username}`);
        return res.status(200).json({ mensaje: 'Permiso de salida anulado correctamente.' });
    } catch (error) {
        console.error('❌ Error al anular permiso de salida:', error);
        return res.status(500).json({ error: 'Error interno al anular el permiso.' });
    }
};

/**
 * POST /api/permisos/verificar-porteria
 * Escaneo rápido del Portero en puerta para comprobar si el estudiante tiene permiso de salida hoy.
 */
const verificarPermisoPorteria = async (req, res) => {
    const dni = String(req.body?.dni || '').trim();
    if (!/^\d{8}$/.test(dni)) {
        return res.status(400).json({ error: 'DNI inválido. El código QR debe tener 8 dígitos.' });
    }

    try {
        const [estudiantes] = await pool.query(
            `SELECT id_estudiante, dni, nombres, apellidos, grado, seccion,
                    COALESCE(estado_matricula, 'DEFINITIVA') AS estado_matricula
             FROM Estudiante WHERE dni = ?`,
            [dni]
        );

        if (estudiantes.length === 0) {
            return res.status(404).json({
                tienePermiso: false,
                error: 'Estudiante no encontrado en el padrón de 5to de Secundaria.'
            });
        }

        const est = estudiantes[0];
        const nombreCompleto = `${est.apellidos}, ${est.nombres}`;

        if (est.estado_matricula !== 'DEFINITIVA') {
            return res.status(403).json({
                tienePermiso: false,
                alumno: nombreCompleto,
                dni: est.dni,
                seccion: est.seccion,
                error: `Estudiante dado de baja (${est.estado_matricula}).`
            });
        }

        const { fechaSQL, horaSQL } = obtenerFechaHoraPeru();

        const [permisos] = await pool.query(
            `SELECT id_permiso, hora_salida, motivo, detalle, autorizado_por,
                    COALESCE(verificado_porteria, 0) AS verificado_porteria, hora_verificacion
             FROM PermisoSalida
             WHERE estudiante_id = ? AND fecha = ?
             ORDER BY id_permiso DESC`,
            [est.id_estudiante, fechaSQL]
        );

        if (permisos.length === 0) {
            return res.status(404).json({
                tienePermiso: false,
                alumno: nombreCompleto,
                dni: est.dni,
                grado: est.grado,
                seccion: est.seccion,
                fecha: fechaSQL,
                hora_consulta: horaSQL,
                error: 'NO TIENE PERMISO DE SALIDA AUTORIZADO HOY.'
            });
        }

        // Busca el permiso pendiente más reciente; si todos ya fueron usados, toma el último
        const permisoPendiente = permisos.find(p => !p.verificado_porteria);

        if (!permisoPendiente) {
            const ultimo = permisos[0];
            return res.status(409).json({
                tienePermiso: true,
                yaUsado: true,
                alumno: nombreCompleto,
                dni: est.dni,
                grado: est.grado,
                seccion: est.seccion,
                motivo: ultimo.motivo,
                detalle: ultimo.detalle,
                autorizado_por: ultimo.autorizado_por,
                hora_autorizacion: ultimo.hora_salida,
                hora_verificacion: ultimo.hora_verificacion,
                error: `ESTE PERMISO YA FUE USADO EN PORTERÍA A LAS ${ultimo.hora_verificacion}.`
            });
        }

        // Marcar salida verificada en portería
        await pool.query(
            'UPDATE PermisoSalida SET verificado_porteria = 1, hora_verificacion = ? WHERE id_permiso = ?',
            [horaSQL, permisoPendiente.id_permiso]
        );

        console.log(`🛡️ [Portería] Salida verificada: ${nombreCompleto} (5to "${est.seccion}") | Motivo: ${permisoPendiente.motivo} | Hora: ${horaSQL}`);

        return res.status(200).json({
            tienePermiso: true,
            yaUsado: false,
            mensaje: 'SALIDA AUTORIZADA',
            alumno: nombreCompleto,
            dni: est.dni,
            grado: est.grado,
            seccion: est.seccion,
            fecha: fechaSQL,
            motivo: permisoPendiente.motivo,
            detalle: permisoPendiente.detalle,
            autorizado_por: permisoPendiente.autorizado_por,
            hora_autorizacion: permisoPendiente.hora_salida,
            hora_verificacion: horaSQL
        });
    } catch (error) {
        console.error('❌ Error en verificación de portería:', error);
        return res.status(500).json({ error: 'Error interno al verificar permiso en portería.' });
    }
};

module.exports = {
    buscarEstudiantePorQrPermiso,
    registrarPermisoSalida,
    listarPermisosSalida,
    eliminarPermisoSalida,
    verificarPermisoPorteria
};
