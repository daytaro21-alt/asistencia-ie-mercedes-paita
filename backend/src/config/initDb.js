// src/config/initDb.js
const bcrypt = require('bcryptjs');
const pool = require('./db');

/**
 * Asegura que la estructura de tablas soporte:
 * 1. Columna `estado_matricula` ('DEFINITIVA', 'TRASLADADO', 'RETIRADO') en `Estudiante`
 * 2. Columna `rol` flexible ('Administracion', 'TOECE', 'Auxiliar') y `nombre_completo` en `usuario`
 * 3. Usuarios semilla para los 3 perfiles institucionales
 */
async function inicializarBaseDeDatos() {
    try {
        // 1. Verificar columna estado_matricula y hora_limite_puntual en Estudiante
        const [colsEstudiante] = await pool.query("SHOW COLUMNS FROM Estudiante LIKE 'estado_matricula'");
        if (colsEstudiante.length === 0) {
            await pool.query(
                "ALTER TABLE Estudiante ADD COLUMN estado_matricula VARCHAR(20) NOT NULL DEFAULT 'DEFINITIVA' AFTER telefono_apoderado"
            );
            console.log("✅ [DB Mig] Columna 'estado_matricula' añadida a la tabla Estudiante.");
        }

        const [colsPermiso] = await pool.query("SHOW COLUMNS FROM Estudiante LIKE 'hora_limite_puntual'");
        if (colsPermiso.length === 0) {
            await pool.query(
                "ALTER TABLE Estudiante ADD COLUMN hora_limite_puntual VARCHAR(10) DEFAULT NULL AFTER estado_matricula"
            );
            console.log("✅ [DB Mig] Columna 'hora_limite_puntual' (Permiso 1:00 PM) añadida a la tabla Estudiante.");
        }

        // 2. Asegurar que la columna 'rol' en 'usuario' sea VARCHAR(30) (por si era ENUM antiguo)
        const [colsUsuarioRol] = await pool.query("SHOW COLUMNS FROM usuario LIKE 'rol'");
        if (colsUsuarioRol.length > 0 && colsUsuarioRol[0].Type.toLowerCase().startsWith('enum')) {
            await pool.query("ALTER TABLE usuario MODIFY COLUMN rol VARCHAR(30) NOT NULL DEFAULT 'TOECE'");
            console.log("✅ [DB Mig] Columna 'rol' en tabla usuario actualizada a VARCHAR(30).");
        }

        const [colsUsuarioNombre] = await pool.query("SHOW COLUMNS FROM usuario LIKE 'nombre_completo'");
        if (colsUsuarioNombre.length === 0) {
            await pool.query("ALTER TABLE usuario ADD COLUMN nombre_completo VARCHAR(100) DEFAULT NULL AFTER username");
            console.log("✅ [DB Mig] Columna 'nombre_completo' añadida a la tabla usuario.");
        }

        // 3. Crear / asegurar los perfiles requeridos con sus credenciales oficiales
        const salt = await bcrypt.genSalt(10);

        const usuariosSemilla = [
            { username: 'admin', nombre_completo: 'Oficina de Administración', clavePlana: 'Mercedes_admin_2026*', rol: 'Administracion' },
            { username: 'admin_toece', nombre_completo: 'Coordinación de TOECE', clavePlana: 'Mercedes_toece_2026*', rol: 'TOECE' },
            { username: 'auxiliar_uno', nombre_completo: 'Auxiliar de Educación - Turno Tarde 1', clavePlana: 'Mercedes_auxiliar1_2026*', rol: 'Auxiliar' },
            { username: 'auxiliar_dos', nombre_completo: 'Auxiliar de Educación - Turno Tarde 2', clavePlana: 'Mercedes_auxiliar2_2026*', rol: 'Auxiliar' },
            { username: 'auxiliar_tres', nombre_completo: 'Auxiliar de Educación - Turno Tarde 3', clavePlana: 'Mercedes_auxiliar3_2026*', rol: 'Auxiliar' }
        ];

        for (const u of usuariosSemilla) {
            const passwordHash = await bcrypt.hash(u.clavePlana, salt);
            const [existe] = await pool.query('SELECT id_usuario, rol FROM usuario WHERE username = ? LIMIT 1', [u.username]);
            if (existe.length === 0) {
                await pool.query(
                    'INSERT INTO usuario (username, nombre_completo, password, rol) VALUES (?, ?, ?, ?)',
                    [u.username, u.nombre_completo, passwordHash, u.rol]
                );
                console.log(`👤 [Perfil Creado] Usuario: "${u.username}" | Rol: ${u.rol}`);
            } else {
                // Actualiza la contraseña y rol oficiales si ya existía
                await pool.query(
                    'UPDATE usuario SET password = ?, rol = ?, nombre_completo = COALESCE(nombre_completo, ?) WHERE username = ?',
                    [passwordHash, u.rol, u.nombre_completo, u.username]
                );
                console.log(`🔄 [Perfil Actualizado] Usuario: "${u.username}" | Rol: ${u.rol}`);
            }
        }

        console.log('✅ Perfiles oficiales verificados y actualizados.');
    } catch (error) {
        console.error('⚠️ Aviso al verificar migraciones automáticas de BD:', error.message);
    }
}

module.exports = { inicializarBaseDeDatos };
