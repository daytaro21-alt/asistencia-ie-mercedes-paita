// src/controllers/asistencia.controller.js
const pool = require('../config/db');
const { enviarAlertaWhatsApp } = require('../utils/whatsappService');
const {
    extraerEstudiantesDeBufferExcel,
    normalizarSeccion,
    normalizarGrado,
    normalizarEstadoMatricula
} = require('../utils/excelParser');

// Formateador determinista fijado a la zona horaria de Perú
const obtenerFechaHoraPeru = () => {
    const ahora = new Date();
    const opcionesFecha = { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' };
    const opcionesHora = { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };

    const fechaSQL = new Intl.DateTimeFormat('sv-SE', opcionesFecha).format(ahora);
    const horaSQL = new Intl.DateTimeFormat('sv-SE', opcionesHora).format(ahora);

    return { fechaSQL, horaSQL };
};

/**
 * POST /api/registrar-asistencia
 * Escaneo QR en portón
 */
const registrarAsistenciaQR = async (req, res) => {
    const { dni } = req.body;

    if (!dni || !/^\d{8}$/.test(dni.trim())) {
        return res.status(400).json({ error: 'DNI inválido o no proporcionado por el escáner.' });
    }

    try {
        const [estudiantes] = await pool.query(
            `SELECT id_estudiante, dni, nombres, apellidos, grado, seccion, telefono_apoderado,
                    COALESCE(estado_matricula, 'DEFINITIVA') AS estado_matricula,
                    hora_limite_puntual
             FROM Estudiante WHERE dni = ?`,
            [dni.trim()]
        );

        if (estudiantes.length === 0) {
            return res.status(404).json({ error: 'Estudiante no encontrado en el padrón de 5to de Secundaria.' });
        }

        const estudiante = estudiantes[0];

        if (estudiante.estado_matricula !== 'DEFINITIVA') {
            return res.status(403).json({
                error: `Estudiante dado de baja (${estudiante.estado_matricula}). No figura en el padrón activo.`,
                alumno: `${estudiante.nombres} ${estudiante.apellidos}`,
                grado: estudiante.grado,
                seccion: estudiante.seccion
            });
        }

        const { fechaSQL, horaSQL } = obtenerFechaHoraPeru();

        // Si el estudiante tiene permiso especial por trabajo (ej. '13:00:00'), se respeta su hora límite
        const horaLimitePuntual = estudiante.hora_limite_puntual || process.env.HORA_LIMITE_PUNTUAL || '12:45:00';
        const horaCierrePorton = process.env.HORA_CIERRE_PORTON || '13:30:00';

        if (process.env.BLOQUEAR_DESPUES_CIERRE === 'true' && horaSQL > horaCierrePorton) {
            return res.status(403).json({
                error: `El portón cerró a las ${horaCierrePorton}. El estudiante debe pasar por oficina de TOECE.`,
                alumno: `${estudiante.nombres} ${estudiante.apellidos}`,
                grado: estudiante.grado,
                seccion: estudiante.seccion,
                hora: horaSQL
            });
        }

        const estadoAsistencia = horaSQL > horaLimitePuntual ? 'Tardanza' : 'Puntual';

        try {
            await pool.query(
                'INSERT INTO Asistencia (estudiante_id, fecha, hora_ingreso, estado) VALUES (?, ?, ?, ?)',
                [estudiante.id_estudiante, fechaSQL, horaSQL, estadoAsistencia]
            );
        } catch (dbError) {
            if (dbError.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({
                    error: 'El estudiante ya tiene un registro de asistencia el día de hoy.',
                    alumno: `${estudiante.nombres} ${estudiante.apellidos}`,
                    grado: estudiante.grado,
                    seccion: estudiante.seccion
                });
            }
            throw dbError;
        }

        if (estadoAsistencia === 'Tardanza' && estudiante.telefono_apoderado) {
            enviarAlertaWhatsApp(
                estudiante.telefono_apoderado,
                `${estudiante.nombres} ${estudiante.apellidos}`,
                horaSQL,
                estadoAsistencia,
                fechaSQL
            );
        }

        return res.status(200).json({
            mensaje: 'Asistencia registrada correctamente.',
            alumno: `${estudiante.nombres} ${estudiante.apellidos}`,
            dni: estudiante.dni,
            grado: estudiante.grado,
            seccion: estudiante.seccion,
            fecha: fechaSQL,
            hora: horaSQL,
            estado: estadoAsistencia,
            hora_limite_puntual: estudiante.hora_limite_puntual || null
        });

    } catch (error) {
        console.error('❌ Error en el registro de asistencia:', error);
        return res.status(500).json({ error: 'Error interno del servidor al procesar la asistencia.' });
    }
};

/**
 * Proceso de Cierre de Portón (13:30:00):
 * Busca a todos los alumnos ACTIVOS de 5to que NO registraron entrada hoy, les inserta 'Falta'
 */
const ejecutarCierrePorton = async (fechaObjetivo = null) => {
    const { fechaSQL, horaSQL } = obtenerFechaHoraPeru();
    const fechaCierre = fechaObjetivo || fechaSQL;
    const horaCierre = process.env.HORA_CIERRE_PORTON || '13:30:00';

    const [ausentes] = await pool.query(
        `SELECT e.id_estudiante, e.dni, e.nombres, e.apellidos, e.grado, e.seccion, e.telefono_apoderado
         FROM Estudiante e
         LEFT JOIN Asistencia a ON e.id_estudiante = a.estudiante_id AND a.fecha = ?
         WHERE a.id_asistencia IS NULL
           AND COALESCE(e.estado_matricula, 'DEFINITIVA') = 'DEFINITIVA'`,
        [fechaCierre]
    );

    if (ausentes.length === 0) {
        return { fecha: fechaCierre, faltasRegistradas: 0, alertasEncoladas: 0 };
    }

    const valoresFaltas = ausentes.map(est => [
        est.id_estudiante,
        fechaCierre,
        horaCierre,
        'Falta'
    ]);

    await pool.query(
        'INSERT IGNORE INTO Asistencia (estudiante_id, fecha, hora_ingreso, estado) VALUES ?',
        [valoresFaltas]
    );

    let alertasEncoladas = 0;
    for (const est of ausentes) {
        if (est.telefono_apoderado) {
            alertasEncoladas++;
            setImmediate(() => {
                enviarAlertaWhatsApp(
                    est.telefono_apoderado,
                    `${est.nombres} ${est.apellidos}`,
                    null,
                    'Falta',
                    fechaCierre
                );
            });
        }
    }

    console.log(`🔒 [Cierre de Portón ${fechaCierre}] Faltas procesadas: ${ausentes.length} | Alertas WhatsApp encoladas: ${alertasEncoladas}`);

    return {
        fecha: fechaCierre,
        horaEjecucion: horaSQL,
        faltasRegistradas: ausentes.length,
        alertasEncoladas
    };
};

/**
 * POST /api/asistencia/cerrar-porton (Protegido con JWT para TOECE y Administración)
 */
const cerrarPortonManual = async (req, res) => {
    try {
        const { fecha } = req.body || {};
        const resultado = await ejecutarCierrePorton(fecha);
        return res.status(200).json({
            mensaje: `Cierre de portón completado. Se registraron ${resultado.faltasRegistradas} faltas.`,
            ...resultado
        });
    } catch (error) {
        console.error('❌ Error al cerrar portón:', error);
        return res.status(500).json({ error: 'Error interno al procesar el cierre de portón.' });
    }
};

/**
 * GET /api/asistencia/resumen?fecha=YYYY-MM-DD&seccion=A
 * Para Auxiliares, TOECE y Administración
 */
const obtenerResumenDashboard = async (req, res) => {
    try {
        const { fechaSQL } = obtenerFechaHoraPeru();
        const fechaConsulta = req.query.fecha || fechaSQL;
        const seccionFiltro = req.query.seccion ? req.query.seccion.trim().toUpperCase() : null;

        // 1. Conteo total del padrón activo (DEFINITIVA) y bajas
        let sqlPadron = `
            SELECT
                SUM(CASE WHEN COALESCE(estado_matricula, 'DEFINITIVA') = 'DEFINITIVA' THEN 1 ELSE 0 END) AS activos,
                SUM(CASE WHEN COALESCE(estado_matricula, 'DEFINITIVA') != 'DEFINITIVA' THEN 1 ELSE 0 END) AS bajas
            FROM Estudiante
        `;
        const paramsPadron = [];
        if (seccionFiltro) {
            sqlPadron += ' WHERE seccion = ?';
            paramsPadron.push(seccionFiltro);
        }
        const [[conteoPadron]] = await pool.query(sqlPadron, paramsPadron);
        const totalEstudiantes = Number(conteoPadron?.activos || 0);
        const totalBajas = Number(conteoPadron?.bajas || 0);

        // 2. Conteo por estado en la fecha consultada (sobre estudiantes activos)
        let sqlEstados = `
            SELECT a.estado, COUNT(*) AS cantidad
            FROM Asistencia a
            INNER JOIN Estudiante e ON a.estudiante_id = e.id_estudiante
            WHERE a.fecha = ?
              AND COALESCE(e.estado_matricula, 'DEFINITIVA') = 'DEFINITIVA'
        `;
        const paramsEstados = [fechaConsulta];
        if (seccionFiltro) {
            sqlEstados += ' AND e.seccion = ?';
            paramsEstados.push(seccionFiltro);
        }
        sqlEstados += ' GROUP BY a.estado';
        const [conteos] = await pool.query(sqlEstados, paramsEstados);

        const metricas = {
            Puntual: 0,
            Tardanza: 0,
            'Tardanza Justificada': 0,
            Falta: 0,
            'Falta Justificada': 0
        };
        conteos.forEach(c => {
            if (metricas[c.estado] !== undefined) metricas[c.estado] = Number(c.cantidad);
        });

        const registrados = metricas.Puntual + metricas.Tardanza + metricas['Tardanza Justificada'] + metricas.Falta + metricas['Falta Justificada'];
        const sinRegistro = Math.max(0, totalEstudiantes - registrados);

        // 3. Listado completo del padrón activo cruzado con su asistencia del día
        let sqlPadronDia = `
            SELECT a.id_asistencia, e.id_estudiante, e.dni, e.nombres, e.apellidos, e.grado, e.seccion,
                   e.telefono_apoderado, e.hora_limite_puntual,
                   ? AS fecha,
                   COALESCE(a.hora_ingreso, '--:--:--') AS hora_ingreso,
                   COALESCE(a.estado, 'Sin Registro') AS estado,
                   a.observacion
            FROM Estudiante e
            LEFT JOIN Asistencia a ON e.id_estudiante = a.estudiante_id AND a.fecha = ?
            WHERE COALESCE(e.estado_matricula, 'DEFINITIVA') = 'DEFINITIVA'
        `;
        const paramsPadronDia = [fechaConsulta, fechaConsulta];
        if (seccionFiltro) {
            sqlPadronDia += ' AND e.seccion = ?';
            paramsPadronDia.push(seccionFiltro);
        }
        sqlPadronDia += `
            ORDER BY
                e.seccion ASC,
                e.apellidos ASC,
                e.nombres ASC
        `;
        const [padronDia] = await pool.query(sqlPadronDia, paramsPadronDia);
        const registros = padronDia.filter(r => r.estado !== 'Sin Registro');

        return res.status(200).json({
            fecha: fechaConsulta,
            seccion: seccionFiltro || 'TODAS',
            horario: {
                inicio: process.env.HORA_INICIO_INGRESO || '12:30:00',
                limitePuntual: process.env.HORA_LIMITE_PUNTUAL || '12:45:00',
                cierrePorton: process.env.HORA_CIERRE_PORTON || '13:30:00'
            },
            metricas: {
                totalPadron: totalEstudiantes,
                puntuales: metricas.Puntual,
                tardanzas: metricas.Tardanza,
                tardanzasJustificadas: metricas['Tardanza Justificada'],
                faltas: metricas.Falta,
                faltasJustificadas: metricas['Falta Justificada'],
                pendientes: sinRegistro,
                bajas: totalBajas
            },
            registros,
            padronDia
        });

    } catch (error) {
        console.error('❌ Error obteniendo resumen del dashboard:', error);
        return res.status(500).json({ error: 'Error al obtener el resumen de asistencia.' });
    }
};

/**
 * GET /api/estudiantes?seccion=A&busqueda=...&estado=DEFINITIVA|BAJA|TODOS
 */
const listarEstudiantes = async (req, res) => {
    try {
        const { seccion, busqueda, estado } = req.query;
        const filtroEstado = String(estado || 'DEFINITIVA').trim().toUpperCase();

        let sql = `
            SELECT id_estudiante, dni, nombres, apellidos, grado, seccion, telefono_apoderado,
                   COALESCE(estado_matricula, 'DEFINITIVA') AS estado_matricula,
                   hora_limite_puntual
            FROM Estudiante
            WHERE 1=1
        `;
        const params = [];

        if (filtroEstado === 'DEFINITIVA' || filtroEstado === 'ACTIVO') {
            sql += " AND COALESCE(estado_matricula, 'DEFINITIVA') = 'DEFINITIVA'";
        } else if (filtroEstado === 'BAJA' || filtroEstado === 'TRASLADADO' || filtroEstado === 'INACTIVO') {
            sql += " AND COALESCE(estado_matricula, 'DEFINITIVA') != 'DEFINITIVA'";
        }
        // Si filtroEstado === 'TODOS', no filtra por estado_matricula

        if (seccion) {
            sql += ' AND seccion = ?';
            params.push(seccion.trim().toUpperCase());
        }
        if (busqueda) {
            sql += ' AND (dni LIKE ? OR apellidos LIKE ? OR nombres LIKE ?)';
            const term = `%${busqueda.trim()}%`;
            params.push(term, term, term);
        }

        sql += ' ORDER BY seccion ASC, apellidos ASC, nombres ASC';
        const [estudiantes] = await pool.query(sql, params);

        const [[resumenGlobal]] = await pool.query(`
            SELECT
                SUM(CASE WHEN COALESCE(estado_matricula, 'DEFINITIVA') = 'DEFINITIVA' THEN 1 ELSE 0 END) AS totalActivos,
                SUM(CASE WHEN COALESCE(estado_matricula, 'DEFINITIVA') != 'DEFINITIVA' THEN 1 ELSE 0 END) AS totalBajas
            FROM Estudiante
        `);

        return res.status(200).json({
            total: estudiantes.length,
            totalActivos: Number(resumenGlobal?.totalActivos || 0),
            totalBajas: Number(resumenGlobal?.totalBajas || 0),
            estudiantes
        });
    } catch (error) {
        console.error('❌ Error listando estudiantes:', error);
        return res.status(500).json({ error: 'Error al listar estudiantes.' });
    }
};

/**
 * PUT /api/estudiantes/:dni/telefono (Actualiza el teléfono del apoderado)
 */
const actualizarTelefonoApoderado = async (req, res) => {
    const { dni } = req.params;
    const { telefono_apoderado } = req.body;

    const limpio = String(telefono_apoderado || '').replace(/\D/g, '');
    if (limpio && !/^(51)?9\d{8}$/.test(limpio)) {
        return res.status(400).json({ error: 'Número de celular inválido. Debe tener 9 dígitos y empezar con 9.' });
    }

    try {
        const [resultado] = await pool.query(
            'UPDATE Estudiante SET telefono_apoderado = ? WHERE dni = ?',
            [limpio || null, dni.trim()]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ error: 'Estudiante no encontrado.' });
        }

        return res.status(200).json({
            mensaje: 'Teléfono del apoderado actualizado correctamente.',
            dni: dni.trim(),
            telefono_apoderado: limpio || null
        });
    } catch (error) {
        console.error('❌ Error actualizando teléfono:', error);
        return res.status(500).json({ error: 'Error al actualizar el teléfono del apoderado.' });
    }
};

/**
 * POST /api/estudiantes (Administración: Agregar o reactivar un estudiante individual)
 */
const crearEstudiante = async (req, res) => {
    const { dni, nombres, apellidos, grado, seccion, telefono_apoderado, permiso_1pm } = req.body;

    const dniLimpio = String(dni || '').trim().replace(/\D/g, '');
    if (!/^\d{8}$/.test(dniLimpio)) {
        return res.status(400).json({ error: 'El DNI debe contener exactamente 8 dígitos numéricos.' });
    }

    const nombresLimpio = String(nombres || '').trim().toUpperCase();
    const apellidosLimpio = String(apellidos || '').trim().toUpperCase();
    if (!nombresLimpio || !apellidosLimpio) {
        return res.status(400).json({ error: 'Los apellidos y nombres del estudiante son obligatorios.' });
    }

    const gradoLimpio = normalizarGrado(grado || 'QUINTO');
    const seccionLimpia = normalizarSeccion(seccion || 'A', 'A');
    const telLimpio = String(telefono_apoderado || '').replace(/\D/g, '');
    if (telLimpio && !/^(51)?9\d{8}$/.test(telLimpio)) {
        return res.status(400).json({ error: 'El celular del apoderado debe tener 9 dígitos y empezar con 9.' });
    }

    const horaLimite = permiso_1pm ? '13:00:00' : null;

    try {
        const [existente] = await pool.query('SELECT id_estudiante, seccion, estado_matricula FROM Estudiante WHERE dni = ?', [dniLimpio]);

        await pool.query(
            `INSERT INTO Estudiante (dni, nombres, apellidos, grado, seccion, telefono_apoderado, estado_matricula, hora_limite_puntual)
             VALUES (?, ?, ?, ?, ?, ?, 'DEFINITIVA', ?)
             ON DUPLICATE KEY UPDATE
                nombres = VALUES(nombres),
                apellidos = VALUES(apellidos),
                grado = VALUES(grado),
                seccion = VALUES(seccion),
                telefono_apoderado = COALESCE(VALUES(telefono_apoderado), Estudiante.telefono_apoderado),
                estado_matricula = 'DEFINITIVA',
                hora_limite_puntual = COALESCE(VALUES(hora_limite_puntual), Estudiante.hora_limite_puntual)`,
            [dniLimpio, nombresLimpio, apellidosLimpio, gradoLimpio, seccionLimpia, telLimpio || null, horaLimite]
        );

        const accion = existente.length > 0 ? 'actualizado y activado' : 'registrado';
        return res.status(200).json({
            mensaje: `Estudiante ${apellidosLimpio}, ${nombresLimpio} (5to "${seccionLimpia}") ${accion} correctamente.`,
            estudiante: {
                dni: dniLimpio,
                nombres: nombresLimpio,
                apellidos: apellidosLimpio,
                grado: gradoLimpio,
                seccion: seccionLimpia,
                telefono_apoderado: telLimpio || null,
                estado_matricula: 'DEFINITIVA',
                hora_limite_puntual: horaLimite
            }
        });
    } catch (error) {
        console.error('❌ Error registrando estudiante:', error);
        return res.status(500).json({ error: 'Error al registrar al estudiante en la base de datos.' });
    }
};

/**
 * PUT /api/estudiantes/:dni/permiso (Activar o desactivar permiso de ingreso 1:00 PM por trabajo)
 */
const cambiarPermisoEstudiante = async (req, res) => {
    const { dni } = req.params;
    const { permiso_1pm } = req.body;

    const nuevaHoraLimite = permiso_1pm ? '13:00:00' : null;

    try {
        const [actual] = await pool.query(
            'SELECT id_estudiante, nombres, apellidos, seccion FROM Estudiante WHERE dni = ?',
            [dni.trim()]
        );

        if (actual.length === 0) {
            return res.status(404).json({ error: 'Estudiante no encontrado.' });
        }

        await pool.query(
            'UPDATE Estudiante SET hora_limite_puntual = ? WHERE dni = ?',
            [nuevaHoraLimite, dni.trim()]
        );

        // Si se le activa el permiso 1:00 PM y hoy registró ingreso hasta las 13:00:00 como Tardanza, actualizar a Puntual
        if (nuevaHoraLimite === '13:00:00') {
            const { fechaSQL } = obtenerFechaHoraPeru();
            await pool.query(
                `UPDATE Asistencia
                 SET estado = 'Puntual'
                 WHERE estudiante_id = ? AND fecha = ? AND hora_ingreso <= '13:00:00' AND estado = 'Tardanza'`,
                [actual[0].id_estudiante, fechaSQL]
            );
        }

        const msg = nuevaHoraLimite
            ? `Permiso de ingreso hasta la 1:00 PM ACTIVADO para ${actual[0].apellidos}, ${actual[0].nombres}.`
            : `Horario normal (12:45 PM) restaurado para ${actual[0].apellidos}, ${actual[0].nombres}.`;

        return res.status(200).json({
            mensaje: msg,
            dni: dni.trim(),
            hora_limite_puntual: nuevaHoraLimite
        });
    } catch (error) {
        console.error('❌ Error cambiando permiso 1pm:', error);
        return res.status(500).json({ error: 'Error al actualizar el permiso de horario del estudiante.' });
    }
};

/**
 * PUT /api/estudiantes/:dni/seccion (Administración: Cambiar o trasladar de sección A-H)
 */
const cambiarSeccionEstudiante = async (req, res) => {
    const { dni } = req.params;
    const { seccion, nombres, apellidos } = req.body;

    const seccionLimpia = normalizarSeccion(seccion, '');
    if (!seccionLimpia) {
        return res.status(400).json({ error: 'Debe indicar una sección válida (ej. A, B, C, D, E, F, G, H).' });
    }

    try {
        const [actual] = await pool.query(
            'SELECT nombres, apellidos, seccion FROM Estudiante WHERE dni = ?',
            [dni.trim()]
        );

        if (actual.length === 0) {
            return res.status(404).json({ error: 'Estudiante no encontrado.' });
        }

        const seccionAnterior = actual[0].seccion;
        const nuevosNombres = nombres ? String(nombres).trim().toUpperCase() : actual[0].nombres;
        const nuevosApellidos = apellidos ? String(apellidos).trim().toUpperCase() : actual[0].apellidos;

        await pool.query(
            'UPDATE Estudiante SET seccion = ?, nombres = ?, apellidos = ? WHERE dni = ?',
            [seccionLimpia, nuevosNombres, nuevosApellidos, dni.trim()]
        );

        return res.status(200).json({
            mensaje: `Estudiante trasladado de 5to "${seccionAnterior}" a 5to "${seccionLimpia}" correctamente.`,
            dni: dni.trim(),
            seccionAnterior,
            seccionNueva: seccionLimpia
        });
    } catch (error) {
        console.error('❌ Error cambiando sección:', error);
        return res.status(500).json({ error: 'Error al cambiar la sección del estudiante.' });
    }
};

/**
 * PUT /api/estudiantes/:dni/estado (Administración: Dar de baja por traslado/retiro o Reactivar)
 */
const cambiarEstadoEstudiante = async (req, res) => {
    const { dni } = req.params;
    const { estado_matricula } = req.body;

    const nuevoEstado = normalizarEstadoMatricula(estado_matricula);

    try {
        const [actual] = await pool.query(
            'SELECT id_estudiante, nombres, apellidos, seccion FROM Estudiante WHERE dni = ?',
            [dni.trim()]
        );

        if (actual.length === 0) {
            return res.status(404).json({ error: 'Estudiante no encontrado.' });
        }

        await pool.query(
            'UPDATE Estudiante SET estado_matricula = ? WHERE dni = ?',
            [nuevoEstado, dni.trim()]
        );

        const textoAccion = nuevoEstado === 'DEFINITIVA'
            ? 'reactivado en el padrón activo (DEFINITIVA)'
            : `dado de baja como ${nuevoEstado}`;

        return res.status(200).json({
            mensaje: `El estudiante ${actual[0].apellidos}, ${actual[0].nombres} fue ${textoAccion}.`,
            dni: dni.trim(),
            estado_matricula: nuevoEstado
        });
    } catch (error) {
        console.error('❌ Error cambiando estado de matrícula:', error);
        return res.status(500).json({ error: 'Error al actualizar el estado del estudiante.' });
    }
};

/**
 * POST /api/estudiantes/importar-excel
 * Recibe un archivo Excel SIAGIE o listado escolar en Base64 y sincroniza:
 * - Nuevos estudiantes -> los inserta activos
 * - Cambios de sección -> actualiza su sección
 * - Trasladados / Retirados -> actualiza su estado_matricula a TRASLADADO/RETIRADO
 */
const importarExcelWeb = async (req, res) => {
    const { archivoBase64, seccionPorDefecto } = req.body;

    if (!archivoBase64) {
        return res.status(400).json({ error: 'Debe seleccionar un archivo Excel (.xlsx o .xls) para importar.' });
    }

    try {
        const base64Limpio = archivoBase64.includes(',')
            ? archivoBase64.split(',')[1]
            : archivoBase64;
        const buffer = Buffer.from(base64Limpio, 'base64');

        const { estudiantes, filasOmitidasSinDni } = extraerEstudiantesDeBufferExcel(buffer, seccionPorDefecto || 'A');

        if (estudiantes.length === 0) {
            return res.status(400).json({
                error: 'No se detectaron estudiantes con DNI válido (8 dígitos) en el archivo seleccionado. Verifica que el Excel contenga columnas de DNI, Apellidos y Nombres.'
            });
        }

        // Obtener el estado actual del padrón en BD para reportar qué cambió exactamente
        const [existentesDB] = await pool.query(
            `SELECT dni, nombres, apellidos, seccion, COALESCE(estado_matricula, 'DEFINITIVA') AS estado_matricula
             FROM Estudiante`
        );
        const mapaActual = new Map();
        existentesDB.forEach(e => mapaActual.set(e.dni, e));

        const nuevosAgregados = [];
        const cambiosSeccion = [];
        const bajasDetectadas = [];
        const reactivados = [];
        let sinCambios = 0;

        for (const est of estudiantes) {
            const previo = mapaActual.get(est.dni);
            if (!previo) {
                if (est.estado_matricula === 'DEFINITIVA') {
                    nuevosAgregados.push(`${est.apellidos}, ${est.nombres} (5to "${est.seccion}")`);
                } else {
                    bajasDetectadas.push(`${est.apellidos}, ${est.nombres} (${est.estado_matricula})`);
                }
            } else {
                let huboCambio = false;
                if (previo.seccion !== est.seccion) {
                    cambiosSeccion.push(`${est.apellidos}, ${est.nombres}: 5to "${previo.seccion}" → 5to "${est.seccion}"`);
                    huboCambio = true;
                }
                if (previo.estado_matricula === 'DEFINITIVA' && est.estado_matricula !== 'DEFINITIVA') {
                    bajasDetectadas.push(`${est.apellidos}, ${est.nombres} (Pasó a ${est.estado_matricula})`);
                    huboCambio = true;
                } else if (previo.estado_matricula !== 'DEFINITIVA' && est.estado_matricula === 'DEFINITIVA') {
                    reactivados.push(`${est.apellidos}, ${est.nombres} (5to "${est.seccion}")`);
                    huboCambio = true;
                }
                if (!huboCambio) sinCambios++;
            }
        }

        const valoresInsertar = estudiantes.map(e => [
            e.dni,
            e.nombres,
            e.apellidos,
            e.grado,
            e.seccion,
            e.telefono_apoderado,
            e.estado_matricula
        ]);

        const sql = `
            INSERT INTO Estudiante (dni, nombres, apellidos, grado, seccion, telefono_apoderado, estado_matricula)
            VALUES ?
            ON DUPLICATE KEY UPDATE
                nombres = VALUES(nombres),
                apellidos = VALUES(apellidos),
                grado = VALUES(grado),
                seccion = VALUES(seccion),
                telefono_apoderado = COALESCE(VALUES(telefono_apoderado), Estudiante.telefono_apoderado),
                estado_matricula = VALUES(estado_matricula)
        `;

        await pool.query(sql, [valoresInsertar]);

        const [[conteoFinal]] = await pool.query(`
            SELECT
                SUM(CASE WHEN COALESCE(estado_matricula, 'DEFINITIVA') = 'DEFINITIVA' THEN 1 ELSE 0 END) AS totalActivos,
                SUM(CASE WHEN COALESCE(estado_matricula, 'DEFINITIVA') != 'DEFINITIVA' THEN 1 ELSE 0 END) AS totalBajas
            FROM Estudiante
        `);

        return res.status(200).json({
            mensaje: `Importación completada con éxito (${estudiantes.length} registros procesados del Excel).`,
            resumen: {
                procesadosEnExcel: estudiantes.length,
                nuevosAgregados: nuevosAgregados.length,
                cambiosSeccion: cambiosSeccion.length,
                bajasDetectadas: bajasDetectadas.length,
                reactivados: reactivados.length,
                sinCambios,
                totalActivosEnPadron: Number(conteoFinal?.totalActivos || 0),
                totalBajasEnPadron: Number(conteoFinal?.totalBajas || 0)
            },
            detalles: {
                nuevosAgregados: nuevosAgregados.slice(0, 50),
                cambiosSeccion: cambiosSeccion.slice(0, 50),
                bajasDetectadas: bajasDetectadas.slice(0, 50),
                reactivados: reactivados.slice(0, 50)
            }
        });
    } catch (error) {
        console.error('❌ Error importando Excel desde la web:', error);
        return res.status(500).json({
            error: 'Error al procesar el archivo Excel. Asegúrate de subir un archivo .xlsx o .xls válido.'
        });
    }
};

// Scheduler ligero en memoria que revisa cada minuto si son las 13:30 en Perú (Lunes a Viernes)
/**
 * GET /api/asistencia/exportar-excel?seccion=A&fecha_inicio=YYYY-MM-DD&fecha_fin=YYYY-MM-DD
 * Permite a Auxiliares, TOECE y Administración descargar el consolidado semanal o mensual en formato Excel (.xlsx)
 * con sábana de días (P = Puntual, T = Tardanza, F = Falta, - = Sin Registro) y totales por estudiante en orden alfabético.
 */
const exportarReporteConsolidadoExcel = async (req, res) => {
    try {
        const { seccion, fecha_inicio, fecha_fin, mes } = req.query;
        let fInicio = fecha_inicio;
        let fFin = fecha_fin;

        // Si pasan mes en formato YYYY-MM (ej. 2026-11)
        if (mes && /^\d{4}-\d{2}$/.test(mes)) {
            const [anio, m] = mes.split('-').map(Number);
            const ultDia = new Date(anio, m, 0).getDate();
            fInicio = `${mes}-01`;
            fFin = `${mes}-${String(ultDia).padStart(2, '0')}`;
        }

        if (!fInicio || !fFin) {
            const hoy = new Date();
            const anio = hoy.getFullYear();
            const m = String(hoy.getMonth() + 1).padStart(2, '0');
            const ultDia = new Date(anio, hoy.getMonth() + 1, 0).getDate();
            fInicio = `${anio}-${m}-01`;
            fFin = `${anio}-${m}-${String(ultDia).padStart(2, '0')}`;
        }

        const seccionFiltro = seccion ? seccion.trim().toUpperCase() : null;

        // 1. Obtener lista de estudiantes activos ordenados alfabéticamente
        let sqlEst = `
            SELECT id_estudiante, dni, apellidos, nombres, seccion, hora_limite_puntual
            FROM Estudiante
            WHERE COALESCE(estado_matricula, 'DEFINITIVA') = 'DEFINITIVA'
        `;
        const paramsEst = [];
        if (seccionFiltro) {
            sqlEst += ' AND seccion = ?';
            paramsEst.push(seccionFiltro);
        }
        sqlEst += ' ORDER BY seccion ASC, apellidos ASC, nombres ASC';
        const [estudiantes] = await pool.query(sqlEst, paramsEst);

        if (estudiantes.length === 0) {
            return res.status(404).json({ error: 'No se encontraron estudiantes para la sección seleccionada.' });
        }

        // 2. Obtener todas las asistencias del rango de fechas
        let sqlAsis = `
            SELECT a.estudiante_id, a.fecha, a.estado, a.hora_ingreso
            FROM Asistencia a
            INNER JOIN Estudiante e ON a.estudiante_id = e.id_estudiante
            WHERE a.fecha BETWEEN ? AND ?
              AND COALESCE(e.estado_matricula, 'DEFINITIVA') = 'DEFINITIVA'
        `;
        const paramsAsis = [fInicio, fFin];
        if (seccionFiltro) {
            sqlAsis += ' AND e.seccion = ?';
            paramsAsis.push(seccionFiltro);
        }
        const [asistencias] = await pool.query(sqlAsis, paramsAsis);

        // Mapa de asistencia: [id_estudiante][fecha] = estado
        const mapaAsis = new Map();
        for (const a of asistencias) {
            const fStr = typeof a.fecha === 'string' ? a.fecha : new Intl.DateTimeFormat('sv-SE').format(new Date(a.fecha));
            if (!mapaAsis.has(a.estudiante_id)) {
                mapaAsis.set(a.estudiante_id, new Map());
            }
            mapaAsis.get(a.estudiante_id).set(fStr, a.estado);
        }

        // 3. Generar lista de fechas (solo días hábiles de lunes a viernes o días con registro)
        const dInicio = new Date(`${fInicio}T00:00:00`);
        const dFin = new Date(`${fFin}T00:00:00`);
        const fechasRango = [];
        const cur = new Date(dInicio);
        while (cur <= dFin) {
            const diaSemana = cur.getDay(); // 0: Dom, 6: Sab
            if (diaSemana !== 0 && diaSemana !== 6) {
                const fStr = cur.toISOString().split('T')[0];
                fechasRango.push(fStr);
            }
            cur.setDate(cur.getDate() + 1);
        }

        // 4. Construir filas para la hoja Excel
        const filasExcel = [];

        // Encabezados
        const headers = ['N°', 'DNI', 'Apellidos y Nombres', 'Sec.'];
        fechasRango.forEach(f => {
            const [, m, d] = f.split('-');
            headers.push(`${d}/${m}`);
        });
        headers.push('TOTAL PUNTUAL', 'TOTAL TARDANZA', 'TARD. JUSTIF.', 'TOTAL FALTA', 'FALTA JUSTIF.', '% ASISTENCIA');
        filasExcel.push(headers);

        // Filas por alumno
        estudiantes.forEach((est, idx) => {
            const mapaEst = mapaAsis.get(est.id_estudiante) || new Map();
            let cPuntual = 0;
            let cTardanza = 0;
            let cTardanzaJust = 0;
            let cFalta = 0;
            let cFaltaJust = 0;

            const fila = [
                idx + 1,
                est.dni,
                `${est.apellidos}, ${est.nombres}`,
                est.seccion
            ];

            fechasRango.forEach(f => {
                const st = mapaEst.get(f);
                if (st === 'Puntual') {
                    fila.push('P');
                    cPuntual++;
                } else if (st === 'Tardanza') {
                    fila.push('T');
                    cTardanza++;
                } else if (st === 'Tardanza Justificada') {
                    fila.push('TJ');
                    cTardanzaJust++;
                } else if (st === 'Falta') {
                    fila.push('F');
                    cFalta++;
                } else if (st === 'Falta Justificada') {
                    fila.push('FJ');
                    cFaltaJust++;
                } else {
                    fila.push('-');
                }
            });

            const asistieron = cPuntual + cTardanza + cTardanzaJust;
            const totalDiasValidados = cPuntual + cTardanza + cTardanzaJust + cFalta + cFaltaJust;
            const pct = totalDiasValidados > 0 ? `${Math.round((asistieron / totalDiasValidados) * 100)}%` : '0%';

            fila.push(cPuntual, cTardanza, cTardanzaJust, cFalta, cFaltaJust, pct);
            filasExcel.push(fila);
        });

        // 5. Crear libro de trabajo con xlsx
        const xlsx = require('xlsx');
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.aoa_to_sheet(filasExcel);

        // Ajustar anchos de columnas
        const colWidths = [{ wch: 4 }, { wch: 10 }, { wch: 34 }, { wch: 6 }];
        fechasRango.forEach(() => colWidths.push({ wch: 6 }));
        colWidths.push({ wch: 14 }, { wch: 15 }, { wch: 14 }, { wch: 13 }, { wch: 14 }, { wch: 14 });
        ws['!cols'] = colWidths;

        const nombreHoja = seccionFiltro ? `5to_${seccionFiltro}` : 'Consolidado_5to';
        xlsx.utils.book_append_sheet(wb, ws, nombreHoja);

        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const nombreArchivo = `Asistencia_5to_${seccionFiltro || 'Todas'}_${fInicio}_al_${fFin}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
        return res.send(buffer);

    } catch (error) {
        console.error('❌ Error al exportar consolidado Excel:', error);
        return res.status(500).json({ error: 'Error al exportar consolidado de asistencia.' });
    }
};

let ultimaFechaCierreAuto = null;
const iniciarProgramadorCierrePorton = () => {
    const horaCierreConfig = (process.env.HORA_CIERRE_PORTON || '13:30:00').slice(0, 5); // '13:30'
    console.log(`⏰ Programador de Cierre de Portón activo para las ${horaCierreConfig} hrs (America/Lima).`);

    setInterval(async () => {
        try {
            const { fechaSQL, horaSQL } = obtenerFechaHoraPeru();
            const diaSemana = new Date().toLocaleDateString('en-US', { timeZone: 'America/Lima', weekday: 'short' });

            if (!['Sat', 'Sun'].includes(diaSemana) &&
                horaSQL.startsWith(horaCierreConfig) &&
                ultimaFechaCierreAuto !== fechaSQL) {
                ultimaFechaCierreAuto = fechaSQL;
                console.log(`🔔 Reloj marcó ${horaSQL} en Perú. Ejecutando cierre automático de portón...`);
                await ejecutarCierrePorton(fechaSQL);
            }
        } catch (err) {
            console.error('❌ Error en el programador automático de cierre:', err.message);
        }
    }, 30000);
};

/**
 * PUT /api/asistencia/corregir
 * Permite al Auxiliar, TOECE o Administración justificar Tardanzas/Faltas o corregir el estado del día.
 */
const corregirEstadoAsistencia = async (req, res) => {
    const ESTADOS_VALIDOS = ['Puntual', 'Tardanza', 'Tardanza Justificada', 'Falta', 'Falta Justificada'];
    try {
        const { id_asistencia, dni, fecha, estado, observacion } = req.body || {};

        if (!estado || !ESTADOS_VALIDOS.includes(estado)) {
            return res.status(400).json({ error: 'Estado de asistencia inválido.' });
        }

        const { fechaSQL, horaSQL } = obtenerFechaHoraPeru();
        const fechaObjetivo = fecha || fechaSQL;
        const obsLimpia = observacion ? String(observacion).trim().slice(0, 255) : null;

        if (id_asistencia) {
            const [resUpd] = await pool.query(
                'UPDATE Asistencia SET estado = ?, observacion = ? WHERE id_asistencia = ?',
                [estado, obsLimpia, id_asistencia]
            );
            if (resUpd.affectedRows === 0) {
                return res.status(404).json({ error: 'Registro de asistencia no encontrado.' });
            }
        } else {
            if (!dni || !/^\d{8}$/.test(String(dni).trim())) {
                return res.status(400).json({ error: 'Se requiere id_asistencia o DNI válido para corregir.' });
            }
            const [ests] = await pool.query('SELECT id_estudiante FROM Estudiante WHERE dni = ?', [String(dni).trim()]);
            if (ests.length === 0) {
                return res.status(404).json({ error: 'Estudiante no encontrado.' });
            }
            await pool.query(
                `INSERT INTO Asistencia (estudiante_id, fecha, hora_ingreso, estado, observacion)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE estado = VALUES(estado), observacion = VALUES(observacion)`,
                [ests[0].id_estudiante, fechaObjetivo, horaSQL, estado, obsLimpia]
            );
        }

        console.log(`📝 [Corrección Asistencia] Usuario "${req.usuario?.username}" (${req.usuario?.rol}) actualizó DNI/ID (${dni || id_asistencia}) -> ${estado}${obsLimpia ? ` (${obsLimpia})` : ''}`);
        return res.status(200).json({
            mensaje: `Asistencia actualizada a "${estado}".`,
            estado,
            observacion: obsLimpia
        });
    } catch (error) {
        console.error('❌ Error al corregir asistencia:', error);
        return res.status(500).json({ error: 'Error interno al corregir el estado de asistencia.' });
    }
};

module.exports = {
    registrarAsistenciaQR,
    cerrarPortonManual,
    obtenerResumenDashboard,
    corregirEstadoAsistencia,
    listarEstudiantes,
    actualizarTelefonoApoderado,
    crearEstudiante,
    cambiarPermisoEstudiante,
    cambiarSeccionEstudiante,
    cambiarEstadoEstudiante,
    importarExcelWeb,
    exportarReporteConsolidadoExcel,
    iniciarProgramadorCierrePorton
};
