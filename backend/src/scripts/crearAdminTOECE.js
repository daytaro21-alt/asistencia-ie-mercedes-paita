// src/scripts/crearAdminTOECE.js
const { inicializarBaseDeDatos } = require('../config/initDb');

async function seedPerfiles() {
    try {
        await inicializarBaseDeDatos();
        const passwordPlano = process.env.ADMIN_PASS || 'Mercedes2026*';

        console.log('==============================================================');
        console.log('🔑 CREDENCIALES DE LOS 3 PERFILES DEL SISTEMA:');
        console.log('--------------------------------------------------------------');
        console.log(`1. PERFIL ADMINISTRACIÓN -> Usuario: admin        | Clave: ${passwordPlano}`);
        console.log(`2. PERFIL TOECE          -> Usuario: admin_toece  | Clave: ${passwordPlano}`);
        console.log(`3. PERFIL AUXILIAR       -> Usuario: auxiliar     | Clave: ${passwordPlano}`);
        console.log('==============================================================');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creando perfiles semilla:', error.message);
        process.exit(1);
    }
}

seedPerfiles();
