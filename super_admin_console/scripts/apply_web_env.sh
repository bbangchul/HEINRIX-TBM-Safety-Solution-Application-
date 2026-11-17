#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_NAME="${1:-}"

if [[ ! "$ENV_NAME" =~ ^(dev|stg|prod)$ ]]; then
  echo "Usage: $(basename "$0") <dev|stg|prod>"
  exit 1
fi

SOURCE_ENV_FILE="$ROOT_DIR/config/env/.env.${ENV_NAME}.example"
TARGET_ENV_FILE="$ROOT_DIR/web/.env"

if [[ ! -f "$SOURCE_ENV_FILE" ]]; then
  echo "Missing template: $SOURCE_ENV_FILE"
  exit 1
fi

if [[ -f "$TARGET_ENV_FILE" ]]; then
  BACKUP_FILE="$ROOT_DIR/web/.env.backup.$(date +%Y%m%d%H%M%S)"
  cp "$TARGET_ENV_FILE" "$BACKUP_FILE"
  echo "Backup created: $BACKUP_FILE"
fi

cp "$SOURCE_ENV_FILE" "$TARGET_ENV_FILE"
echo "Applied: $SOURCE_ENV_FILE -> $TARGET_ENV_FILE"
echo "Next: fill secret values in web/.env before running npm scripts."
