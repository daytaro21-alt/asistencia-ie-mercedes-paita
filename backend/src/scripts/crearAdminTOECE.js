// src/scripts/crearAdminTOECE.js
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function seedAdmin() {
    try {
        const username = process.env.ADMIN_USER || 'admin_toece';
        const passwordPlano = process.env.ADMIN_PASS || 'Mercedes2026*';

        // Obtenemos la definición de la columna 'rol' por si es un ENUM estricto en MySQL
        const [columnas] = await pool.query("SHOW COLUMNS FROM usuario LIKE 'rol'");
        let rolPorDefecto = 'Admin';

        if (columnas.length > 0 && columnas[0].Type.startsWith('enum')) {
            // Extrae el primer valor permitido del ENUM (ej. enum('Admin','Auxiliar') -> 'Admin')
            const coincidencias = columnas[0].Type.match(/'([^']+)'/);
            if (coincidencias && coincidencias[1]) {
                rolPorDefecto = coincidencias[1];
            }
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(passwordPlano, salt);

        const [existentes] = await pool.query(
            'SELECT id_usuario FROM usuario WHERE username = ?',
            [username]
        );

        if (existentes.length > 0) {
            await pool.query(
                'UPDATE usuario SET password = ?, rol = ? WHERE username = ?',
                [passwordHash, rolPorDefecto, username]
            );
            console.log(`✅ Usuario existente actualizado: "${username}" [Rol: ${rolPorDefecto}]`);
        } else {
            await pool.query(
                'INSERT INTO usuario (username, password, rol) VALUES (?, ?, ?)',
                [username, passwordHash, rolPorDefecto]
            );
            console.log(`✅ Usuario TOECE creado con éxito: "${username}" [Rol: ${rolPorDefecto}]`);
        }

        console.log('==================================================');
        console.log(`🔑 Credenciales de acceso para el panel TOECE:`);
        console.log(`   Username: ${username}`);
        console.log(`   Password: ${passwordPlano}`);
        console.log('==================================================');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creando usuario semilla:', error.message);
        process.exit(1);
    }
}

seedAdmin();
