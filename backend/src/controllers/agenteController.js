// src/controllers/agenteController.js
const { GoogleGenAI } = require("@google/genai");
const { consultarTardanzas, declaracionConsultarTardanzas } = require("../utils/iaSkills");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const configAgente = {
    systemInstruction: "Eres el asistente analítico del área de TOECE de la I.E. Nuestra Señora de las Mercedes. Responde de forma ejecutiva, precisa y estructurada usando datos reales de las herramientas disponibles.",
    tools: [{ functionDeclarations: [declaracionConsultarTardanzas] }],
};

async function procesarMensajeTOECE(mensajeUsuario) {
    const contents = [{ role: 'user', parts: [{ text: mensajeUsuario }] }];

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: configAgente
    });

    if (response.functionCalls && response.functionCalls.length > 0) {
        const llamada = response.functionCalls[0];

        if (llamada.name === "consultar_tardanzas") {
            const { grado, seccion } = llamada.args;
            const resultadoBD = await consultarTardanzas(grado, seccion);

            // Agregamos la respuesta del modelo (solicitud de tool) y el resultado de nuestra BD
            contents.push(response.candidates[0].content);
            contents.push({
                role: 'user',
                parts: [{
                    functionResponse: {
                        name: llamada.name,
                        response: { datos: resultadoBD }
                    }
                }]
            });

            // Segunda llamada para que Gemini sintetice el reporte en lenguaje natural
            const respuestaFinal = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents,
                config: configAgente
            });

            return respuestaFinal.text;
        }
    }

    return response.text;
}

module.exports = { procesarMensajeTOECE };