// src/utils/iaSkills.js

// 1. La función real (La Acción)
async function consultarTardanzas(grado, seccion) {
    // Más adelante aquí conectaremos el 'SELECT' real de MySQL
    console.log(`[Base de Datos] Buscando tardanzas para ${grado} ${seccion}...`);
    return `Hoy llegaron tarde 3 alumnos de ${grado} ${seccion}: Juan, María y Luis.`;
}

// 2. La Declaración de la Herramienta (El Manual para el Agente)
const declaracionConsultarTardanzas = {
    name: "consultar_tardanzas",
    description: "Busca en la base de datos los alumnos que llegaron tarde hoy, filtrados por grado y sección escolar.",
    parameters: {
        type: "OBJECT",
        properties: {
            grado: {
                type: "STRING",
                description: "El grado escolar, ej. '1ro', '3ro', '5to'",
            },
            seccion: {
                type: "STRING",
                description: "La sección escolar, ej. 'A', 'B', 'C'",
            }
        },
        required: ["grado", "seccion"]
    }
};

module.exports = { consultarTardanzas, declaracionConsultarTardanzas };