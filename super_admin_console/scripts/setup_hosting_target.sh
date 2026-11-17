#!/usr/bin/env bash
set -euo pipefail

ENV_NAME="${1:-}"
SITE_ID="${2:-}"

if [[ ! "$ENV_NAME" =~ ^(dev|stg|prod)$ ]]; then
  echo "Usage: $(basename "$0") <dev|stg|prod> <hosting-site-id>"
  exit 1
fi

if [[ -z "$SITE_ID" ]]; then
  echo "Usage: $(basename "$0") <dev|stg|prod> <hosting-site-id>"
  exit 1
fi

TARGET_NAME="admin_${ENV_NAME}"
PROJECT_ALIAS="$ENV_NAME"

echo "Applying hosting target..."
echo "  project alias: $PROJECT_ALIAS"
echo "  target name:   $TARGET_NAME"
echo "  hosting site:  $SITE_ID"

firebase target:apply hosting "$TARGET_NAME" "$SITE_ID" --project "$PROJECT_ALIAS"

echo "Done. Verify with: firebase target --project $PROJECT_ALIAS"
