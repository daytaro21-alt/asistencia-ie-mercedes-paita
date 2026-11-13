const xlsx = require('xlsx');
const pool = require('../config/db');

const obtenerFechaPeru = () => {
    const ahora = new Date();
    const fmt = (opt) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', ...opt }).format(ahora);
    return {
        fechaSQL: fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }),
        horaSQL: new Intl.DateTimeFormat('en-GB', {
            timeZone: 'America/Lima',
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).format(ahora)
    };
};

const normalizarFechaSQL = (val) => {
    if (!val) return null;
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return null;
};

/**
 * Genera el buffer Excel (.xlsx) con el registro diario completo de 5to grado
 */
const generarExcelAsistenciaDiariaBuffer = async (fechaObjetivo = null) => {
    const { fechaSQL } = obtenerFechaPeru();
    const fecha = fechaObjetivo || fechaSQL;

    const [rows] = await pool.query(
        `SELECT e.dni,
                CONCAT(e.apellidos, ', ', e.nombres) AS estudiante,
                e.seccion,
                a.hora_ingreso,
                COALESCE(a.estado, 'Sin Registro') AS estado,
                COALESCE(a.observacion, '') AS observacion
         FROM Estudiante e
         LEFT JOIN Asistencia a ON e.id_estudiante = a.estudiante_id AND a.fecha = ?
         WHERE e.grado = 5 AND e.estado_matricula = 'DEFINITIVA'
         ORDER BY e.seccion ASC, e.apellidos ASC, e.nombres ASC`,
        [fecha]
    );

    const resumen = { total: rows.length, puntual: 0, tardanza: 0, falta: 0, justificado: 0, sinRegistro: 0 };
    const dataExcel = rows.map((r, idx) => {
        if (r.estado === 'Puntual') resumen.puntual++;
        else if (r.estado === 'Tardanza') resumen.tardanza++;
        else if (r.estado === 'Falta') resumen.falta++;
        else if (r.estado === 'Tardanza Justificada' || r.estado === 'Falta Justificada') resumen.justificado++;
        else resumen.sinRegistro++;

        return {
            'N°': idx + 1,
            'DNI': r.dni,
            'Apellidos y Nombres': r.estudiante,
            'Sección': `5to ${r.seccion}`,
            'Fecha': fecha,
            'Hora Ingreso': r.hora_ingreso || '--:--:--',
            'Estado': r.estado,
            'Observación': r.observacion
        };
    });

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(dataExcel);
    ws['!cols'] = [
        { wch: 5 },
        { wch: 12 },
        { wch: 36 },
        { wch: 10 },
        { wch: 12 },
        { wch: 14 },
        { wch: 22 },
        { wch: 32 }
    ];
    xlsx.utils.book_append_sheet(wb, ws, 'Asistencia Diaria');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return {
        buffer,
        nombreArchivo: `Asistencia_Diaria_${fecha}.xlsx`,
        fecha,
        totalRegistros: rows.length,
        resumen
    };
};

/**
 * Genera el objeto JSON completo para copia de seguridad y restauración integral
 */
const generarBackupCompletoJSON = async () => {
    const { fechaSQL, horaSQL } = obtenerFechaPeru();

    const [estudiantes] = await pool.query(
        `SELECT id_estudiante, dni, nombres, apellidos, grado, seccion, estado_matricula,
                telefono_apoderado, tiene_permiso_1pm, qr_hash
         FROM Estudiante
         ORDER BY seccion ASC, apellidos ASC, nombres ASC`
    );

    const [asistencias] = await pool.query(
        `SELECT a.id_asistencia, a.estudiante_id, e.dni AS estudiante_dni,
                DATE_FORMAT(a.fecha, '%Y-%m-%d') AS fecha,
                TIME_FORMAT(a.hora_ingreso, '%H:%i:%s') AS hora_ingreso,
                a.estado, a.observacion
         FROM Asistencia a
         INNER JOIN Estudiante e ON a.estudiante_id = e.id_estudiante
         ORDER BY a.fecha DESC, a.id_asistencia ASC`
    );

    const [permisos] = await pool.query(
        `SELECT p.id_permiso, p.estudiante_id, e.dni AS estudiante_dni,
                DATE_FORMAT(p.fecha, '%Y-%m-%d') AS fecha,
                TIME_FORMAT(p.hora_salida, '%H:%i:%s') AS hora_salida,
                p.motivo, p.detalle, p.autorizado_por, p.verificado_porteria,
                TIME_FORMAT(p.hora_verificacion, '%H:%i:%s') AS hora_verificacion
         FROM PermisoSalida p
         INNER JOIN Estudiante e ON p.estudiante_id = e.id_estudiante
         ORDER BY p.fecha DESC, p.id_permiso ASC`
    );

    return {
        version: '1.0',
        sistema: 'I.E. Nuestra Señora de las Mercedes - Control Asistencia 5to',
        fechaGeneracion: `${fechaSQL} ${horaSQL}`,
        fecha: fechaSQL,
        resumen: {
            estudiantes: estudiantes.length,
            asistencias: asistencias.length,
            permisosSalida: permisos.length
        },
        tablas: {
            Estudiante: estudiantes,
            Asistencia: asistencias,
            PermisoSalida: permisos
        }
    };
};

/**
 * Restaura datos desde un Backup JSON completo o desde filas de Excel de asistencia diaria
 */
const restaurarDesdeBackup = async (payload) => {
    if (!payload || typeof payload !== 'object') {
        throw new Error('Formato de archivo de respaldo inválido.');
    }

    const conn = await pool.getConnection();
    let estudiantesRestaurados = 0;
    let asistenciasRestauradas = 0;
    let permisosRestaurados = 0;

    try {
        await conn.beginTransaction();

        const mapaIdViejoADni = new Map();
        const mapaDniAIdActual = new Map();

        const cargarMapaDni = async () => {
            const [actuales] = await conn.query('SELECT id_estudiante, dni FROM Estudiante');
            for (const row of actuales) {
                mapaDniAIdActual.set(String(row.dni).trim(), row.id_estudiante);
            }
        };

        // CASO A: Backup JSON completo
        if (payload.tablas && typeof payload.tablas === 'object') {
            const estudiantes = Array.isArray(payload.tablas.Estudiante) ? payload.tablas.Estudiante : [];
            const asistencias = Array.isArray(payload.tablas.Asistencia) ? payload.tablas.Asistencia : [];
            const permisos = Array.isArray(payload.tablas.PermisoSalida) ? payload.tablas.PermisoSalida : [];

            for (const est of estudiantes) {
                const dni = String(est.dni || '').trim();
                if (!dni) continue;
                if (est.id_estudiante) mapaIdViejoADni.set(est.id_estudiante, dni);

                await conn.query(
                    `INSERT INTO Estudiante
                        (dni, nombres, apellidos, grado, seccion, estado_matricula, telefono_apoderado, tiene_permiso_1pm, qr_hash)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                        nombres = VALUES(nombres),
                        apellidos = VALUES(apellidos),
                        grado = VALUES(grado),
                        seccion = VALUES(seccion),
                        estado_matricula = VALUES(estado_matricula),
                        telefono_apoderado = VALUES(telefono_apoderado),
                        tiene_permiso_1pm = VALUES(tiene_permiso_1pm),
                        qr_hash = COALESCE(VALUES(qr_hash), qr_hash)`,
                    [
                        dni,
                        est.nombres || '',
                        est.apellidos || '',
                        Number(est.grado || 5),
                        String(est.seccion || 'A').trim(),
                        est.estado_matricula || 'DEFINITIVA',
                        est.telefono_apoderado || null,
                        est.tiene_permiso_1pm ? 1 : 0,
                        est.qr_hash || `MERCEDES_5TO_${dni}`
                    ]
                );
                estudiantesRestaurados++;
            }

            await cargarMapaDni();

            for (const asis of asistencias) {
                const dni = asis.estudiante_dni
                    ? String(asis.estudiante_dni).trim()
                    : mapaIdViejoADni.get(asis.estudiante_id);
                const idEstudiante = dni ? mapaDniAIdActual.get(dni) : null;
                const fecha = normalizarFechaSQL(asis.fecha);
                if (!idEstudiante || !fecha || !asis.estado) continue;

                const hora = asis.hora_ingreso && asis.hora_ingreso !== '--:--:--' ? asis.hora_ingreso : null;
                const [existe] = await conn.query(
                    'SELECT id_asistencia FROM Asistencia WHERE estudiante_id = ? AND fecha = ? LIMIT 1',
                    [idEstudiante, fecha]
                );

                if (existe.length > 0) {
                    await conn.query(
                        'UPDATE Asistencia SET hora_ingreso = ?, estado = ?, observacion = ? WHERE id_asistencia = ?',
                        [hora, asis.estado, asis.observacion || null, existe[0].id_asistencia]
                    );
                } else {
                    await conn.query(
                        'INSERT INTO Asistencia (estudiante_id, fecha, hora_ingreso, estado, observacion) VALUES (?, ?, ?, ?, ?)',
                        [idEstudiante, fecha, hora, asis.estado, asis.observacion || null]
                    );
                }
                asistenciasRestauradas++;
            }

            for (const perm of permisos) {
                const dni = perm.estudiante_dni
                    ? String(perm.estudiante_dni).trim()
                    : mapaIdViejoADni.get(perm.estudiante_id);
                const idEstudiante = dni ? mapaDniAIdActual.get(dni) : null;
                const fecha = normalizarFechaSQL(perm.fecha);
                if (!idEstudiante || !fecha || !perm.motivo) continue;

                const horaSalida = perm.hora_salida || '00:00:00';
                const [existePerm] = await conn.query(
                    'SELECT id_permiso FROM PermisoSalida WHERE estudiante_id = ? AND fecha = ? AND hora_salida = ? AND motivo = ? LIMIT 1',
                    [idEstudiante, fecha, horaSalida, perm.motivo]
                );

                if (existePerm.length === 0) {
                    await conn.query(
                        `INSERT INTO PermisoSalida
                            (estudiante_id, fecha, hora_salida, motivo, detalle, autorizado_por, verificado_porteria, hora_verificacion)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            idEstudiante,
                            fecha,
                            horaSalida,
                            perm.motivo,
                            perm.detalle || null,
                            perm.autorizado_por || null,
                            perm.verificado_porteria ? 1 : 0,
                            perm.hora_verificacion || null
                        ]
                    );
                    permisosRestaurados++;
                }
            }
        }
        // CASO B: Restauración desde filas de Excel diario
        else if (payload.tipo === 'asistencia_excel' && Array.isArray(payload.registros)) {
            await cargarMapaDni();
            const estadosValidos = new Set(['Puntual', 'Tardanza', 'Falta', 'Tardanza Justificada', 'Falta Justificada']);

            for (const reg of payload.registros) {
                const dni = String(reg.dni || '').trim();
                const idEstudiante = mapaDniAIdActual.get(dni);
                const fecha = normalizarFechaSQL(reg.fecha || payload.fecha);
                const estado = String(reg.estado || '').trim();
                if (!idEstudiante || !fecha || !estadosValidos.has(estado)) continue;

                const horaRaw = String(reg.hora_ingreso || '').trim();
                const hora = /^\d{2}:\d{2}(:\d{2})?$/.test(horaRaw)
                    ? (horaRaw.length === 5 ? `${horaRaw}:00` : horaRaw)
                    : null;

                const [existe] = await conn.query(
                    'SELECT id_asistencia FROM Asistencia WHERE estudiante_id = ? AND fecha = ? LIMIT 1',
                    [idEstudiante, fecha]
                );

                if (existe.length > 0) {
                    await conn.query(
                        'UPDATE Asistencia SET hora_ingreso = ?, estado = ?, observacion = ? WHERE id_asistencia = ?',
                        [hora, estado, reg.observacion || null, existe[0].id_asistencia]
                    );
                } else {
                    await conn.query(
                        'INSERT INTO Asistencia (estudiante_id, fecha, hora_ingreso, estado, observacion) VALUES (?, ?, ?, ?, ?)',
                        [idEstudiante, fecha, hora, estado, reg.observacion || null]
                    );
                }
                asistenciasRestauradas++;
            }
        } else {
            throw new Error('Estructura de respaldo no reconocida. Sube un archivo .json de copia de seguridad o un Excel diario de asistencia.');
        }

        await conn.commit();
        return {
            ok: true,
            estudiantesRestaurados,
            asistenciasRestauradas,
            permisosRestaurados
        };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

module.exports = {
    generarExcelAsistenciaDiariaBuffer,
    generarBackupCompletoJSON,
    restaurarDesdeBackup
};
