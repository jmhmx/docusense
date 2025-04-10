#!/bin/bash
# Backup automático de la base de datos PostgreSQL

# Configuración
DB_NAME="docusense"
DB_USER="postgres"
BACKUP_DIR="/backups"
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/docusense_$DATE.sql.gz"

# Crear directorio si no existe
mkdir -p $BACKUP_DIR

# Generar backup comprimido
pg_dump -U $DB_USER $DB_NAME | gzip > $BACKUP_FILE

# Limpiar backups antiguos (mantener solo últimos 7 días)
find $BACKUP_DIR -name "docusense_*.sql.gz" -type f -mtime +7 -delete

echo "Backup completado: $BACKUP_FILE"