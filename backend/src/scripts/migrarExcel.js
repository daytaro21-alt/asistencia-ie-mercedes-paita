// src/scripts/migrarExcel.js
const xlsx = require('xlsx');
const path = require('path');
const pool = require('../config/db');

async function migrarSIAGIE() {
    try {
        const rutaArchivo = path.join(__dirname, '../../ListadoEstudiantes.xlsx');
        console.log(`📂 Leyendo archivo SIAGIE desde: ${rutaArchivo}`);

        const workbook = xlsx.readFile(rutaArchivo);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const filas = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        let valoresInsertar = [];
        let omitidos = 0;

        // Los datos de los alumnos empiezan a partir de la fila índice 4 (fila 5 visual en Excel)
        const filasAlumnos = filas.slice(4);

        for (const fila of filasAlumnos) {
            const grado = String(fila[2] || '').trim().toUpperCase(); // Columna B
            const seccion = String(fila[3] || '').trim().toUpperCase(); // Columna C
            const dni = String(fila[8] || '').trim(); // Columna H
            const apellidoPaterno = String(fila[13] || '').trim(); // Columna N
            const apellidoMaterno = String(fila[17] || '').trim(); // Columna R
            const nombres = String(fila[20] || '').trim(); // Columna U
            const estadoMatricula = String(fila[26] || '').trim().toUpperCase(); // Columna AA

            // Validar que exista el DNI de 8 dígitos y que la matrícula sea DEFINITIVA
            if (!dni || !/^\d{8}$/.test(dni) || estadoMatricula !== 'DEFINITIVA') {
                if (dni) omitidos++;
                continue;
            }

            // Concatenar apellidos manteniendo el formato oficial del colegio
            const apellidos = `${apellidoPaterno} ${apellidoMaterno}`.trim();

            if (!nombres || !apellidos || !grado) continue;

            valoresInsertar.push([dni, nombres, apellidos, grado, seccion]);
        }

        // Evitar duplicados en memoria por DNI
        const unicosMap = new Map();
        valoresInsertar.forEach(item => unicosMap.set(item[0], item));
        valoresInsertar = Array.from(unicosMap.values());

        if (valoresInsertar.length === 0) {
            console.log('❌ No se encontraron alumnos válidos para migrar.');
            process.exit(0);
        }

        // Inserción masiva en MySQL (Bulk Upsert)
        const sql = `
            INSERT INTO Estudiante (dni, nombres, apellidos, grado, seccion)
            VALUES ?
            ON DUPLICATE KEY UPDATE
                nombres = VALUES(nombres),
                apellidos = VALUES(apellidos),
                grado = VALUES(grado),
                seccion = VALUES(seccion)
        `;

        const [resultado] = await pool.query(sql, [valoresInsertar]);

        console.log('==================================================');
        console.log(`✅ MIGRACIÓN COMPLETADA CON ÉXITO`);
        console.log(`👥 Alumnos de QUINTO migrados/actualizados: ${valoresInsertar.length}`);
        console.log(`🚫 Alumnos omitidos (Trasladados): ${omitidos}`);
        console.log(`📊 Filas afectadas en MySQL: ${resultado.affectedRows}`);
        console.log('==================================================');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error crítico durante la migración:', error.message);
        process.exit(1);
    }
}

migrarSIAGIE();