// src/scripts/generarQRsQuinto.js
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const pool = require('../config/db');

// Ajusta este valor según cómo se haya migrado desde el SIAGIE ('Quinto', '5', '5to', '5°')
const GRADO_PILoto = 'Quinto';

async function generarQRsPiloto() {
    try {
        console.log(`⏳ Extrayendo alumnos de ${GRADO_PILoto} desde MySQL...`);

        const [estudiantes] = await pool.query(
            `SELECT dni, nombres, apellidos, grado, seccion 
             FROM Estudiante 
             WHERE grado = ? OR grado LIKE '5%'
             ORDER BY seccion ASC, apellidos ASC`,
            [GRADO_PILoto]
        );

        if (estudiantes.length === 0) {
            console.warn('⚠️ No se encontraron alumnos para 5to grado. Verifica cómo está escrito el campo "grado" en tu tabla Estudiante.');
            process.exit(0);
        }

        const dirBase = path.join(__dirname, '../../qrs_impresion/5to_Secundaria');
        fs.mkdirSync(dirBase, { recursive: true });

        let generados = 0;

        for (const est of estudiantes) {
            const seccionLimpia = (est.seccion || 'SIN_SECCION').trim().toUpperCase();
            const dirSeccion = path.join(dirBase, `Seccion_${seccionLimpia}`);

            if (!fs.existsSync(dirSeccion)) {
                fs.mkdirSync(dirSeccion, { recursive: true });
            }

            // Limpiamos caracteres especiales del nombre para el sistema de archivos
            const nombreArchivo = `${est.dni}_${est.apellidos}_${est.nombres}`
                .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_\-\s]/g, '')
                .replace(/\s+/g, '_');

            const rutaCompleta = path.join(dirSeccion, `${nombreArchivo}.png`);

            // Nivel 'H' (High): soporta hasta 30% de desgaste físico o manchas en el carnet impreso
            await QRCode.toFile(rutaCompleta, est.dni.trim(), {
                errorCorrectionLevel: 'H',
                type: 'png',
                width: 400,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });

            generados++;
        }

        console.log(`✅ Proceso completado: ${generados} códigos QR de 5to generados en: ${dirBase}`);
        process.exit(0);

    } catch (error) {
        console.error('❌ Error generando códigos QR:', error);
        process.exit(1);
    }
}

generarQRsPiloto();