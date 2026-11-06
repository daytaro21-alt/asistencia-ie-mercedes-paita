// src/utils/whatsappService.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

let clienteListo = false;
let ultimoQrDataUrl = null;
let estadoTexto = 'Iniciando servicio de WhatsApp...';
const colaMensajes = [];
let procesandoCola = false;

const rutaAuth = path.resolve(__dirname, '../../.wwebjs_auth');

/**
 * Elimina archivos candado (SingletonLock / SingletonCookie / SingletonSocket)
 * que Chromium deja huérfanos cuando AWS Academy apaga la instancia EC2 de golpe.
 */
const limpiarCandadosChromium = () => {
    try {
        const dirSesion = path.join(rutaAuth, 'session-bot-toece-mercedes');
        const archivosCandado = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'lockfile'];
        for (const nombre of archivosCandado) {
            const p = path.join(dirSesion, nombre);
            try {
                if (fs.existsSync(p) || fs.lstatSync(p)) {
                    fs.rmSync(p, { force: true });
                    console.log(`🧹 [WhatsApp] Candado huérfano eliminado: ${nombre}`);
                }
            } catch (_) {}
        }
    } catch (_) {}
};

// Configuración de instancia única con persistencia de sesión local
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'bot-toece-mercedes',
        dataPath: rutaAuth
    }),
    puppeteer: {
        headless: true,
        protocolTimeout: 180000,
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

client.on('qr', async (qr) => {
    clienteListo = false;
    estadoTexto = 'Esperando escaneo de código QR desde el celular';
    try {
        ultimoQrDataUrl = await QRCode.toDataURL(qr, { width: 280, margin: 2 });
    } catch (_) {}

    console.log('\n==================================================');
    console.log('📱 ESCANEA ESTE CÓDIGO QR CON EL WHATSAPP DE TOECE:');
    console.log('==================================================');
    qrcodeTerminal.generate(qr, { small: true });
});

client.on('ready', async () => {
    await new Promise(resolve => setTimeout(resolve, 2500));
    clienteListo = true;
    ultimoQrDataUrl = null;
    estadoTexto = 'Conectado y listo para enviar alertas';
    console.log('✅ Servicio de WhatsApp (TOECE) conectado y listo para enviar alertas.');
    procesarCola();
});

client.on('authenticated', () => {
    ultimoQrDataUrl = null;
    estadoTexto = 'Autenticado. Sincronizando sesión...';
    if (!procesandoAuth) {
        procesandoAuth = true;
        console.log('🔐 Sesión de WhatsApp autenticada (LocalAuth).');
    }
});

client.on('auth_failure', (msg) => {
    clienteListo = false;
    estadoTexto = `Error de autenticación: ${msg}`;
    console.error('❌ Error de autenticación en WhatsApp:', msg);
});

client.on('disconnected', (reason) => {
    clienteListo = false;
    procesandoAuth = false;
    estadoTexto = `Desconectado (${reason})`;
    console.warn('⚠️ WhatsApp desconectado:', reason);
});

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
                await client.sendMessage(numberId._serialized, item.mensaje, { sendSeen: false });
                console.log(`📨 Alerta WhatsApp enviada a ${item.telefonoNormalizado} [Alumno: ${item.alumno}]`);
            }
        } catch (error) {
            item.reintentos = (item.reintentos || 0) + 1;
            if (error.message.includes('detached Frame') && item.reintentos <= 2) {
                console.warn(`🔄 Reintentando envío a ${item.telefonoNormalizado} tras recarga interna de frame (${item.reintentos}/2)...`);
                colaMensajes.unshift(item);
                await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
                console.error(`❌ Error enviando WhatsApp a ${item.telefonoNormalizado}:`, error.message);
            }
        }

        if (colaMensajes.length > 0) {
            const delayMs = Math.floor(Math.random() * (6500 - 3500 + 1)) + 3500;
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    procesandoCola = false;
};

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

    setImmediate(() => procesarCola());
};

const inicializarWhatsApp = () => {
    limpiarCandadosChromium();
    console.log('🔄 Inicializando cliente de WhatsApp (LocalAuth)...');
    client.initialize().catch(err => {
        estadoTexto = `Error al iniciar navegador WhatsApp: ${err.message}`;
        console.error('❌ No se pudo inicializar el cliente de WhatsApp:', err.message);
    });
};

const obtenerEstadoWhatsApp = () => ({
    conectado: clienteListo,
    estado: estadoTexto,
    qrDataUrl: clienteListo ? null : ultimoQrDataUrl,
    colaPendiente: colaMensajes.length
});

module.exports = {
    inicializarWhatsApp,
    enviarAlertaWhatsApp,
    obtenerEstadoWhatsApp
};
