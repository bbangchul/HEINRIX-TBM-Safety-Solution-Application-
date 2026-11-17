#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-${BACKUP_PROJECT_ID:-tbm-application-v2}}"
BUCKET="${2:-${BACKUP_BUCKET:-heinrix-sa24-backup-458920639110-20260307}}"
PREFIX="${BACKUP_PREFIX:-super_admin_backups/firestore}"
COLLECTION_IDS="${BACKUP_COLLECTION_IDS:-}"
POLL_SECONDS="${BACKUP_POLL_SECONDS:-10}"
TIMEOUT_SECONDS="${BACKUP_TIMEOUT_SECONDS:-1800}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "[BACKUP] gcloud command not found" >&2
  exit 1
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target_uri="gs://${BUCKET}/${PREFIX}/${timestamp}"

echo "[BACKUP] project=$PROJECT_ID"
echo "[BACKUP] target_uri=$target_uri"

extra_args=()
if [[ -n "$COLLECTION_IDS" ]]; then
  extra_args+=("--collection-ids=$COLLECTION_IDS")
  echo "[BACKUP] collection_ids=$COLLECTION_IDS"
else
  echo "[BACKUP] collection_ids=<all>"
fi

op_name="$(gcloud firestore export "$target_uri" \
  --project="$PROJECT_ID" \
  --async \
  "${extra_args[@]}" \
  --format='value(name)')"

if [[ -z "$op_name" ]]; then
  echo "[BACKUP][FAIL] export operation name not returned" >&2
  exit 1
fi

echo "[BACKUP] operation=$op_name"

start_epoch="$(date +%s)"
while true; do
  done_value="$(gcloud firestore operations describe "$op_name" --project="$PROJECT_ID" --format='value(done)')"
  if [[ "$done_value" == "True" || "$done_value" == "true" ]]; then
    break
  fi

  now_epoch="$(date +%s)"
  if (( now_epoch - start_epoch > TIMEOUT_SECONDS )); then
    echo "[BACKUP][FAIL] timeout waiting for export operation" >&2
    exit 1
  fi

  sleep "$POLL_SECONDS"
done

error_message="$(gcloud firestore operations describe "$op_name" --project="$PROJECT_ID" --format='value(error.message)')"
if [[ -n "$error_message" ]]; then
  echo "[BACKUP][FAIL] $error_message" >&2
  exit 1
fi

output_uri="$(gcloud firestore operations describe "$op_name" --project="$PROJECT_ID" --format='value(response.outputUriPrefix)')"

if [[ -z "$output_uri" ]]; then
  echo "[BACKUP][FAIL] export completed but outputUriPrefix missing" >&2
  exit 1
fi

cat <<RESULT
[BACKUP] status=success
[BACKUP] output_uri=$output_uri
[BACKUP] operation=$op_name
[BACKUP] timestamp_utc=$timestamp
RESULT
