// src/routes/api.js
const express = require('express');
const router = express.Router();
const { procesarMensajeTOECE } = require('../controllers/agenteController');
const { registrarAsistenciaQR } = require('../controllers/asistencia.controller');

// Endpoint POST: /api/chat
router.post('/chat', async (req, res) => {
    try {
        const { mensaje } = req.body;

        // Validación básica
        if (!mensaje) {
            return res.status(400).json({ error: "Debes enviar un mensaje al agente." });
        }

        console.log(`[Frontend dice]: ${mensaje}`);

        // Llamamos a nuestro Agente
        const respuestaAgente = await procesarMensajeTOECE(mensaje);

        // Enviamos la respuesta de vuelta al cliente
        return res.json({ respuesta: respuestaAgente });

    } catch (error) {
        console.error("Error de la IA:", error);
        return res.status(500).json({ error: "El agente tuvo un problema al procesar tu solicitud." });
    }
});

// Endpoint POST: /api/registrar-asistencia (Para el escáner QR)
router.post('/registrar-asistencia', registrarAsistenciaQR);
module.exports = router;