#!/usr/bin/env bash
# ==============================================================================
# SCRIPT DE COPIA DE SEGURIDAD (BACKUP) AUTOMÁTICO DE BASE DE DATOS Y ASISTENCIAS
# Proyecto: Sistema de Asistencia QR - I.E. Nuestra Señora de las Mercedes
# ==============================================================================
set -e

DIR_BACKUP="$HOME/backups_mercedes"
FECHA=$(date +"%Y-%m-%d_%H-%M-%S")
mkdir -p "$DIR_BACKUP"

# 1. Volcado completo de la base de datos MySQL (Estructura + Datos)
sudo mysqldump --defaults-file=/etc/mysql/debian.cnf asistencia_mercedes | gzip > "$DIR_BACKUP/backup_asistencia_${FECHA}.sql.gz"

# 2. Mantener solo las últimas 8 semanas de backups (eliminar los más antiguos de 60 días)
find "$DIR_BACKUP" -type f -name "backup_asistencia_*.sql.gz" -mtime +60 -delete

echo "✅ [$(date)] Backup semanal completado con éxito: $DIR_BACKUP/backup_asistencia_${FECHA}.sql.gz"
