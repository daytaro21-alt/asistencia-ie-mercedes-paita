// src/config/db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const poolConfig = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Evita que la nube (Railway/RDS) corte la conexión por inactividad (ECONNRESET)
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    //Fuerza que las columnas DATE se lean como string 'YYYY-MM-DD' sin conversión UTC
    dateStrings: true
};

// Si en el futuro activas DB_SSL=true en el .env de producción (requerido en Aiven/RDS/TiDB)
if (process.env.DB_SSL === 'true') {
    poolConfig.ssl = {
        rejectUnauthorized: false
    };
}

const pool = mysql.createPool(poolConfig);

pool.getConnection()
    .then(connection => {
        console.log(`✅ Conexión exitosa a MySQL [${process.env.DB_HOST}:${poolConfig.port}/${process.env.DB_NAME}]`);
        connection.release();
    })
    .catch(err => {
        console.error('❌ Error conectando a la base de datos:', err.message);
    });

module.exports = pool;