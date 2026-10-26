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
    description: "Consulta en MySQL la lista de estudiantes que registraron Tardanza o Falta en una fecha determinada (por defecto hoy). Úsalo cuando TOECE pregunte por tardanzas, inasistencias o reportes por grado y sección.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            grado: {
                type: Type.STRING,
                description: "El grado escolar exactamente como figura en la BD (ej. 'Primero', 'Segundo', 'Tercero', 'Cuarto', 'Quinto' o '1', '2', '3', '4', '5'). Omitir si se consulta todo el colegio."
            },
            seccion: {
                type: Type.STRING,
                description: "Letra de la sección en mayúscula (ej. 'A', 'B', 'C'). Omitir si se consultan todas las secciones."
            },
            fecha: {
                type: Type.STRING,
                description: "Fecha de consulta en formato YYYY-MM-DD. Si el usuario dice 'hoy', omitir este parámetro."
            }
        }
    }
};

async function consultarTardanzas(grado, seccion, fecha) {
    try {
        const fechaConsulta = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
            ? fecha
            : obtenerFechaActualPeru();

        console.log(`🤖 [IA Skill] Fecha: ${fechaConsulta} | Grado: ${grado || 'Todos'} | Sección: ${seccion || 'Todas'}`);

        let query = `
            SELECT e.dni, e.nombres, e.apellidos, e.grado, e.seccion, a.hora_ingreso, a.estado
            FROM Asistencia a
            INNER JOIN Estudiante e ON a.estudiante_id = e.id_estudiante
            WHERE a.fecha = ? AND a.estado IN ('Tardanza', 'Falta')
        `;
        const params = [fechaConsulta];

        if (grado && grado.trim() !== '') {
            query += ` AND e.grado = ?`;
            params.push(grado.trim());
        }

        if (seccion && seccion.trim() !== '') {
            query += ` AND e.seccion = ?`;
            params.push(seccion.trim().toUpperCase());
        }

        query += ` ORDER BY e.grado ASC, e.seccion ASC, a.hora_ingreso ASC`;

        const [rows] = await pool.query(query, params);

        return {
            fecha: fechaConsulta,
            filtros: { grado: grado || 'Todos', seccion: seccion || 'Todas' },
            total_incidencias: rows.length,
            registros: rows
        };

    } catch (error) {
        console.error("❌ Error en la Skill consultarTardanzas:", error);
        return { error: "Error al consultar la base de datos de asistencia." };
    }
}

module.exports = {
    declaracionConsultarTardanzas,
    consultarTardanzas
};