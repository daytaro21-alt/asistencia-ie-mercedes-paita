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

        // La fila 1 está vacía, la fila 2 (índice 1) son los encabezados y desde la fila 3 (índice 2) están los alumnos
        const filasAlumnos = filas.slice(2);

        for (const fila of filasAlumnos) {
            const grado = String(fila[1] || '').trim().toUpperCase(); // Columna B (índice 1)
            const seccion = String(fila[2] || '').trim().toUpperCase(); // Columna C (índice 2)
            const dni = String(fila[7] || '').trim(); // Columna H (índice 7)
            const apellidoPaterno = String(fila[12] || '').trim(); // Columna M (índice 12)
            const apellidoMaterno = String(fila[16] || '').trim(); // Columna Q (índice 16)
            const nombres = String(fila[19] || '').trim(); // Columna T (índice 19)
            const estadoMatricula = String(fila[25] || '').trim().toUpperCase(); // Columna Z (índice 25)

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