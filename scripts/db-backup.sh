#!/usr/bin/env bash
# Backs up / restores the MongoDB running in docker compose.
#
# Usage:
#   scripts/db-backup.sh backup             -> backups/appointments-<timestamp>.archive.gz
#   scripts/db-backup.sh restore <file>     -> replaces the database with the archive's contents
#   scripts/db-backup.sh list
set -euo pipefail

cd "$(dirname "$0")/.."
DB_NAME="${MONGODB_DB_NAME:-appointments}"
BACKUP_DIR="backups"
KEEP=7  # number of backups to keep

case "${1:-}" in
  backup)
    mkdir -p "$BACKUP_DIR"
    file="$BACKUP_DIR/$DB_NAME-$(date +%Y%m%d-%H%M%S).archive.gz"
    docker compose exec -T mongo mongodump --db "$DB_NAME" --archive --gzip > "$file"
    echo "✔ Saved $file ($(du -h "$file" | cut -f1))"
    # Drop the oldest backups beyond $KEEP
    ls -1t "$BACKUP_DIR"/"$DB_NAME"-*.archive.gz | tail -n +$((KEEP + 1)) | xargs -r rm --
    ;;
  restore)
    file="${2:?Usage: $0 restore <file>}"
    [[ -f "$file" ]] || { echo "File not found: $file" >&2; exit 1; }
    read -r -p "This will REPLACE database '$DB_NAME' with $file. Continue? [y/N] " answer
    [[ "$answer" == [yY] ]] || { echo "Cancelled"; exit 0; }
    docker compose exec -T mongo mongorestore --drop --archive --gzip < "$file"
    echo "✔ Restored $file"
    ;;
  list)
    ls -lh "$BACKUP_DIR" 2>/dev/null || echo "No backups yet"
    ;;
  *)
    sed -n '2,7p' "$0"; exit 1
    ;;
esac
