#!/usr/bin/env bash
# ==============================================================================
# SCRIPT DE APROVISIONAMIENTO AUTOMÁTICO — AWS EC2 / DIGITALOCEAN (Ubuntu 22.04/24.04)
# Proyecto: Sistema Automatizado de Asistencia QR - I.E. Nuestra Señora de las Mercedes
# Desarrollador: Dayron Iván Talledo Rojas
# ==============================================================================

set -e

echo "🚀 [1/7] Configurando Zona Horaria Oficial (America/Lima)..."
sudo timedatectl set-timezone America/Lima

echo "💾 [2/7] Creando 2GB de Memoria SWAP (Previene cierres de Chromium en instancias de 1GB/2GB RAM)..."
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "✅ Swap de 2GB activado."
else
    echo "✅ Swap ya existente."
fi

echo "📦 [3/7] Actualizando paquetes e instalando dependencias nativas de Chromium (Puppeteer / whatsapp-web.js)..."
sudo apt-get update -y
sudo apt-get install -y \
    ca-certificates fonts-liberation libasound2t64 libatk-bridge2.0-0t64 libatk1.0-0t64 \
    libc6 libcairo2 libcups2t64 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 \
    libgcc-s1 libglib2.0-0t64 libgtk-3-0t64 libnspr4 libnss3 libpango-1.0-0 \
    libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
    libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 \
    libxss1 libxtst6 lsb-release wget xdg-utils git nginx || \
sudo apt-get install -y \
    ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \
    libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 \
    libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 \
    libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
    libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 \
    libxss1 libxtst6 lsb-release wget xdg-utils git nginx

echo "🟢 [4/7] Instalando Node.js 20 LTS y PM2..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
sudo npm install -g pm2

echo "🗄️ [5/7] Instalando y configurando MySQL Server local (Opcional si no usas AWS RDS)..."
if ! command -v mysql &> /dev/null; then
    sudo apt-get install -y mysql-server
    sudo systemctl enable mysql
    sudo systemctl start mysql
fi

echo "🌐 [6/7] Configurando Nginx como Reverse Proxy (Puerto 80 -> localhost:3000)..."
sudo tee /etc/nginx/sites-available/asistencia-mercedes > /dev/null <<EOF
server {
    listen 80;
    server_name _;

    client_max_body_size 5M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/asistencia-mercedes /etc/nginx/sites-enabled/asistencia-mercedes
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

echo "=============================================================================="
echo "✅ SERVIDOR VPS (AWS EC2 / UBUNTU) APROVISIONADO CON ÉXITO"
echo "=============================================================================="
echo "Siguientes pasos dentro de la carpeta 'backend/':"
echo "  1. npm install --omit=dev"
echo "  2. Configurar archivo .env (y crear tablas en MySQL con database/schema.sql)"
echo "  3. npm run migrar && npm run seed:admin"
echo "  4. pm2 start ecosystem.config.js"
echo "  5. pm2 logs asistencia-mercedes  (Para ver y escanear el QR de WhatsApp)"
echo "  6. pm2 save && pm2 startup       (Para auto-arranque 24/7 si el VPS se reinicia)"
echo "=============================================================================="
