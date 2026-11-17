#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-${BACKUP_PROJECT_ID:-tbm-application-v2}}"
BUCKET="${2:-${BACKUP_BUCKET:-heinrix-sa24-backup-458920639110-20260307}}"
PREFIX="${BACKUP_PREFIX:-super_admin_backups/firestore-rehearsal}"
COLLECTION="${REHEARSAL_COLLECTION:-dr_restore_rehearsal}"
DOC_ID="${REHEARSAL_DOC_ID:-probe}"
POLL_SECONDS="${BACKUP_POLL_SECONDS:-10}"
TIMEOUT_SECONDS="${BACKUP_TIMEOUT_SECONDS:-1800}"

WORKSPACE_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
FIREBASE_ADMIN_MODULE_PATH="${FIREBASE_ADMIN_MODULE_PATH:-$WORKSPACE_ROOT/super_admin_console/firebase/functions/node_modules/firebase-admin}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "[REHEARSAL] gcloud command not found" >&2
  exit 1
fi

if [[ ! -d "$FIREBASE_ADMIN_MODULE_PATH" ]]; then
  echo "[REHEARSAL][FAIL] firebase-admin module path not found: $FIREBASE_ADMIN_MODULE_PATH" >&2
  exit 1
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
marker="rehearsal-$timestamp"

echo "[REHEARSAL] project=$PROJECT_ID"
echo "[REHEARSAL] collection=$COLLECTION doc_id=$DOC_ID marker=$marker"

node_write_doc() {
  local stage="$1"
  PROJECT_ID="$PROJECT_ID" COLLECTION="$COLLECTION" DOC_ID="$DOC_ID" MARKER="$marker" STAGE="$stage" FIREBASE_ADMIN_MODULE_PATH="$FIREBASE_ADMIN_MODULE_PATH" node - <<'NODE'
const admin = require(process.env.FIREBASE_ADMIN_MODULE_PATH);
if (!admin.apps.length) {
  admin.initializeApp({ projectId: process.env.PROJECT_ID });
}
const db = admin.firestore();
(async () => {
  await db.collection(process.env.COLLECTION).doc(process.env.DOC_ID).set(
    {
      marker: process.env.MARKER,
      rehearsalStage: process.env.STAGE,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log("WRITE_OK");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
NODE
}

node_delete_doc() {
  PROJECT_ID="$PROJECT_ID" COLLECTION="$COLLECTION" DOC_ID="$DOC_ID" FIREBASE_ADMIN_MODULE_PATH="$FIREBASE_ADMIN_MODULE_PATH" node - <<'NODE'
const admin = require(process.env.FIREBASE_ADMIN_MODULE_PATH);
if (!admin.apps.length) {
  admin.initializeApp({ projectId: process.env.PROJECT_ID });
}
const db = admin.firestore();
(async () => {
  await db.collection(process.env.COLLECTION).doc(process.env.DOC_ID).delete();
  console.log("DELETE_OK");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
NODE
}

node_assert_exists_with_marker() {
  PROJECT_ID="$PROJECT_ID" COLLECTION="$COLLECTION" DOC_ID="$DOC_ID" MARKER="$marker" FIREBASE_ADMIN_MODULE_PATH="$FIREBASE_ADMIN_MODULE_PATH" node - <<'NODE'
const admin = require(process.env.FIREBASE_ADMIN_MODULE_PATH);
if (!admin.apps.length) {
  admin.initializeApp({ projectId: process.env.PROJECT_ID });
}
const db = admin.firestore();
(async () => {
  const snap = await db.collection(process.env.COLLECTION).doc(process.env.DOC_ID).get();
  if (!snap.exists) {
    throw new Error("DOC_NOT_FOUND");
  }
  const data = snap.data() || {};
  if (data.marker !== process.env.MARKER) {
    throw new Error(`MARKER_MISMATCH expected=${process.env.MARKER} actual=${data.marker}`);
  }
  console.log("ASSERT_EXISTS_OK");
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
NODE
}

node_assert_not_exists() {
  PROJECT_ID="$PROJECT_ID" COLLECTION="$COLLECTION" DOC_ID="$DOC_ID" FIREBASE_ADMIN_MODULE_PATH="$FIREBASE_ADMIN_MODULE_PATH" node - <<'NODE'
const admin = require(process.env.FIREBASE_ADMIN_MODULE_PATH);
if (!admin.apps.length) {
  admin.initializeApp({ projectId: process.env.PROJECT_ID });
}
const db = admin.firestore();
(async () => {
  const snap = await db.collection(process.env.COLLECTION).doc(process.env.DOC_ID).get();
  if (snap.exists) {
    throw new Error("DOC_STILL_EXISTS");
  }
  console.log("ASSERT_NOT_EXISTS_OK");
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
NODE
}

wait_operation_done() {
  local op_name="$1"
  local op_type="$2"
  local start_epoch="$(date +%s)"

  while true; do
    local done_value
    done_value="$(gcloud firestore operations describe "$op_name" --project="$PROJECT_ID" --format='value(done)')"
    if [[ "$done_value" == "True" || "$done_value" == "true" ]]; then
      break
    fi

    local now_epoch
    now_epoch="$(date +%s)"
    if (( now_epoch - start_epoch > TIMEOUT_SECONDS )); then
      echo "[REHEARSAL][FAIL] timeout waiting for $op_type operation" >&2
      exit 1
    fi

    sleep "$POLL_SECONDS"
  done

  local error_message
  error_message="$(gcloud firestore operations describe "$op_name" --project="$PROJECT_ID" --format='value(error.message)')"
  if [[ -n "$error_message" ]]; then
    echo "[REHEARSAL][FAIL] $op_type operation error: $error_message" >&2
    exit 1
  fi
}

node_write_doc "before_export"
node_assert_exists_with_marker

target_uri="gs://${BUCKET}/${PREFIX}/${timestamp}"
export_op="$(gcloud firestore export "$target_uri" \
  --project="$PROJECT_ID" \
  --collection-ids="$COLLECTION" \
  --async \
  --format='value(name)')"

if [[ -z "$export_op" ]]; then
  echo "[REHEARSAL][FAIL] export operation name missing" >&2
  exit 1
fi

echo "[REHEARSAL] export_op=$export_op"
wait_operation_done "$export_op" "export"

output_uri="$(gcloud firestore operations describe "$export_op" --project="$PROJECT_ID" --format='value(response.outputUriPrefix)')"
if [[ -z "$output_uri" ]]; then
  echo "[REHEARSAL][FAIL] export outputUriPrefix missing" >&2
  exit 1
fi

echo "[REHEARSAL] output_uri=$output_uri"

node_delete_doc
node_assert_not_exists

import_op="$(gcloud firestore import "$output_uri" \
  --project="$PROJECT_ID" \
  --collection-ids="$COLLECTION" \
  --async \
  --format='value(name)')"

if [[ -z "$import_op" ]]; then
  echo "[REHEARSAL][FAIL] import operation name missing" >&2
  exit 1
fi

echo "[REHEARSAL] import_op=$import_op"
wait_operation_done "$import_op" "import"

node_assert_exists_with_marker

# cleanup rehearsal doc after verification
node_delete_doc

cat <<RESULT
[REHEARSAL] status=success
[REHEARSAL] project_id=$PROJECT_ID
[REHEARSAL] collection=$COLLECTION
[REHEARSAL] doc_id=$DOC_ID
[REHEARSAL] marker=$marker
[REHEARSAL] export_output_uri=$output_uri
[REHEARSAL] export_operation=$export_op
[REHEARSAL] import_operation=$import_op
[REHEARSAL] timestamp_utc=$timestamp
RESULT
