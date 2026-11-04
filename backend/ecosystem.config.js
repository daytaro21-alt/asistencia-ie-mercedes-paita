// backend/ecosystem.config.js
module.exports = {
    apps: [
        {
            name: 'asistencia-mercedes',
            script: './index.js',
            instances: 1, // Obligatorio 1 sola instancia porque Puppeteer/LocalAuth bloquea el directorio .wwebjs_auth
            exec_mode: 'fork',
            autorestart: true,
            watch: false,
            max_memory_restart: '950M',
            env: {
                NODE_ENV: 'production',
                PORT: 3000,
                TZ: 'America/Lima'
            },
            error_file: './logs/pm2-error.log',
            out_file: './logs/pm2-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true
        }
    ]
};
