// index.js
require('dotenv').config(); // Carga las variables del archivo .env
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares (Configuraciones base)
app.use(cors()); // Permite que el frontend web (HTML/JS) se comunique con este backend
app.use(express.json()); // Permite a Express leer datos en formato JSON

// Importar rutas
const rutasAPI = require('./src/routes/api');

// Usar rutas
// Todo lo que esté en api.js tendrá el prefijo /api
app.use('/api', rutasAPI);

// Ruta de prueba para saber si el servidor enciende
app.get('/', (req, res) => {
    res.send('Servidor del Sistema de Asistencia - Nuestra Señora de las Mercedes - ¡Activo!');
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});