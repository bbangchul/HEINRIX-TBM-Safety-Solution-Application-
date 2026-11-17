#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_NAME="${1:-}"
FUNCTIONS_DIR="$ROOT_DIR/firebase/functions"
WEB_DIR="$ROOT_DIR/web"
CONFIG_FILE="$ROOT_DIR/firebase.json"

if [[ ! "$ENV_NAME" =~ ^(dev|stg|prod)$ ]]; then
  echo "Usage: $(basename "$0") <dev|stg|prod>"
  exit 1
fi

case "$ENV_NAME" in
  dev)
    PROJECT_ID="heinrix-super-admin-dev"
    HOSTING_TARGET="admin_dev"
    ;;
  stg)
    PROJECT_ID="heinrix-super-admin-stg"
    HOSTING_TARGET="admin_stg"
    ;;
  prod)
    PROJECT_ID="tbm-application-v2"
    HOSTING_TARGET="admin_prod"
    ;;
esac

if [[ ! -f "$WEB_DIR/.env" ]]; then
  echo "Missing $WEB_DIR/.env"
  echo "Run: $ROOT_DIR/scripts/apply_web_env.sh $ENV_NAME"
  echo "Then fill the Firebase web config values before deploying."
  exit 1
fi

read_env_value() {
  local key="$1"
  local value
  value="$(grep -E "^${key}=" "$WEB_DIR/.env" | tail -n 1 | cut -d '=' -f 2- || true)"
  printf '%s' "$value"
}

REQUIRED_WEB_KEYS=(
  VITE_APP_ENV
  VITE_FIREBASE_API_KEY
  VITE_FIREBASE_AUTH_DOMAIN
  VITE_FIREBASE_PROJECT_ID
  VITE_FIREBASE_STORAGE_BUCKET
  VITE_FIREBASE_MESSAGING_SENDER_ID
  VITE_FIREBASE_APP_ID
  VITE_FIREBASE_VAPID_KEY
  VITE_FUNCTIONS_REGION
)

missing_keys=()
for key in "${REQUIRED_WEB_KEYS[@]}"; do
  value="$(read_env_value "$key")"
  if [[ -z "$value" ]]; then
    missing_keys+=("$key")
  fi
done

if [[ ${#missing_keys[@]} -gt 0 ]]; then
  echo "web/.env is missing required values:"
  printf ' - %s\n' "${missing_keys[@]}"
  exit 1
fi

actual_app_env="$(read_env_value VITE_APP_ENV)"
actual_project_id="$(read_env_value VITE_FIREBASE_PROJECT_ID)"

if [[ "$actual_app_env" != "$ENV_NAME" ]]; then
  echo "VITE_APP_ENV mismatch: expected $ENV_NAME, got $actual_app_env"
  exit 1
fi

if [[ "$actual_project_id" != "$PROJECT_ID" ]]; then
  echo "VITE_FIREBASE_PROJECT_ID mismatch: expected $PROJECT_ID, got $actual_project_id"
  exit 1
fi

echo "[deploy] env       : $ENV_NAME"
echo "[deploy] project   : $PROJECT_ID"
echo "[deploy] config    : $CONFIG_FILE"
echo "[deploy] functions : $FUNCTIONS_DIR"
echo "[deploy] web       : $WEB_DIR"

echo "[deploy] static checks"
npm --prefix "$FUNCTIONS_DIR" run verify:admin-api-layer
npm --prefix "$FUNCTIONS_DIR" run verify:security-controls
npm --prefix "$WEB_DIR" run verify:callable-only

echo "[deploy] builds"
npm --prefix "$FUNCTIONS_DIR" run build
npm --prefix "$WEB_DIR" run build

echo "[deploy] firebase deploy"
(
  cd "$ROOT_DIR"
  firebase deploy --project "$ENV_NAME" --config "$CONFIG_FILE" --only "functions,firestore,hosting:${HOSTING_TARGET}"
)
