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
        // 1. Verificar columna estado_matricula en Estudiante
        const [colsEstudiante] = await pool.query("SHOW COLUMNS FROM Estudiante LIKE 'estado_matricula'");
        if (colsEstudiante.length === 0) {
            await pool.query(
                "ALTER TABLE Estudiante ADD COLUMN estado_matricula VARCHAR(20) NOT NULL DEFAULT 'DEFINITIVA' AFTER telefono_apoderado"
            );
            console.log("✅ [DB Mig] Columna 'estado_matricula' añadida a la tabla Estudiante.");
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

        // 3. Crear / asegurar los 3 perfiles por defecto
        const passwordDefecto = process.env.ADMIN_PASS || 'Mercedes2026*';
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(passwordDefecto, salt);

        const usuariosSemilla = [
            { username: 'admin', nombre_completo: 'Oficina de Administración', rol: 'Administracion' },
            { username: 'admin_toece', nombre_completo: 'Coordinación de TOECE', rol: 'TOECE' },
            { username: 'auxiliar', nombre_completo: 'Auxiliar de Educación', rol: 'Auxiliar' }
        ];

        for (const u of usuariosSemilla) {
            const [existe] = await pool.query('SELECT id_usuario, rol FROM usuario WHERE username = ? LIMIT 1', [u.username]);
            if (existe.length === 0) {
                await pool.query(
                    'INSERT INTO usuario (username, nombre_completo, password, rol) VALUES (?, ?, ?, ?)',
                    [u.username, u.nombre_completo, passwordHash, u.rol]
                );
                console.log(`👤 [Perfil Creado] Usuario: "${u.username}" | Rol: ${u.rol}`);
            } else if (u.username === 'admin_toece' && existe[0].rol === 'Admin') {
                // Normalizar el usuario histórico admin_toece al perfil TOECE (o mantener acceso)
                await pool.query(
                    'UPDATE usuario SET rol = ?, nombre_completo = COALESCE(nombre_completo, ?) WHERE username = ?',
                    ['TOECE', u.nombre_completo, u.username]
                );
            }
        }

        console.log('✅ Perfiles verificados: Administracion (admin), TOECE (admin_toece), Auxiliar (auxiliar).');
    } catch (error) {
        console.error('⚠️ Aviso al verificar migraciones automáticas de BD:', error.message);
    }
}

module.exports = { inicializarBaseDeDatos };
