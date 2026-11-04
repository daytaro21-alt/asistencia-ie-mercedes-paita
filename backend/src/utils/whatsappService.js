// src/utils/whatsappService.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');

let clienteListo = false;
const colaMensajes = [];
let procesandoCola = false;

// Configuración de instancia única con persistencia de sesión local
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'bot-toece-mercedes',
        dataPath: path.resolve(__dirname, '../../.wwebjs_auth')
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--disable-gpu'
        ]
    }
});

let procesandoAuth = false;

client.on('qr', (qr) => {
    console.log('\n==================================================');
    console.log('📱 ESCANEA ESTE CÓDIGO QR CON EL WHATSAPP DE TOECE:');
    console.log('==================================================');
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    // Pequeña espera de estabilización post-navegación del DOM de WhatsApp Web
    await new Promise(resolve => setTimeout(resolve, 2500));
    clienteListo = true;
    console.log('✅ Servicio de WhatsApp (TOECE) conectado y listo para enviar alertas.');
    procesarCola(); // Drena mensajes pendientes si se encolaron durante el arranque
});

client.on('authenticated', () => {
    if (!procesandoAuth) {
        procesandoAuth = true;
        console.log('🔐 Sesión de WhatsApp autenticada (LocalAuth).');
    }
});

client.on('auth_failure', (msg) => {
    clienteListo = false;
    console.error('❌ Error de autenticación en WhatsApp:', msg);
});

client.on('disconnected', (reason) => {
    clienteListo = false;
    console.warn('⚠️ WhatsApp desconectado:', reason);
});

/**
 * Normaliza un número telefónico al estándar de Perú (51 + 9 dígitos)
 * @param {string} telefono
 * @returns {string|null} Número formateado o null si es inválido
 */
const normalizarTelefonoPeru = (telefono) => {
    if (!telefono) return null;
    const soloDigitos = String(telefono).replace(/\D/g, '');

    if (soloDigitos.length === 9 && soloDigitos.startsWith('9')) {
        return `51${soloDigitos}`;
    }
    if (soloDigitos.length === 11 && soloDigitos.startsWith('519')) {
        return soloDigitos;
    }
    return null;
};

/**
 * Worker asíncrono con Jitter (3.5s a 6.5s) para evitar bloqueos por spam en Meta
 */
const procesarCola = async () => {
    if (procesandoCola || !clienteListo || colaMensajes.length === 0) return;

    procesandoCola = true;

    while (colaMensajes.length > 0 && clienteListo) {
        const item = colaMensajes.shift();

        try {
            const numberId = await client.getNumberId(item.telefonoNormalizado);

            if (!numberId) {
                console.warn(`⚠️ El número ${item.telefonoNormalizado} (${item.alumno}) no tiene cuenta activa de WhatsApp.`);
            } else {
                // sendSeen: false evita fallos de evaluación en el DOM en las versiones recientes de WhatsApp Web
                await client.sendMessage(numberId._serialized, item.mensaje, { sendSeen: false });
                console.log(`📨 Alerta WhatsApp enviada a ${item.telefonoNormalizado} [Alumno: ${item.alumno}]`);
            }
        } catch (error) {
            // Si el frame de Puppeteer se recargó en caliente, reencolamos hasta 2 veces
            item.reintentos = (item.reintentos || 0) + 1;
            if (error.message.includes('detached Frame') && item.reintentos <= 2) {
                console.warn(`🔄 Reintentando envío a ${item.telefonoNormalizado} tras recarga interna de frame (${item.reintentos}/2)...`);
                colaMensajes.unshift(item);
                await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
                console.error(`❌ Error enviando WhatsApp a ${item.telefonoNormalizado}:`, error.message);
            }
        }

        // Pausa aleatoria entre 3500ms y 6500ms antes del siguiente envío
        if (colaMensajes.length > 0) {
            const delayMs = Math.floor(Math.random() * (6500 - 3500 + 1)) + 3500;
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    procesandoCola = false;
};

/**
 * Encola una alerta de asistencia (Tardanza/Falta) sin bloquear el hilo principal
 * @param {string} telefono - Teléfono del apoderado
 * @param {string} nombreAlumno - Nombres y apellidos del estudiante
 * @param {string} hora - Hora del registro (HH:mm:ss)
 * @param {string} estado - 'Tardanza' o 'Falta'
 * @param {string} fecha - Fecha (YYYY-MM-DD)
 */
const enviarAlertaWhatsApp = (telefono, nombreAlumno, hora, estado = 'Tardanza', fecha = '') => {
    const telefonoNormalizado = normalizarTelefonoPeru(telefono);

    if (!telefonoNormalizado) {
        console.warn(`⚠️ Teléfono inválido omitido para el alumno ${nombreAlumno}: "${telefono}"`);
        return;
    }

    const emojiEstado = estado === 'Tardanza' ? '⏰' : '🚨';
    const detalleHora = hora ? `\n🕒 *Hora de ingreso:* ${hora}` : '';
    const detalleFecha = fecha ? `\n📅 *Fecha:* ${fecha}` : '';

    const mensaje =
        `*I.E. NUESTRA SEÑORA DE LAS MERCEDES*\n` +
        `_Oficina de TOECE - Control de Asistencia_\n\n` +
        `Estimado padre de familia / apoderado, le informamos el registro de asistencia de su menor hijo(a):\n\n` +
        `👤 *Estudiante:* ${nombreAlumno}` +
        `${detalleFecha}` +
        `${detalleHora}\n` +
        `${emojiEstado} *Estado:* ${estado.toUpperCase()}\n\n` +
        `_Este es un mensaje automático del sistema de control por código QR._`;

    colaMensajes.push({
        telefonoNormalizado,
        alumno: nombreAlumno,
        mensaje
    });

    // Dispara el worker en background
    setImmediate(() => procesarCola());
};

const inicializarWhatsApp = () => {
    console.log('🔄 Inicializando cliente de WhatsApp (LocalAuth)...');
    client.initialize().catch(err => {
        console.error('❌ No se pudo inicializar el cliente de WhatsApp:', err.message);
    });
};

module.exports = {
    inicializarWhatsApp,
    enviarAlertaWhatsApp
};
