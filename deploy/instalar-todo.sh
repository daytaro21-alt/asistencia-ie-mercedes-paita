#!/usr/bin/env bash
# ==============================================================================
# INSTALADOR COMPLETO (1 SOLO COMANDO) — AWS EC2 Ubuntu 24.04 LTS
# Proyecto: Sistema de Asistencia QR - I.E. Nuestra Señora de las Mercedes
#
# Uso (como usuario "ubuntu", SIN sudo):
#   cd ~/Sistema && bash deploy/instalar-todo.sh
#
# Corrige los problemas vistos en el servidor de laboratorio:
#   - Chrome de Puppeteer instalado para el usuario correcto (no /root)
#   - PM2 corriendo como "ubuntu" y con auto-arranque tras reinicio (systemd)
#   - Túnel HTTPS de Cloudflare también gestionado por PM2
# ==============================================================================
set -e

if [ "$(id -u)" -eq 0 ]; then
    echo "❌ No ejecutes este script con sudo. Úsalo así: bash deploy/instalar-todo.sh"
    exit 1
fi

DIR_PROYECTO="$(cd "$(dirname "$0")/.." && pwd)"
DIR_BACKEND="$DIR_PROYECTO/backend"
DB_PASS="${DB_PASS:-Mercedes$(openssl rand -hex 6)}"

echo "=============================================================="
echo " 1/8  Aprovisionando servidor (timezone, swap, Node 20, MySQL, Nginx)"
echo "=============================================================="
bash "$DIR_PROYECTO/deploy/setup-ubuntu-ec2.sh"

echo "=============================================================="
echo " 2/8  Creando base de datos y usuario MySQL"
echo "=============================================================="
sudo mysql < "$DIR_PROYECTO/deploy/schema.sql"
sudo mysql -e "CREATE USER IF NOT EXISTS 'admin_mercedes'@'localhost' IDENTIFIED BY '${DB_PASS}';
               ALTER USER 'admin_mercedes'@'localhost' IDENTIFIED BY '${DB_PASS}';
               GRANT ALL PRIVILEGES ON asistencia_mercedes.* TO 'admin_mercedes'@'localhost';
               FLUSH PRIVILEGES;"

echo "=============================================================="
echo " 3/8  Generando archivo .env de producción"
echo "=============================================================="
cd "$DIR_BACKEND"
if [ ! -f .env ]; then
    cp .env.example .env
    sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_PASS}|" .env
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" .env
    if [ -n "$GEMINI_API_KEY" ]; then
        sed -i "s|^GEMINI_API_KEY=.*|GEMINI_API_KEY=${GEMINI_API_KEY}|" .env
    fi
    echo "✅ .env creado (contraseña MySQL y JWT_SECRET generados aleatoriamente)."
else
    echo "ℹ️  .env ya existe, se conserva."
fi

echo "=============================================================="
echo " 4/8  Instalando dependencias Node.js"
echo "=============================================================="
npm install --omit=dev

echo "=============================================================="
echo " 5/8  Instalando Chrome para Puppeteer (usuario: $(whoami))"
echo "=============================================================="
npx --yes puppeteer browsers install chrome

echo "=============================================================="
echo " 6/8  Migrando padrón SIAGIE y creando perfiles"
echo "=============================================================="
npm run migrar
npm run seed:admin

echo "=============================================================="
echo " 7/8  Instalando Cloudflare Tunnel (HTTPS para cámara en celulares)"
echo "=============================================================="
if ! command -v cloudflared &> /dev/null; then
    wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -O /tmp/cloudflared.deb
    sudo dpkg -i /tmp/cloudflared.deb
fi

echo "=============================================================="
echo " 8/8  Levantando servicios con PM2 + auto-arranque al reiniciar"
echo "=============================================================="
mkdir -p logs
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 start "cloudflared tunnel --url http://localhost:3000" --name tunel-https
pm2 save
sudo env PATH="$PATH" "$(which pm2)" startup systemd -u "$(whoami)" --hp "$HOME" > /dev/null
pm2 save

sleep 8
URL_HTTPS=$(pm2 logs tunel-https --lines 50 --nostream 2>/dev/null | grep -Eo 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' | tail -n 1)
IP_PUBLICA=$(curl -s --max-time 3 http://checkip.amazonaws.com || echo "<IP_PUBLICA>")

echo ""
echo "=============================================================="
echo " ✅ SISTEMA DESPLEGADO"
echo "=============================================================="
echo " HTTP  : http://${IP_PUBLICA}"
echo " HTTPS : ${URL_HTTPS:-ejecuta: pm2 logs tunel-https}"
echo " MySQL : usuario admin_mercedes | clave ${DB_PASS}  (guárdala)"
echo ""
echo " Perfiles: admin / admin_toece / auxiliar  | clave: Mercedes2026*"
echo ""
echo " Vincular WhatsApp: entra al Panel TOECE (Ver QR) o ejecuta:"
echo "   pm2 logs asistencia-mercedes --lines 40"
echo "=============================================================="
