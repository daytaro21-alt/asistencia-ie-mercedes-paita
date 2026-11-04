// index.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const pool = require('./src/config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares de producción
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '15mb' }));

// Importar rutas y servicios
const rutasAPI = require('./src/routes/api');
const { inicializarWhatsApp } = require('./src/utils/whatsappService');
const { iniciarProgramadorCierrePorton } = require('./src/controllers/asistencia.controller');
const { inicializarBaseDeDatos } = require('./src/config/initDb');

// Prefijo /api
app.use('/api', rutasAPI);

// Servir Frontend estático de producción (Kiosco QR + Panel TOECE / Auxiliar / Administración)
app.use(express.static(path.resolve(__dirname, '../frontend')));

// Healthcheck para balanceadores Cloud (Render / AWS / Railway)
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        return res.status(200).json({
            status: 'OK',
            servicio: 'API Asistencia QR - I.E. Nuestra Señora de las Mercedes',
            timestamp: new Date().toISOString(),
            timezone: process.env.TZ || 'America/Lima'
        });
    } catch (error) {
        return res.status(503).json({ status: 'ERROR', db: 'Disconnected' });
    }
});

// Ruta raíz sirve el frontend si existe, o mensaje de estado
app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../frontend/index.html'));
});

// Iniciar el servidor escuchando en 0.0.0.0 para compatibilidad con contenedores Cloud
const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    await inicializarBaseDeDatos();
    iniciarProgramadorCierrePorton();
    if (process.env.ENABLE_WHATSAPP !== 'false') {
        inicializarWhatsApp();
    }
});

// Cierre limpio (Graceful Shutdown) ante señales de Render / AWS EC2 (SIGTERM / SIGINT)
const cerrarServidor = async (signal) => {
    console.log(`\n🛑 Señal ${signal} recibida. Cerrando conexiones limpiamente...`);
    server.close(async () => {
        try {
            await pool.end();
            console.log('✅ Pool de MySQL cerrado correctamente.');
            process.exit(0);
        } catch (err) {
            console.error('❌ Error al cerrar el pool de MySQL:', err.message);
            process.exit(1);
        }
    });
};

process.on('SIGTERM', () => cerrarServidor('SIGTERM'));
process.on('SIGINT', () => cerrarServidor('SIGINT'));
