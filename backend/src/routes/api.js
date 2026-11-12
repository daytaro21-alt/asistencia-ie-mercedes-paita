// src/routes/api.js
const express = require('express');
const router = express.Router();
const { procesarMensajeTOECE } = require('../controllers/agenteController');
const {
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
    exportarReporteConsolidadoExcel
} = require('../controllers/asistencia.controller');
const {
    buscarEstudiantePorQrPermiso,
    registrarPermisoSalida,
    listarPermisosSalida,
    eliminarPermisoSalida,
    verificarPermisoPorteria
} = require('../controllers/permisos.controller');
const { login, listarUsuarios, crearOActualizarUsuario } = require('../controllers/auth.controller');
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');
const { obtenerEstadoWhatsApp, despacharColaManual } = require('../utils/whatsappService');

// ==========================================
// 1. RUTAS PÚBLICAS / KIOSCO PORTÓN
// ==========================================
// Autenticación de los 3 perfiles: Auxiliar, TOECE, Administracion
router.post('/auth/login', login);

// Escáner QR en portón (12:30 - 12:45 Puntual | 12:45:01 - 13:30 Tardanza)
router.post('/registrar-asistencia', registrarAsistenciaQR);

// Escáner QR de Portería (verificar si el alumno tiene permiso de salida autorizado hoy)
router.post('/permisos/verificar-porteria', verificarPermisoPorteria);

// ==========================================
// 2. RUTAS PARA TODOS LOS PERFILES (Auxiliar, TOECE, Administracion)
// ==========================================
// Resumen estadístico y consulta de quiénes faltaron, no faltaron y llegaron tarde
router.get('/asistencia/resumen', verificarToken, obtenerResumenDashboard);

// Corregir / Justificar asistencia (Tardanza Justificada, Falta Justificada, etc.) para Auxiliares, TOECE y Admin
router.put('/asistencia/corregir', verificarToken, verificarRol(['Auxiliar', 'TOECE', 'Administracion']), corregirEstadoAsistencia);

// Exportar consolidado semanal / mensual a Excel (.xlsx) con sábana de días y orden alfabético
router.get('/asistencia/exportar-excel', verificarToken, exportarReporteConsolidadoExcel);

// Módulo independiente de Permisos de Salida mediante QR (Auxiliar, TOECE, Administracion)
router.get('/permisos/buscar/:dni', verificarToken, verificarRol(['Auxiliar', 'TOECE', 'Administracion']), buscarEstudiantePorQrPermiso);
router.get('/permisos', verificarToken, verificarRol(['Auxiliar', 'TOECE', 'Administracion']), listarPermisosSalida);
router.post('/permisos', verificarToken, verificarRol(['Auxiliar', 'TOECE', 'Administracion']), registrarPermisoSalida);
router.delete('/permisos/:id', verificarToken, verificarRol(['Auxiliar', 'TOECE', 'Administracion']), eliminarPermisoSalida);

// Agente Analítico de IA (Gemini 2.5 Flash + Function Calling)
router.post('/chat', verificarToken, async (req, res) => {
    try {
        const { mensaje, fecha } = req.body;

        if (!mensaje) {
            return res.status(400).json({ error: "Debes enviar un mensaje al agente." });
        }

        console.log(`[${req.usuario.rol} (${req.usuario.username}) consulta a IA]: ${mensaje}`);

        const respuestaAgente = await procesarMensajeTOECE(mensaje, fecha);
        return res.json({ respuesta: respuestaAgente });

    } catch (error) {
        console.error("Error de la IA:", error);
        return res.status(500).json({ error: "El agente tuvo un problema al procesar tu solicitud. Verifica tu GEMINI_API_KEY en el archivo .env." });
    }
});

// ==========================================
// 3. RUTAS DE TOECE Y ADMINISTRACIÓN
// ==========================================
// Cierre manual de portón (marca Falta a los que no asistieron y envía WhatsApp)
router.post('/asistencia/cerrar-porton', verificarToken, verificarRol(['TOECE', 'Administracion']), cerrarPortonManual);

// Directorio de estudiantes de 5to y actualización de celular de apoderados y permiso 1:00 PM
router.get('/estudiantes', verificarToken, verificarRol(['TOECE', 'Administracion']), listarEstudiantes);
router.put('/estudiantes/:dni/telefono', verificarToken, verificarRol(['TOECE', 'Administracion']), actualizarTelefonoApoderado);
router.put('/estudiantes/:dni/permiso', verificarToken, verificarRol(['TOECE', 'Administracion']), cambiarPermisoEstudiante);

// Estado de conexión de WhatsApp y QR para vincular desde la web
router.get('/whatsapp/estado', verificarToken, verificarRol(['TOECE', 'Administracion']), (req, res) => {
    return res.status(200).json(obtenerEstadoWhatsApp());
});

// Despacho manual inmediato de las alertas de WhatsApp encoladas
router.post('/whatsapp/despachar', verificarToken, verificarRol(['TOECE', 'Administracion']), async (req, res) => {
    try {
        const resultado = await despacharColaManual();
        return res.status(200).json({
            mensaje: `Despacho de WhatsApp procesado. Mensajes enviados: ${resultado.procesados}.`,
            ...resultado
        });
    } catch (err) {
        return res.status(500).json({ error: 'Error al despachar la cola de WhatsApp.' });
    }
});

// ==========================================
// 4. RUTAS EXCLUSIVAS DE ADMINISTRACIÓN
// ==========================================
// Agregar un estudiante nuevo o reactivarlo
router.post('/estudiantes', verificarToken, verificarRol(['Administracion']), crearEstudiante);

// Cambiar o trasladar de sección a un estudiante (ej. 5to A -> 5to C)
router.put('/estudiantes/:dni/seccion', verificarToken, verificarRol(['Administracion']), cambiarSeccionEstudiante);

// Dar de baja (TRASLADADO / RETIRADO) o reactivar (DEFINITIVA) a un estudiante
router.put('/estudiantes/:dni/estado', verificarToken, verificarRol(['Administracion']), cambiarEstadoEstudiante);

// Importar / sincronizar lista de estudiantes desde archivo Excel SIAGIE (.xlsx / .xls)
router.post('/estudiantes/importar-excel', verificarToken, verificarRol(['Administracion']), importarExcelWeb);

// Gestión de usuarios y perfiles del sistema
router.get('/usuarios', verificarToken, verificarRol(['Administracion']), listarUsuarios);
router.post('/usuarios', verificarToken, verificarRol(['Administracion']), crearOActualizarUsuario);

module.exports = router;
