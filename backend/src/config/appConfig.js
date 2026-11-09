// src/config/appConfig.js
let modoSimulacion = process.env.MODO_SIMULACION === 'true';

const esModoSimulacion = () => modoSimulacion;

const establecerModoSimulacion = (valor) => {
    modoSimulacion = Boolean(valor);
    console.log(`[Config] Modo Simulación establecido en: ${modoSimulacion ? 'ACTIVADO (Prueba)' : 'DESACTIVADO (Producción)'}`);
    return modoSimulacion;
};

module.exports = {
    esModoSimulacion,
    establecerModoSimulacion
};
