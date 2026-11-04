// src/routes/api.js
const express = require('express');
const router = express.Router();
const { procesarMensajeTOECE } = require('../controllers/agenteController');
const {
    registrarAsistenciaQR,
    cerrarPortonManual,
    obtenerResumenDashboard,
    listarEstudiantes,
    actualizarTelefonoApoderado
} = require('../controllers/asistencia.controller');
const { login } = require('../controllers/auth.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

// ==========================================
// 1. RUTAS PÚBLICAS / KIOSCO PORTÓN
// ==========================================
// Autenticación del personal de TOECE
router.post('/auth/login', login);

// Escáner QR en portón (12:30 - 12:45 Puntual | 12:45:01 - 13:30 Tardanza)
router.post('/registrar-asistencia', registrarAsistenciaQR);

// ==========================================
// 2. RUTAS PROTEGIDAS (PANEL TOECE - JWT)
// ==========================================
// Resumen estadístico y tabla en tiempo real del día
router.get('/asistencia/resumen', verificarToken, obtenerResumenDashboard);

// Cierre manual de portón (marca Falta a los que no asistieron y envía WhatsApp)
router.post('/asistencia/cerrar-porton', verificarToken, cerrarPortonManual);

// Directorio de estudiantes de 5to y actualización de celular de apoderados
router.get('/estudiantes', verificarToken, listarEstudiantes);
router.put('/estudiantes/:dni/telefono', verificarToken, actualizarTelefonoApoderado);

// Agente Analítico de IA (Gemini 2.5 Flash + Function Calling)
router.post('/chat', verificarToken, async (req, res) => {
    try {
        const { mensaje, fecha } = req.body;

        if (!mensaje) {
            return res.status(400).json({ error: "Debes enviar un mensaje al agente." });
        }

        console.log(`[TOECE (${req.usuario.username}) consulta a IA]: ${mensaje}`);

        const respuestaAgente = await procesarMensajeTOECE(mensaje, fecha);
        return res.json({ respuesta: respuestaAgente });

    } catch (error) {
        console.error("Error de la IA:", error);
        return res.status(500).json({ error: "El agente tuvo un problema al procesar tu solicitud. Verifica tu GEMINI_API_KEY en el archivo .env." });
    }
});

module.exports = router;
