// src/controllers/agenteController.js
const { GoogleGenAI } = require("@google/genai");
const {
    consultarTardanzas,
    obtenerEstadisticasAsistencia,
    declaracionConsultarTardanzas,
    declaracionResumenEstadistico
} = require("../utils/iaSkills");

/**
 * Obtiene una fecha en formato YYYY-MM-DD en la zona horaria America/Lima
 * desplazada en `diasOffset` (ej. 0 = hoy, -1 = ayer, -2 = anteayer).
 */
const obtenerFechaPeruConOffset = (diasOffset = 0) => {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + diasOffset);
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Lima',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(fecha);
};

/**
 * Extrae una fecha YYYY-MM-DD desde lenguaje natural:
 * Soporta "ayer", "anteayer", "hoy", formato DD/MM/YYYY y formato YYYY-MM-DD
 */
const extraerFechaDeTexto = (texto) => {
    const t = texto.toLowerCase();

    if (t.includes('anteayer') || t.includes('antes de ayer')) {
        return obtenerFechaPeruConOffset(-2);
    }
    if (t.includes('ayer')) {
        return obtenerFechaPeruConOffset(-1);
    }

    // Formato YYYY-MM-DD
    const matchISO = t.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (matchISO) return matchISO[1];

    // Formato DD/MM/YYYY o DD-MM-YYYY
    const matchLatam = t.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
    if (matchLatam) {
        const dia = matchLatam[1].padStart(2, '0');
        const mes = matchLatam[2].padStart(2, '0');
        const anio = matchLatam[3];
        return `${anio}-${mes}-${dia}`;
    }

    return undefined; // Por defecto hoy
};

const obtenerConfigAgente = () => {
    const hoyPeru = obtenerFechaPeruConOffset(0);
    const ayerPeru = obtenerFechaPeruConOffset(-1);

    return {
        systemInstruction:
            `Eres el asistente analítico oficial del área de TOECE de la I.E. Nuestra Señora de las Mercedes. ` +
            `La fecha actual en Perú (America/Lima) es ${hoyPeru} y ayer fue ${ayerPeru}. ` +
            `El piloto actual controla a los 257 estudiantes de 5to de Secundaria (Secciones A a la H) en el turno tarde ` +
            `(Ingreso puntual: 12:30 a 12:45, Tardanza: 12:45:01 a 13:30, Cierre de portón y Falta: 13:30). ` +
            `Si el usuario pregunta por "ayer", pasa fecha="${ayerPeru}" en las herramientas. ` +
            `Responde de forma ejecutiva, precisa y estructurada usando exclusivamente datos reales de las herramientas SQL disponibles.`,
        tools: [{
            functionDeclarations: [
                declaracionConsultarTardanzas,
                declaracionResumenEstadistico
            ]
        }],
    };
};

/**
 * Motor Analítico SQL Local de Respaldo (High-Availability Fallback)
 */
async function generarReporteRespaldoSQL(mensajeUsuario, fechaContextual) {
    const texto = mensajeUsuario.toLowerCase();

    // Prioriza fecha expresada en el mensaje ("ayer", "2026-11-03", "03/11/2026") o la fecha seleccionada en el Dashboard
    const fechaExtraida = extraerFechaDeTexto(texto) || fechaContextual;

    // Detectar si menciona una sección específica (ej. "5to a", "seccion b", "sección c")
    const matchSeccion = texto.match(/(?:5to|quinto|secci[oó]n)\s*["']?([a-h])\b/i);
    const seccion = matchSeccion ? matchSeccion[1].toUpperCase() : undefined;

    // Caso 1: Pide resumen estadístico, porcentajes o comparativa por secciones
    if (texto.includes('estad') || texto.includes('resumen') || texto.includes('porcentaje') || (texto.includes('secciones') && !seccion)) {
        const stats = await obtenerEstadisticasAsistencia(fechaExtraida);
        if (stats.error || !stats.desglose_secciones) {
            return "No se pudieron obtener las estadísticas en este momento.";
        }

        let totalPadron = 0, totPuntual = 0, totTardanza = 0, totFalta = 0, totSinReg = 0;
        const lineas = stats.desglose_secciones.map(s => {
            const p = Number(s.puntuales || 0);
            const t = Number(s.tardanzas || 0);
            const f = Number(s.faltas || 0);
            const sr = Number(s.sin_registro || 0);
            const tot = Number(s.total_alumnos || 0);
            totalPadron += tot; totPuntual += p; totTardanza += t; totFalta += f; totSinReg += sr;
            return `• **5to "${s.seccion}"** (${tot} est.): 🟢 Puntuales: **${p}** | 🟡 Tardanzas: **${t}** | 🔴 Faltas: **${f}** | ⏳ Pendientes: **${sr}**`;
        });

        return `📊 **Reporte Estadístico de Asistencia — 5to de Secundaria (${stats.fecha})**\n` +
               `**Totales Generales (${totalPadron} alumnos):**\n` +
               `• Puntuales (≤12:45): **${totPuntual}**\n` +
               `• Tardanzas (>12:45): **${totTardanza}**\n` +
               `• Faltas (Cierre 13:30): **${totFalta}**\n` +
               `• Sin registro aún: **${totSinReg}**\n\n` +
               `**Desglose por Sección (A - H):**\n` +
               lineas.join('\n');
    }

    // Caso 2: Consulta de Faltas, Tardanzas (incl. Justificadas) o Puntuales nominales
    let estadoFiltro = undefined;
    if ((texto.includes('falta') || texto.includes('inasistencia')) && texto.includes('justificad')) {
        estadoFiltro = 'Falta Justificada';
    } else if ((texto.includes('tarde') || texto.includes('tardanza')) && texto.includes('justificad')) {
        estadoFiltro = 'Tardanza Justificada';
    } else if (texto.includes('falta') || texto.includes('inasistencia') || texto.includes('ausente')) {
        estadoFiltro = 'Falta';
    } else if (texto.includes('tarde') || texto.includes('tardanza')) {
        estadoFiltro = 'Tardanza';
    } else if (texto.includes('puntual') || texto.includes('temprano')) {
        estadoFiltro = 'Puntual';
    }

    const data = await consultarTardanzas('QUINTO', seccion, fechaExtraida, estadoFiltro);
    if (data.error) return data.error;

    const tituloEstado = estadoFiltro ? estadoFiltro.toUpperCase() + 'S' : 'INCIDENCIAS (TARDANZAS Y FALTAS)';
    const filtroSecTxt = seccion ? `5to Sección "${seccion}"` : 'Todas las secciones (A - H)';

    if (!data.registros || data.registros.length === 0) {
        return `✅ **Reporte TOECE (${data.fecha}):**\nNo se encontraron registros de **${tituloEstado}** para **${filtroSecTxt}**.`;
    }

    const listado = data.registros.slice(0, 30).map((r, i) =>
        `${i + 1}. **${r.apellidos}, ${r.nombres}** (DNI: ${r.dni}) — 5to "${r.seccion}" • **${r.estado}** [${r.hora_ingreso}]`
    ).join('\n');

    const extra = data.registros.length > 30 ? `\n...y ${data.registros.length - 30} estudiantes más.` : '';

    return `📋 **Reporte de ${tituloEstado} — ${filtroSecTxt} (${data.fecha})**\n` +
           `Total encontrados: **${data.total_incidencias}** estudiante(s).\n\n` +
           listado + extra;
}

async function procesarMensajeTOECE(mensajeUsuario, fechaContextual) {
    try {
        const apiKey = (process.env.GEMINI_API_KEY || '').trim();
        // Las API Keys válidas de Google AI Studio empiezan con "AIza"
        if (!apiKey || !apiKey.startsWith('AIza')) {
            return await generarReporteRespaldoSQL(mensajeUsuario, fechaContextual);
        }

        const ai = new GoogleGenAI({ apiKey });
        const configAgente = obtenerConfigAgente();
        const contents = [{ role: 'user', parts: [{ text: mensajeUsuario }] }];

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents,
            config: configAgente
        });

        if (response.functionCalls && response.functionCalls.length > 0) {
            const llamada = response.functionCalls[0];
            let resultadoBD = null;

            if (llamada.name === "consultar_tardanzas") {
                const { grado, seccion, fecha, estado } = llamada.args;
                const fechaFinal = fecha || extraerFechaDeTexto(mensajeUsuario) || fechaContextual;
                resultadoBD = await consultarTardanzas(grado, seccion, fechaFinal, estado);
            } else if (llamada.name === "obtener_estadisticas_asistencia") {
                const { fecha } = llamada.args;
                const fechaFinal = fecha || extraerFechaDeTexto(mensajeUsuario) || fechaContextual;
                resultadoBD = await obtenerEstadisticasAsistencia(fechaFinal);
            }

            if (resultadoBD) {
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

                const respuestaFinal = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents,
                    config: configAgente
                });

                return respuestaFinal.text;
            }
        }

        return response.text;
    } catch (error) {
        console.warn("⚠️ [Agente IA] Usando motor SQL directo de alta disponibilidad:", error.message);
        return await generarReporteRespaldoSQL(mensajeUsuario, fechaContextual);
    }
}

module.exports = { procesarMensajeTOECE };
