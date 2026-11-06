#!/usr/bin/env bash
# ==============================================================================
# CONFIGURAR DOMINIO PROPIO + HTTPS (Let's Encrypt) — AWS EC2 Ubuntu 24.04
# Proyecto: Sistema de Asistencia QR - I.E. Nuestra Señora de las Mercedes
#
# Uso (como usuario "ubuntu", SIN sudo):
#   DOMINIO=sistemaasistenciamercedes.duckdns.org EMAIL=tu@correo.com \
#   DUCKDNS_TOKEN=xxxxxxxx bash deploy/configurar-dominio.sh
#
# DUCKDNS_TOKEN es opcional: si se indica, se instala un cron que mantiene
# la IP del dominio actualizada aunque cambie la IP pública de la instancia.
# ==============================================================================
set -e

DOMINIO="${DOMINIO:-sistemaasistenciamercedes.duckdns.org}"
EMAIL="${EMAIL:?Indica tu correo: EMAIL=tu@correo.com}"

if [ "$(id -u)" -eq 0 ]; then
    echo "❌ No ejecutes este script con sudo."
    exit 1
fi

IP_PUBLICA=$(curl -s --max-time 5 http://checkip.amazonaws.com)

echo "=============================================================="
echo " 1/4  Sincronizando DuckDNS con la IP de esta instancia (${IP_PUBLICA})"
echo "=============================================================="
if [ -n "$DUCKDNS_TOKEN" ]; then
    SUBDOMINIO="${DOMINIO%%.duckdns.org}"
    RESP=$(curl -s "https://www.duckdns.org/update?domains=${SUBDOMINIO}&token=${DUCKDNS_TOKEN}&ip=")
    echo "Respuesta DuckDNS: ${RESP}"
    [ "$RESP" = "OK" ] || { echo "❌ Token o subdominio inválido."; exit 1; }

    # Cron cada 5 minutos para mantener la IP actualizada
    mkdir -p "$HOME/duckdns"
    echo "curl -s \"https://www.duckdns.org/update?domains=${SUBDOMINIO}&token=${DUCKDNS_TOKEN}&ip=\" -o $HOME/duckdns/duck.log" > "$HOME/duckdns/duck.sh"
    chmod 700 "$HOME/duckdns/duck.sh"
    ( crontab -l 2>/dev/null | grep -v duckdns/duck.sh ; echo "*/5 * * * * $HOME/duckdns/duck.sh >/dev/null 2>&1" ) | crontab -
    echo "✅ Cron de actualización DuckDNS instalado."
else
    echo "ℹ️  Sin DUCKDNS_TOKEN: asegúrate de haber puesto ${IP_PUBLICA} en duckdns.org manualmente."
fi

echo "Esperando propagación DNS..."
for i in $(seq 1 24); do
    IP_DNS=$(getent hosts "$DOMINIO" | awk '{print $1}' | head -n 1)
    [ "$IP_DNS" = "$IP_PUBLICA" ] && break
    sleep 5
done
if [ "$IP_DNS" != "$IP_PUBLICA" ]; then
    echo "❌ ${DOMINIO} apunta a '${IP_DNS}' y esta instancia es '${IP_PUBLICA}'. Corrige la IP en DuckDNS y reintenta."
    exit 1
fi
echo "✅ ${DOMINIO} -> ${IP_PUBLICA}"

echo "=============================================================="
echo " 2/4  Configurando Nginx para ${DOMINIO}"
echo "=============================================================="
sudo sed -i "s/server_name .*;/server_name ${DOMINIO};/" /etc/nginx/sites-available/asistencia-mercedes
sudo nginx -t && sudo systemctl reload nginx

echo "=============================================================="
echo " 3/4  Emitiendo certificado SSL gratuito (Let's Encrypt)"
echo "=============================================================="
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d "$DOMINIO" --non-interactive --agree-tos -m "$EMAIL" --redirect
sudo systemctl enable --now certbot.timer   # renovación automática cada 90 días

echo "=============================================================="
echo " 4/4  Retirando túnel temporal de Cloudflare (ya no es necesario)"
echo "=============================================================="
pm2 delete tunel-https 2>/dev/null || true
pm2 save

echo ""
echo "=============================================================="
echo " ✅ LISTO: https://${DOMINIO}"
echo "    (HTTP redirige automáticamente a HTTPS; la cámara QR funciona en celulares)"
echo "=============================================================="
