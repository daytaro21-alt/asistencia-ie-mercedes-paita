// src/utils/excelParser.js
const xlsx = require('xlsx');

const normalizarTexto = (txt) =>
    String(txt || '')
        .trim()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

const normalizarSeccion = (rawSec, fallback = 'A') => {
    const limpio = normalizarTexto(rawSec).replace(/5TO|QUINTO|SECCION|SEC|GRADO|["'°º\-]/g, '').trim();
    const match = limpio.match(/\b([A-Z])\b/) || limpio.match(/^([A-Z])$/);
    return match ? match[1] : (limpio.slice(0, 2) || fallback);
};

const normalizarGrado = (rawGrado) => {
    const limpio = normalizarTexto(rawGrado);
    if (!limpio || limpio.includes('5') || limpio.includes('QUINTO')) return 'QUINTO';
    return limpio;
};

const normalizarEstadoMatricula = (rawEstado) => {
    const limpio = normalizarTexto(rawEstado);
    if (!limpio) return 'DEFINITIVA';
    if (limpio.includes('TRASLAD')) return 'TRASLADADO';
    if (limpio.includes('RETIR') || limpio.includes('BAJA') || limpio.includes('INACTIV')) return 'RETIRADO';
    return 'DEFINITIVA';
};

/**
 * Analiza un Buffer de archivo Excel (.xlsx, .xls, .csv) de SIAGIE o listado escolar
 * y extrae todos los estudiantes detectando automáticamente las columnas.
 */
function extraerEstudiantesDeBufferExcel(buffer, seccionPorDefecto = 'A') {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const unicosMap = new Map();
    let filasOmitidasSinDni = 0;

    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const filas = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        if (!filas || filas.length === 0) continue;

        // 1. Buscar la fila de encabezados en las primeras 20 filas
        let filaHeaderIdx = -1;
        let mapaCols = {
            grado: -1,
            seccion: -1,
            dni: -1,
            apePat: -1,
            apeMat: -1,
            apellidos: -1,
            nombres: -1,
            estado: -1,
            telefono: -1
        };

        for (let i = 0; i < Math.min(20, filas.length); i++) {
            const fila = filas[i];
            if (!Array.isArray(fila)) continue;

            const textos = fila.map(celda => normalizarTexto(celda));
            const tieneDni = textos.some(t =>
                t.includes('NUMERO DE DOCUMENTO') ||
                t.includes('NRO DOCUMENTO') ||
                t === 'DNI' ||
                t === 'DOCUMENTO' ||
                t.includes('DNI ESTUDIANTE')
            );
            const tieneNombre = textos.some(t => t.includes('NOMBRE') || t.includes('APELLIDO') || t.includes('ESTUDIANTE') || t.includes('ALUMNO'));

            if (tieneDni || (tieneNombre && textos.filter(Boolean).length >= 3)) {
                filaHeaderIdx = i;
                textos.forEach((h, colIdx) => {
                    if (!h) return;
                    if (h === 'GRADO' || h.includes('GRADO')) mapaCols.grado = colIdx;
                    else if (h === 'SECCION' || h.includes('SECCION') || h === 'SEC' || h === 'SEC.') mapaCols.seccion = colIdx;
                    else if (h.includes('NUMERO DE DOCUMENTO') || h.includes('NRO DOCUMENTO') || h === 'DNI' || (h.includes('DOCUMENTO') && !h.includes('TIPO'))) {
                        mapaCols.dni = colIdx;
                    } else if (h.includes('PATERNO') || h.includes('PRIMER APELLIDO')) mapaCols.apePat = colIdx;
                    else if (h.includes('MATERNO') || h.includes('SEGUNDO APELLIDO')) mapaCols.apeMat = colIdx;
                    else if (h === 'APELLIDOS' || h === 'APELLIDO' || h.includes('APELLIDOS Y NOMBRES') || h === 'ESTUDIANTE' || h === 'ALUMNO') {
                        mapaCols.apellidos = colIdx;
                    } else if (h === 'NOMBRES' || h === 'NOMBRE') {
                        mapaCols.nombres = colIdx;
                    } else if (h.includes('ESTADO') || h.includes('MATRICULA') || h.includes('SITUACION')) {
                        mapaCols.estado = colIdx;
                    } else if (h.includes('TELEFONO') || h.includes('CELULAR') || h.includes('WHATSAPP') || h.includes('APODERADO')) {
                        mapaCols.telefono = colIdx;
                    }
                });
                break;
            }
        }

        // Fallback a índices oficiales de reporte SIAGIE si no detectó cabecera explícita
        const inicioDatos = filaHeaderIdx >= 0 ? filaHeaderIdx + 1 : 0;
        if (mapaCols.dni === -1) {
            mapaCols = {
                grado: 1,
                seccion: 2,
                dni: 7,
                apePat: 12,
                apeMat: 16,
                apellidos: -1,
                nombres: 19,
                estado: 25,
                telefono: -1
            };
        }

        for (let r = inicioDatos; r < filas.length; r++) {
            const fila = filas[r];
            if (!Array.isArray(fila) || fila.every(c => String(c || '').trim() === '')) continue;

            // Extraer DNI
            let rawDni = mapaCols.dni >= 0 ? String(fila[mapaCols.dni] || '').trim() : '';
            let soloDigitosDni = rawDni.replace(/\D/g, '');
            if (soloDigitosDni.length === 7 && /^\d+$/.test(rawDni)) {
                soloDigitosDni = soloDigitosDni.padStart(8, '0');
            }

            // Si en la columna esperada no hay DNI de 8 dígitos, buscar en la fila una celda con 8 dígitos exactos
            if (!/^\d{8}$/.test(soloDigitosDni)) {
                const celdaDni = fila.find(c => /^\d{8}$/.test(String(c || '').trim()));
                if (celdaDni) {
                    soloDigitosDni = String(celdaDni).trim();
                } else {
                    filasOmitidasSinDni++;
                    continue;
                }
            }

            const grado = normalizarGrado(mapaCols.grado >= 0 ? fila[mapaCols.grado] : 'QUINTO');
            const seccion = normalizarSeccion(
                mapaCols.seccion >= 0 ? fila[mapaCols.seccion] : sheetName,
                seccionPorDefecto
            );

            let apellidos = '';
            let nombres = '';

            if (mapaCols.apePat >= 0 || mapaCols.apeMat >= 0) {
                const pat = mapaCols.apePat >= 0 ? String(fila[mapaCols.apePat] || '').trim() : '';
                const mat = mapaCols.apeMat >= 0 ? String(fila[mapaCols.apeMat] || '').trim() : '';
                apellidos = `${pat} ${mat}`.trim();
                nombres = mapaCols.nombres >= 0 ? String(fila[mapaCols.nombres] || '').trim() : '';
            } else if (mapaCols.apellidos >= 0 && mapaCols.nombres >= 0) {
                apellidos = String(fila[mapaCols.apellidos] || '').trim();
                nombres = String(fila[mapaCols.nombres] || '').trim();
            } else if (mapaCols.apellidos >= 0 && mapaCols.nombres === -1) {
                // Formato "APELLIDOS, NOMBRES" o "APELLIDO1 APELLIDO2 NOMBRES"
                const completo = String(fila[mapaCols.apellidos] || '').trim();
                if (completo.includes(',')) {
                    const partes = completo.split(',');
                    apellidos = partes[0].trim();
                    nombres = partes.slice(1).join(' ').trim();
                } else {
                    const partes = completo.split(/\s+/);
                    apellidos = partes.slice(0, 2).join(' ');
                    nombres = partes.slice(2).join(' ') || completo;
                }
            }

            apellidos = apellidos.toUpperCase();
            nombres = nombres.toUpperCase();

            if (!apellidos || !nombres) {
                filasOmitidasSinDni++;
                continue;
            }

            const estado_matricula = normalizarEstadoMatricula(
                mapaCols.estado >= 0 ? fila[mapaCols.estado] : 'DEFINITIVA'
            );

            let telefono_apoderado = null;
            if (mapaCols.telefono >= 0 && fila[mapaCols.telefono]) {
                const telLimpio = String(fila[mapaCols.telefono]).replace(/\D/g, '');
                if (/^(51)?9\d{8}$/.test(telLimpio)) {
                    telefono_apoderado = telLimpio;
                }
            }

            unicosMap.set(soloDigitosDni, {
                dni: soloDigitosDni,
                nombres,
                apellidos,
                grado,
                seccion,
                telefono_apoderado,
                estado_matricula
            });
        }
    }

    return {
        estudiantes: Array.from(unicosMap.values()),
        filasOmitidasSinDni
    };
}

module.exports = {
    extraerEstudiantesDeBufferExcel,
    normalizarSeccion,
    normalizarGrado,
    normalizarEstadoMatricula
};
