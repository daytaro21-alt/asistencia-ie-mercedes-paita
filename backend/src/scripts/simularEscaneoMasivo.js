// src/scripts/simularEscaneoMasivo.js
/**
 * Script de prueba masiva segura (Simula que los ~257 alumnos activos escanearon su carnet QR).
 * NO envía alertas de WhatsApp reales a los apoderados.
 *
 * Uso:
 *   node backend/src/scripts/simularEscaneoMasivo.js                 -> Simula ~85% Puntual, ~15% Tardanza hoy
 *   node backend/src/scripts/simularEscaneoMasivo.js --todos-puntual -> Simula 100% Puntual hoy
 *   node backend/src/scripts/simularEscaneoMasivo.js --con-faltas    -> Simula ~80% Puntual, ~12% Tardanza, ~8% Falta
 *   node backend/src/scripts/simularEscaneoMasivo.js --fecha=2026-11-11 -> Usa una fecha específica
 *   node backend/src/scripts/simularEscaneoMasivo.js --limpiar       -> Borra la asistencia simulada de la fecha
 */
const pool = require('../config/db');

const obtenerFechaHoyPeru = () => {
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Lima',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
};

const pad2 = (n) => String(n).padStart(2, '0');

const generarHoraAleatoria = (tipo) => {
    if (tipo === 'Puntual') {
        // Entre 12:30:05 y 12:44:55
        const min = 30 + Math.floor(Math.random() * 15);
        const seg = Math.floor(Math.random() * 50) + 5;
        return `12:${pad2(min)}:${pad2(seg)}`;
    }
    if (tipo === 'Tardanza') {
        // Entre 12:46:00 y 13:20:59
        const totalMin = 46 + Math.floor(Math.random() * 35); // 46..80 -> 12:46 .. 13:20
        const hora = totalMin >= 60 ? 13 : 12;
        const min = totalMin >= 60 ? totalMin - 60 : totalMin;
        const seg = Math.floor(Math.random() * 60);
        return `${pad2(hora)}:${pad2(min)}:${pad2(seg)}`;
    }
    return '13:30:00'; // Falta (cierre de portón)
};

async function ejecutarSimulacion() {
    const args = process.argv.slice(2);
    const modoLimpiar = args.includes('--limpiar');
    const todosPuntual = args.includes('--todos-puntual');
    const conFaltas = args.includes('--con-faltas');
    const argFecha = args.find(a => a.startsWith('--fecha='));
    const fechaObjetivo = argFecha ? argFecha.split('=')[1].trim() : obtenerFechaHoyPeru();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaObjetivo)) {
        console.error('❌ Formato de fecha inválido. Usa --fecha=YYYY-MM-DD');
        process.exit(1);
    }

    try {
        if (modoLimpiar) {
            const [resDel] = await pool.query('DELETE FROM Asistencia WHERE fecha = ?', [fechaObjetivo]);
            console.log(`\n🧹 [Limpieza Completada] Se eliminaron ${resDel.affectedRows} registros de asistencia de la fecha ${fechaObjetivo}.`);
            console.log('✅ La base de datos quedó limpia.\n');
            process.exit(0);
        }

        console.log('\n======================================================================');
        console.log('🧪 INICIANDO SIMULACIÓN DE ESCANEO MASIVO QR (SIN ENVÍOS WHATSAPP)');
        console.log('======================================================================');
        console.log(`📅 Fecha de prueba: ${fechaObjetivo}`);

        // 1. Obtener todo el padrón activo de 5to de Secundaria
        const [estudiantes] = await pool.query(
            `SELECT id_estudiante, dni, nombres, apellidos, grado, seccion, hora_limite_puntual
             FROM Estudiante
             WHERE COALESCE(estado_matricula, 'DEFINITIVA') = 'DEFINITIVA'
             ORDER BY seccion ASC, apellidos ASC, nombres ASC`
        );

        if (estudiantes.length === 0) {
            console.warn('⚠️ No se encontraron estudiantes activos (DEFINITIVA) en la tabla Estudiante.');
            process.exit(1);
        }

        console.log(`👥 Total de estudiantes activos encontrados: ${estudiantes.length}`);

        // 2. Limpiar registros previos de esa misma fecha para simular el escaneo desde 0
        await pool.query('DELETE FROM Asistencia WHERE fecha = ?', [fechaObjetivo]);

        // 3. Simular ráfagas concurrentes de escaneo (lotes de 5 lecturas simultáneas, como múltiples lectores en portón)
        const inicioMs = Date.now();
        const conteoPorSeccion = {};
        let totalPuntual = 0;
        let totalTardanza = 0;
        let totalFalta = 0;

        const tamañoLote = 5;
        for (let i = 0; i < estudiantes.length; i += tamañoLote) {
            const lote = estudiantes.slice(i, i + tamañoLote);
            await Promise.all(lote.map(async (est) => {
                let estado = 'Puntual';
                if (!todosPuntual) {
                    const r = Math.random();
                    if (conFaltas) {
                        if (r < 0.08) estado = 'Falta';
                        else if (r < 0.20) estado = 'Tardanza';
                    } else {
                        if (r < 0.15) estado = 'Tardanza';
                    }
                }

                // Respetar permiso de 1:00 PM si le tocara tardanza antes de la 1:00
                const hora = generarHoraAleatoria(estado);

                if (estado === 'Puntual') totalPuntual++;
                else if (estado === 'Tardanza') totalTardanza++;
                else totalFalta++;

                if (!conteoPorSeccion[est.seccion]) {
                    conteoPorSeccion[est.seccion] = { total: 0, Puntual: 0, Tardanza: 0, Falta: 0 };
                }
                conteoPorSeccion[est.seccion].total++;
                conteoPorSeccion[est.seccion][estado]++;

                await pool.query(
                    'INSERT INTO Asistencia (estudiante_id, fecha, hora_ingreso, estado) VALUES (?, ?, ?, ?)',
                    [est.id_estudiante, fechaObjetivo, hora, estado]
                );
            }));
        }

        const duracionMs = Date.now() - inicioMs;

        // 4. Prueba rápida de bloqueo por doble escaneo (ER_DUP_ENTRY) con el primer estudiante
        let bloqueoDobleOk = false;
        try {
            await pool.query(
                'INSERT INTO Asistencia (estudiante_id, fecha, hora_ingreso, estado) VALUES (?, ?, ?, ?)',
                [estudiantes[0].id_estudiante, fechaObjetivo, '12:40:00', 'Puntual']
            );
        } catch (dupErr) {
            if (dupErr.code === 'ER_DUP_ENTRY') {
                bloqueoDobleOk = true;
            }
        }

        console.log(`\n⚡ Simulación completada en ${duracionMs} ms (${(duracionMs / estudiantes.length).toFixed(2)} ms por alumno).`);
        console.log(`🛡️ Prueba de bloqueo ante doble escaneo (ER_DUP_ENTRY): ${bloqueoDobleOk ? '✅ CORRECTO (Bloqueado)' : '❌ FALLÓ'}`);
        console.log('🔕 Alertas de WhatsApp reales: 0 enviadas (Omitidas por seguridad durante simulación).\n');

        console.log('📊 RESUMEN POR SECCIÓN:');
        console.log('----------------------------------------------------------------------');
        console.log('Sección   | Total | Puntual | Tardanza | Falta');
        console.log('----------------------------------------------------------------------');
        Object.keys(conteoPorSeccion).sort().forEach(sec => {
            const c = conteoPorSeccion[sec];
            console.log(`5to "${sec}"   |  ${String(c.total).padStart(3)}  |   ${String(c.Puntual).padStart(3)}   |   ${String(c.Tardanza).padStart(3)}    |  ${String(c.Falta).padStart(3)}`);
        });
        console.log('----------------------------------------------------------------------');
        console.log(`TOTALES   |  ${String(estudiantes.length).padStart(3)}  |   ${String(totalPuntual).padStart(3)}   |   ${String(totalTardanza).padStart(3)}    |  ${String(totalFalta).padStart(3)}`);
        console.log('======================================================================\n');

        console.log('👀 SIGUIENTES PASOS PARA VERIFICAR EN LA WEB:');
        console.log(`   1. Entra a tu panel web y selecciona la fecha ${fechaObjetivo}.`);
        console.log('   2. Verifica que las tarjetas KPI muestran todos los registros.');
        console.log('   3. Prueba "Imprimir PDF del Día" (orden alfabético separado de 5to A a 5to H).');
        console.log('   4. Prueba "Descargar Excel (Mes / Semana)".');
        console.log('\n🧹 CUANDO TERMINES DE PROBAR, LIMPIA LOS DATOS DE PRUEBA CON:');
        console.log(`   node backend/src/scripts/simularEscaneoMasivo.js --limpiar --fecha=${fechaObjetivo}\n`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error durante la simulación masiva:', error);
        process.exit(1);
    }
}

ejecutarSimulacion();
