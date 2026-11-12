// src/utils/iaSkills.js
const { Type } = require("@google/genai");
const pool = require('../config/db');

// Helper de fecha fijado a America/Lima
const obtenerFechaActualPeru = () => {
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Lima',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
};

const declaracionConsultarTardanzas = {
    name: "consultar_tardanzas",
    description: "Consulta en MySQL la lista detallada de estudiantes de 5to de Secundaria que registraron Tardanza o Falta en una fecha determinada (por defecto hoy). Úsalo cuando TOECE pregunte por nombres de alumnos con tardanzas, inasistencias o reportes nominales por sección.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            grado: {
                type: Type.STRING,
                description: "El grado escolar (ej. 'QUINTO'). Omitir para consultar todo el piloto de 5to."
            },
            seccion: {
                type: Type.STRING,
                description: "Letra de la sección en mayúscula ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'). Omitir si se consultan todas las secciones."
            },
            fecha: {
                type: Type.STRING,
                description: "Fecha de consulta en formato YYYY-MM-DD. Si el usuario dice 'hoy', omitir este parámetro."
            },
            estado: {
                type: Type.STRING,
                description: "Filtrar específicamente por 'Tardanza' o 'Falta'. Omitir para traer ambos."
            }
        }
    }
};

const declaracionResumenEstadistico = {
    name: "obtener_estadisticas_asistencia",
    description: "Obtiene el conteo estadístico de asistencia (Puntuales, Tardanzas, Faltas y Pendientes de ingreso) desglosado por secciones (A hasta H) en una fecha determinada. Úsalo cuando TOECE pida porcentajes, comparativas entre secciones o totales del día.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            fecha: {
                type: Type.STRING,
                description: "Fecha en formato YYYY-MM-DD. Si consulta por hoy, omitir."
            }
        }
    }
};

async function consultarTardanzas(grado, seccion, fecha, estado) {
    try {
        const fechaConsulta = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
            ? fecha
            : obtenerFechaActualPeru();

        console.log(`🤖 [IA Skill: consultar_tardanzas] Fecha: ${fechaConsulta} | Sección: ${seccion || 'Todas'} | Estado: ${estado || 'Tardanza/Falta'}`);

        let query = `
            SELECT e.dni, e.nombres, e.apellidos, e.grado, e.seccion, a.hora_ingreso, a.estado, e.telefono_apoderado
            FROM Asistencia a
            INNER JOIN Estudiante e ON a.estudiante_id = e.id_estudiante
            WHERE a.fecha = ?
              AND COALESCE(e.estado_matricula, 'DEFINITIVA') = 'DEFINITIVA'
        `;
        const params = [fechaConsulta];

        if (estado && ['Tardanza', 'Tardanza Justificada', 'Falta', 'Falta Justificada', 'Puntual'].includes(estado)) {
            query += ` AND a.estado = ?`;
            params.push(estado);
        } else {
            query += ` AND a.estado IN ('Tardanza', 'Tardanza Justificada', 'Falta', 'Falta Justificada')`;
        }

        if (grado && grado.trim() !== '') {
            query += ` AND (e.grado = ? OR e.grado LIKE '5%' OR e.grado = 'QUINTO')`;
            params.push(grado.trim());
        }

        if (seccion && seccion.trim() !== '') {
            query += ` AND e.seccion = ?`;
            params.push(seccion.trim().toUpperCase());
        }

        query += ` ORDER BY e.seccion ASC, a.estado ASC, a.hora_ingreso ASC`;

        const [rows] = await pool.query(query, params);

        return {
            fecha: fechaConsulta,
            filtros: { grado: grado || 'QUINTO', seccion: seccion || 'Todas', estado: estado || 'Tardanza y Falta' },
            total_incidencias: rows.length,
            registros: rows
        };

    } catch (error) {
        console.error("❌ Error en la Skill consultarTardanzas:", error);
        return { error: "Error al consultar la base de datos de asistencia." };
    }
}

async function obtenerEstadisticasAsistencia(fecha) {
    try {
        const fechaConsulta = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
            ? fecha
            : obtenerFechaActualPeru();

        console.log(`🤖 [IA Skill: obtener_estadisticas_asistencia] Fecha: ${fechaConsulta}`);

        const [porSeccion] = await pool.query(
            `SELECT 
                e.seccion,
                COUNT(e.id_estudiante) AS total_alumnos,
                SUM(CASE WHEN a.estado = 'Puntual' THEN 1 ELSE 0 END) AS puntuales,
                SUM(CASE WHEN a.estado IN ('Tardanza', 'Tardanza Justificada') THEN 1 ELSE 0 END) AS tardanzas,
                SUM(CASE WHEN a.estado = 'Tardanza Justificada' THEN 1 ELSE 0 END) AS tardanzas_justificadas,
                SUM(CASE WHEN a.estado IN ('Falta', 'Falta Justificada') THEN 1 ELSE 0 END) AS faltas,
                SUM(CASE WHEN a.estado = 'Falta Justificada' THEN 1 ELSE 0 END) AS faltas_justificadas,
                SUM(CASE WHEN a.id_asistencia IS NULL THEN 1 ELSE 0 END) AS sin_registro
             FROM Estudiante e
             LEFT JOIN Asistencia a ON e.id_estudiante = a.estudiante_id AND a.fecha = ?
             WHERE COALESCE(e.estado_matricula, 'DEFINITIVA') = 'DEFINITIVA'
             GROUP BY e.seccion
             ORDER BY e.seccion ASC`,
            [fechaConsulta]
        );

        return {
            fecha: fechaConsulta,
            horario_colegio: "Ingreso: 12:30 - 12:45 | Tardanza: 12:45:01 - 13:30 | Cierre/Falta: 13:30",
            desglose_secciones: porSeccion
        };
    } catch (error) {
        console.error("❌ Error en la Skill obtenerEstadisticasAsistencia:", error);
        return { error: "Error al obtener estadísticas de asistencia." };
    }
}

module.exports = {
    declaracionConsultarTardanzas,
    declaracionResumenEstadistico,
    consultarTardanzas,
    obtenerEstadisticasAsistencia
};
