// src/controllers/agenteController.js
const { GoogleGenAI } = require("@google/genai");
const { consultarTardanzas, declaracionConsultarTardanzas } = require("../utils/iaSkills");

// Inicializa el cliente (Necesitarás poner tu GEMINI_API_KEY en el archivo .env)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function procesarMensajeTOECE(mensajeUsuario) {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: mensajeUsuario,
        config: {
            systemInstruction: "Eres el asistente administrativo de la I.E. Nuestra Señora de las Mercedes. Ayudas al área de TOECE respondiendo dudas sobre asistencia. Usa tus herramientas para buscar datos exactos.",
            tools: [{ functionDeclarations: [declaracionConsultarTardanzas] }],
        }
    });

    // Verificamos si el Agente decidió que necesita usar una Skill
    if (response.functionCalls && response.functionCalls.length > 0) {
        const llamada = response.functionCalls[0];

        if (llamada.name === "consultar_tardanzas") {
            const { grado, seccion } = llamada.args;

            // El agente determinó los parámetros, ahora ejecutamos la función
            const resultadoBD = await consultarTardanzas(grado, seccion);

            // En un flujo completo, le devolverías este resultado al Agente 
            // para que arme una respuesta natural, pero por ahora lo retornamos directo.
            return resultadoBD;
        }
    }

    // Si no usó herramientas, devuelve su respuesta normal de texto
    return response.text;
}

module.exports = { procesarMensajeTOECE };