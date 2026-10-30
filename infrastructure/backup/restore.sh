#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_PATH="${1:?Usage: restore.sh /absolute/path/to/english_center_TIMESTAMP}"
UPLOAD_DIR="${UPLOAD_DIR:-/uploads}"
PG_URL="${DATABASE_URL%%\?*}"

if [ ! -f "$BACKUP_PATH/database.dump" ] || [ ! -f "$BACKUP_PATH/uploads.tar.gz" ]; then
  echo "Backup bundle is incomplete: $BACKUP_PATH" >&2
  exit 1
fi

(cd "$BACKUP_PATH" && sha256sum -c SHA256SUMS)
pg_restore --dbname="$PG_URL" --clean --if-exists --no-owner "$BACKUP_PATH/database.dump"
mkdir -p "$UPLOAD_DIR"
tar -C "$UPLOAD_DIR" -xzf "$BACKUP_PATH/uploads.tar.gz"
echo "Restore completed from: $BACKUP_PATH"
