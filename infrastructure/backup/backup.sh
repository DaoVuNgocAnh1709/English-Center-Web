#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/english-center}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
UPLOAD_DIR="${UPLOAD_DIR:-/uploads}"
STAMP="$(date +%Y%m%d_%H%M%S)"
TARGET="$BACKUP_DIR/english_center_$STAMP"
PG_URL="${DATABASE_URL%%\?*}"

mkdir -p "$TARGET"
pg_dump --dbname="$PG_URL" --format=custom --compress=9 --file="$TARGET/database.dump"
tar -C "$UPLOAD_DIR" --exclude='./quarantine' -czf "$TARGET/uploads.tar.gz" .
(cd "$TARGET" && sha256sum database.dump uploads.tar.gz > SHA256SUMS)
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name 'english_center_*' -mtime "+$BACKUP_RETENTION_DAYS" -exec rm -rf {} \;
echo "Backup created: $TARGET"
