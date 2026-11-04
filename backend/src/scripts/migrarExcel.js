// src/scripts/migrarExcel.js
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { inicializarBaseDeDatos } = require('../config/initDb');
const { extraerEstudiantesDeBufferExcel } = require('../utils/excelParser');

async function migrarSIAGIE() {
    try {
        await inicializarBaseDeDatos();

        const rutaArchivo = path.join(__dirname, '../../ListadoEstudiantes.xlsx');
        console.log(`📂 Leyendo archivo SIAGIE desde: ${rutaArchivo}`);

        const buffer = fs.readFileSync(rutaArchivo);
        const { estudiantes } = extraerEstudiantesDeBufferExcel(buffer);

        if (estudiantes.length === 0) {
            console.log('❌ No se encontraron alumnos válidos para migrar.');
            process.exit(0);
        }

        const valoresInsertar = estudiantes.map(e => [
            e.dni,
            e.nombres,
            e.apellidos,
            e.grado,
            e.seccion,
            e.telefono_apoderado,
            e.estado_matricula
        ]);

        const sql = `
            INSERT INTO Estudiante (dni, nombres, apellidos, grado, seccion, telefono_apoderado, estado_matricula)
            VALUES ?
            ON DUPLICATE KEY UPDATE
                nombres = VALUES(nombres),
                apellidos = VALUES(apellidos),
                grado = VALUES(grado),
                seccion = VALUES(seccion),
                telefono_apoderado = COALESCE(VALUES(telefono_apoderado), Estudiante.telefono_apoderado),
                estado_matricula = VALUES(estado_matricula)
        `;

        const [resultado] = await pool.query(sql, [valoresInsertar]);
        const activos = estudiantes.filter(e => e.estado_matricula === 'DEFINITIVA').length;
        const bajas = estudiantes.length - activos;

        console.log('==================================================');
        console.log(`✅ MIGRACIÓN / SINCRONIZACIÓN SIAGIE COMPLETADA`);
        console.log(`👥 Alumnos Activos (DEFINITIVA): ${activos}`);
        console.log(`🚫 Alumnos en Baja (TRASLADADO/RETIRADO): ${bajas}`);
        console.log(`📊 Filas procesadas en MySQL: ${resultado.affectedRows}`);
        console.log('==================================================');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error crítico durante la migración:', error.message);
        process.exit(1);
    }
}

migrarSIAGIE();
