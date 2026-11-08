// src/scripts/crearAdminTOECE.js
const { inicializarBaseDeDatos } = require('../config/initDb');

async function seedPerfiles() {
    try {
        await inicializarBaseDeDatos();

        console.log('========================================================================');
        console.log('🔑 CREDENCIALES OFICIALES DE USUARIOS (I.E. NUESTRA SEÑORA DE LAS MERCEDES):');
        console.log('------------------------------------------------------------------------');
        console.log('1. ADMINISTRACIÓN: Usuario: admin         | Clave: Mercedes_admin_2026*');
        console.log('2. TOECE:          Usuario: admin_toece   | Clave: Mercedes_toece_2026*');
        console.log('3. AUXILIAR 1:     Usuario: auxiliar_uno  | Clave: Mercedes_auxiliar1_2026*');
        console.log('4. AUXILIAR 2:     Usuario: auxiliar_dos  | Clave: Mercedes_auxiliar2_2026*');
        console.log('5. AUXILIAR 3:     Usuario: auxiliar_tres | Clave: Mercedes_auxiliar3_2026*');
        console.log('========================================================================');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creando perfiles semilla:', error.message);
        process.exit(1);
    }
}

seedPerfiles();
