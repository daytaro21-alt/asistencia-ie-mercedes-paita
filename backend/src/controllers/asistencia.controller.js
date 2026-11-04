// src/controllers/asistencia.controller.js
const pool = require('../config/db');
const { enviarAlertaWhatsApp } = require('../utils/whatsappService');

// Formateador determinista fijado a la zona horaria de Perú
const obtenerFechaHoraPeru = () => {
    const ahora = new Date();
    const opcionesFecha = { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' };
    const opcionesHora = { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };

    // Formato YYYY-MM-DD (usando locale sv-SE que estandariza ISO en zona local)
    const fechaSQL = new Intl.DateTimeFormat('sv-SE', opcionesFecha).format(ahora);
    const horaSQL = new Intl.DateTimeFormat('sv-SE', opcionesHora).format(ahora);

    return { fechaSQL, horaSQL };
};

/**
 * POST /api/registrar-asistencia
 * Escaneo QR en portón:
 * - 12:30:00 a 12:45:00 -> Puntual
 * - 12:45:01 a 13:30:00 -> Tardanza (+ Alerta WhatsApp)
 * - > 13:30:00 -> Portón cerrado (rechaza o registra según política; aquí rechaza por portón cerrado si no tiene falta previa)
 */
const registrarAsistenciaQR = async (req, res) => {
    const { dni } = req.body;

    if (!dni || !/^\d{8}$/.test(dni.trim())) {
        return res.status(400).json({ error: 'DNI inválido o no proporcionado por el escáner.' });
    }

    try {
        const [estudiantes] = await pool.query(
            'SELECT id_estudiante, dni, nombres, apellidos, grado, seccion, telefono_apoderado FROM Estudiante WHERE dni = ?',
            [dni.trim()]
        );

        if (estudiantes.length === 0) {
            return res.status(404).json({ error: 'Estudiante no encontrado en el padrón de 5to de Secundaria.' });
        }

        const estudiante = estudiantes[0];
        const { fechaSQL, horaSQL } = obtenerFechaHoraPeru();

        const horaLimitePuntual = process.env.HORA_LIMITE_PUNTUAL || '12:45:00';
        const horaCierrePorton = process.env.HORA_CIERRE_PORTON || '13:30:00';

        // Si el escaneo ocurre después de las 13:30:00 y se activa bloqueo estricto de portón (opcional por variable)
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

        // Disparo asíncrono (Fire-and-Forget) para no bloquear la fila en el portón
        if (estadoAsistencia === 'Tardanza' && estudiante.telefono_apoderado) {
            setImmediate(() => {
                enviarAlertaWhatsApp(
                    estudiante.telefono_apoderado,
                    `${estudiante.nombres} ${estudiante.apellidos}`,
                    horaSQL,
                    estadoAsistencia,
                    fechaSQL
                );
            });
        }

        return res.status(200).json({
            mensaje: 'Asistencia registrada correctamente.',
            alumno: `${estudiante.nombres} ${estudiante.apellidos}`,
            dni: estudiante.dni,
            grado: estudiante.grado,
            seccion: estudiante.seccion,
            fecha: fechaSQL,
            hora: horaSQL,
            estado: estadoAsistencia
        });

    } catch (error) {
        console.error('❌ Error en el registro de asistencia:', error);
        return res.status(500).json({ error: 'Error interno del servidor al procesar la asistencia.' });
    }
};

/**
 * Proceso de Cierre de Portón (13:30:00):
 * Busca a todos los alumnos de 5to que NO registraron entrada hoy, les inserta 'Falta'
 * y encola la alerta de WhatsApp a los apoderados que tengan teléfono registrado.
 */
const ejecutarCierrePorton = async (fechaObjetivo = null) => {
    const { fechaSQL, horaSQL } = obtenerFechaHoraPeru();
    const fechaCierre = fechaObjetivo || fechaSQL;
    const horaCierre = process.env.HORA_CIERRE_PORTON || '13:30:00';

    // Buscar alumnos de 5to sin registro en la fecha indicada
    const [ausentes] = await pool.query(
        `SELECT e.id_estudiante, e.dni, e.nombres, e.apellidos, e.grado, e.seccion, e.telefono_apoderado
         FROM Estudiante e
         LEFT JOIN Asistencia a ON e.id_estudiante = a.estudiante_id AND a.fecha = ?
         WHERE a.id_asistencia IS NULL`,
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
 * POST /api/asistencia/cerrar-porton (Protegido con JWT para TOECE)
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
 * GET /api/asistencia/resumen?fecha=YYYY-MM-DD&seccion=A (Protegido con JWT para Dashboard TOECE)
 */
const obtenerResumenDashboard = async (req, res) => {
    try {
        const { fechaSQL } = obtenerFechaHoraPeru();
        const fechaConsulta = req.query.fecha || fechaSQL;
        const seccionFiltro = req.query.seccion ? req.query.seccion.trim().toUpperCase() : null;

        // 1. Conteo total del padrón (257 o filtrado por sección)
        let sqlPadron = 'SELECT COUNT(*) AS total FROM Estudiante';
        const paramsPadron = [];
        if (seccionFiltro) {
            sqlPadron += ' WHERE seccion = ?';
            paramsPadron.push(seccionFiltro);
        }
        const [[{ total: totalEstudiantes }]] = await pool.query(sqlPadron, paramsPadron);

        // 2. Conteo por estado hoy
        let sqlEstados = `
            SELECT a.estado, COUNT(*) AS cantidad
            FROM Asistencia a
            INNER JOIN Estudiante e ON a.estudiante_id = e.id_estudiante
            WHERE a.fecha = ?
        `;
        const paramsEstados = [fechaConsulta];
        if (seccionFiltro) {
            sqlEstados += ' AND e.seccion = ?';
            paramsEstados.push(seccionFiltro);
        }
        sqlEstados += ' GROUP BY a.estado';
        const [conteos] = await pool.query(sqlEstados, paramsEstados);

        const metricas = { Puntual: 0, Tardanza: 0, Falta: 0 };
        conteos.forEach(c => {
            if (metricas[c.estado] !== undefined) metricas[c.estado] = Number(c.cantidad);
        });

        const registrados = metricas.Puntual + metricas.Tardanza + metricas.Falta;
        const sinRegistro = Math.max(0, totalEstudiantes - registrados);

        // 3. Listado detallado de registros del día
        let sqlListado = `
            SELECT a.id_asistencia, e.id_estudiante, e.dni, e.nombres, e.apellidos, e.grado, e.seccion,
                   e.telefono_apoderado, a.fecha, a.hora_ingreso, a.estado
            FROM Asistencia a
            INNER JOIN Estudiante e ON a.estudiante_id = e.id_estudiante
            WHERE a.fecha = ?
        `;
        const paramsListado = [fechaConsulta];
        if (seccionFiltro) {
            sqlListado += ' AND e.seccion = ?';
            paramsListado.push(seccionFiltro);
        }
        sqlListado += ' ORDER BY a.hora_ingreso DESC, e.seccion ASC, e.apellidos ASC';
        const [registros] = await pool.query(sqlListado, paramsListado);

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
                faltas: metricas.Falta,
                pendientes: sinRegistro
            },
            registros
        });

    } catch (error) {
        console.error('❌ Error obteniendo resumen del dashboard:', error);
        return res.status(500).json({ error: 'Error al obtener el resumen de asistencia.' });
    }
};

/**
 * GET /api/estudiantes?seccion=A&busqueda=... (Para gestionar teléfonos de apoderados en TOECE)
 */
const listarEstudiantes = async (req, res) => {
    try {
        const { seccion, busqueda } = req.query;
        let sql = 'SELECT id_estudiante, dni, nombres, apellidos, grado, seccion, telefono_apoderado FROM Estudiante WHERE 1=1';
        const params = [];

        if (seccion) {
            sql += ' AND seccion = ?';
            params.push(seccion.trim().toUpperCase());
        }
        if (busqueda) {
            sql += ' AND (dni LIKE ? OR apellidos LIKE ? OR nombres LIKE ?)';
            const term = `%${busqueda.trim()}%`;
            params.push(term, term, term);
        }

        sql += ' ORDER BY seccion ASC, apellidos ASC';
        const [estudiantes] = await pool.query(sql, params);
        return res.status(200).json({ total: estudiantes.length, estudiantes });
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

// Scheduler ligero en memoria que revisa cada minuto si son las 13:30 en Perú (Lunes a Viernes)
let ultimaFechaCierreAuto = null;
const iniciarProgramadorCierrePorton = () => {
    const horaCierreConfig = (process.env.HORA_CIERRE_PORTON || '13:30:00').slice(0, 5); // '13:30'
    console.log(`⏰ Programador de Cierre de Portón activo para las ${horaCierreConfig} hrs (America/Lima).`);

    setInterval(async () => {
        try {
            const { fechaSQL, horaSQL } = obtenerFechaHoraPeru();
            const diaSemana = new Date().toLocaleDateString('en-US', { timeZone: 'America/Lima', weekday: 'short' });

            // Solo ejecuta de Lunes a Viernes cuando el reloj marca las 13:30 y aún no se ejecutó hoy
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
    }, 30000); // Verifica cada 30 segundos
};

module.exports = {
    registrarAsistenciaQR,
    cerrarPortonManual,
    obtenerResumenDashboard,
    listarEstudiantes,
    actualizarTelefonoApoderado,
    iniciarProgramadorCierrePorton
};
