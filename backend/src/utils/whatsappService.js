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

// Pausa anti-bloqueo: 20 segundos exactos entre cada mensaje enviado
const SEGUNDOS_ENTRE_MENSAJES = parseInt(process.env.WHATSAPP_SEGUNDOS_ENTRE_MENSAJES || '20', 10);
const PAUSA_MS = SEGUNDOS_ENTRE_MENSAJES * 1000;

const rutaAuth = path.resolve(__dirname, '../../.wwebjs_auth');

/**
 * Elimina archivos candado (SingletonLock / SingletonCookie / SingletonSocket)
 * que Chromium deja huérfanos cuando AWS apaga la instancia EC2 de golpe.
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
    estadoTexto = `Conectado y listo (Envío espaciado a 1 mensaje cada ${SEGUNDOS_ENTRE_MENSAJES} seg)`;
    console.log(`✅ Servicio de WhatsApp (TOECE) conectado. Cola activa: 1 mensaje cada ${SEGUNDOS_ENTRE_MENSAJES} segundos.`);
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

/**
 * Procesa la cola de mensajes de forma secuencial:
 * Envía un mensaje -> Espera 20 segundos -> Envía el siguiente.
 * Evita bloqueos de Meta/WhatsApp por exceso de velocidad o spam.
 */
const procesarCola = async () => {
    if (procesandoCola || colaMensajes.length === 0) return;

    procesandoCola = true;

    if (!clienteListo) {
        console.warn(`⚠️ [WhatsApp] Hay ${colaMensajes.length} mensajes en cola, pero WhatsApp aún no está listo.`);
        procesandoCola = false;
        return;
    }

    while (colaMensajes.length > 0 && clienteListo) {
        const item = colaMensajes.shift();

        try {
            const numberId = await client.getNumberId(item.telefonoNormalizado);

            if (!numberId) {
                console.warn(`⚠️ El número ${item.telefonoNormalizado} (${item.alumno}) no tiene cuenta activa de WhatsApp.`);
            } else {
                await client.sendMessage(numberId._serialized, item.mensaje, { sendSeen: false });
                console.log(`📨 [WhatsApp Enviado] A: ${item.telefonoNormalizado} | Alumno: ${item.alumno} | Restan en cola: ${colaMensajes.length}`);
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

        // Si aún quedan mensajes en cola, esperar exactamente 20 segundos antes del siguiente
        if (colaMensajes.length > 0) {
            console.log(`⏳ [Anti-Bloqueo] Esperando ${SEGUNDOS_ENTRE_MENSAJES} segundos antes del siguiente mensaje...`);
            await new Promise(resolve => setTimeout(resolve, PAUSA_MS));
        }
    }

    procesandoCola = false;
};

const encolarMensajeWhatsApp = (telefono, nombreAlumno, mensaje, estado, horaRegistro) => {
    const telefonoNormalizado = normalizarTelefonoPeru(telefono);

    if (!telefonoNormalizado) {
        console.warn(`⚠️ Teléfono inválido omitido para el alumno ${nombreAlumno}: "${telefono}"`);
        return false;
    }

    colaMensajes.push({
        telefonoNormalizado,
        alumno: nombreAlumno,
        mensaje,
        estado,
        horaRegistro: horaRegistro || new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    });

    console.log(`📥 [Cola WhatsApp] Mensaje agregado para ${nombreAlumno} (${estado}). Total en cola: ${colaMensajes.length}`);

    if (!procesandoCola) {
        setImmediate(() => procesarCola());
    }
    return true;
};

/**
 * Encola una alerta de asistencia y activa el despachador de 20 segundos.
 */
const enviarAlertaWhatsApp = (telefono, nombreAlumno, hora, estado = 'Tardanza', fecha = '') => {
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

    encolarMensajeWhatsApp(telefono, nombreAlumno, mensaje, estado, hora);
};

/**
 * Encola un aviso de Permiso de Salida autorizado al apoderado.
 */
const enviarAlertaSalidaWhatsApp = (telefono, nombreAlumno, horaSalida, motivo, fecha, detalle = '') => {
    const detalleTxt = detalle ? `\n📝 *Detalle:* ${detalle}` : '';
    const mensaje =
        `*I.E. NUESTRA SEÑORA DE LAS MERCEDES*\n` +
        `_Auxiliaría / TOECE - Permiso de Salida_\n\n` +
        `Estimado padre de familia / apoderado, se le informa que se ha autorizado el retiro del plantel de su menor hijo(a):\n\n` +
        `👤 *Estudiante:* ${nombreAlumno}\n` +
        `📅 *Fecha:* ${fecha}\n` +
        `🚪 *Hora de salida:* ${horaSalida}\n` +
        `📌 *Motivo:* ${motivo}${detalleTxt}\n\n` +
        `_Registro oficial mediante código QR institucional._`;

    return encolarMensajeWhatsApp(telefono, nombreAlumno, mensaje, 'Permiso Salida', horaSalida);
};

const inicializarWhatsApp = () => {
    limpiarCandadosChromium();
    console.log(`🔄 Inicializando cliente de WhatsApp (LocalAuth) con cola de ${SEGUNDOS_ENTRE_MENSAJES}s...`);
    client.initialize().catch(err => {
        estadoTexto = `Error al iniciar navegador WhatsApp: ${err.message}`;
        console.error('❌ No se pudo inicializar el cliente de WhatsApp:', err.message);
    });
};

const obtenerEstadoWhatsApp = () => ({
    conectado: clienteListo,
    estado: estadoTexto,
    qrDataUrl: clienteListo ? null : ultimoQrDataUrl,
    colaPendiente: colaMensajes.length,
    segundosEntreMensajes: SEGUNDOS_ENTRE_MENSAJES,
    enProceso: procesandoCola
});

const despacharColaManual = async () => {
    if (!procesandoCola) {
        procesarCola();
    }
    return { procesados: colaMensajes.length, estado: 'en_marcha' };
};

module.exports = {
    inicializarWhatsApp,
    enviarAlertaWhatsApp,
    enviarAlertaSalidaWhatsApp,
    obtenerEstadoWhatsApp,
    despacharColaManual,
    procesarCola
};
