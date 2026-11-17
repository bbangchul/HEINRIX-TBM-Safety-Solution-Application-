#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-${MONITORING_PROJECT_ID:-tbm-application-v2}}"
NOTIFY_EMAIL="${MONITORING_NOTIFY_EMAIL:-bangsc02@gmail.com}"
CHANNEL_DISPLAY_NAME="${MONITORING_CHANNEL_DISPLAY_NAME:-SA023 Super Admin Oncall Email}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "[STEP23] gcloud command not found"
  exit 1
fi

echo "[STEP23] project=$PROJECT_ID"
echo "[STEP23] notify_email=$NOTIFY_EMAIL"

upsert_log_metric() {
  local name="$1"
  local description="$2"
  local filter="$3"

  if gcloud logging metrics describe "$name" --project="$PROJECT_ID" >/dev/null 2>&1; then
    gcloud logging metrics update "$name" \
      --description="$description" \
      --log-filter="$filter" \
      --project="$PROJECT_ID" >/dev/null
    echo "[STEP23] metric updated: $name"
  else
    gcloud logging metrics create "$name" \
      --description="$description" \
      --log-filter="$filter" \
      --project="$PROJECT_ID" >/dev/null
    echo "[STEP23] metric created: $name"
  fi
}

ensure_email_channel() {
  local existing
  existing="$(gcloud alpha monitoring channels list \
    --project="$PROJECT_ID" \
    --format='value(name,type,displayName,labels.email_address)' \
    | awk -F'\t' -v d="$CHANNEL_DISPLAY_NAME" -v e="$NOTIFY_EMAIL" '$2=="email" && $3==d && $4==e {print $1; exit}')"

  if [[ -n "$existing" ]]; then
    echo "$existing"
    return 0
  fi

  gcloud alpha monitoring channels create \
    --project="$PROJECT_ID" \
    --display-name="$CHANNEL_DISPLAY_NAME" \
    --description="SA023 super-admin critical alerts notification channel" \
    --type=email \
    --channel-labels="email_address=$NOTIFY_EMAIL" \
    --user-labels="domain=super_admin,managed_by=super_admin_monitoring_setup,sa_step=sa023" >/dev/null

  existing="$(gcloud alpha monitoring channels list \
    --project="$PROJECT_ID" \
    --format='value(name,type,displayName,labels.email_address)' \
    | awk -F'\t' -v d="$CHANNEL_DISPLAY_NAME" -v e="$NOTIFY_EMAIL" '$2=="email" && $3==d && $4==e {print $1; exit}')"

  if [[ -z "$existing" ]]; then
    echo "[STEP23][FAIL] notification channel create failed" >&2
    exit 1
  fi

  echo "$existing"
}

upsert_policy_from_file() {
  local display_name="$1"
  local file_path="$2"

  local existing
  existing="$(gcloud alpha monitoring policies list \
    --project="$PROJECT_ID" \
    --filter="displayName=\"$display_name\"" \
    --format='value(name)' | head -n1)"

  if [[ -n "$existing" ]]; then
    gcloud alpha monitoring policies update "$existing" \
      --project="$PROJECT_ID" \
      --policy-from-file="$file_path" >/dev/null
    echo "[STEP23] policy updated: $display_name"
  else
    gcloud alpha monitoring policies create \
      --project="$PROJECT_ID" \
      --policy-from-file="$file_path" >/dev/null
    echo "[STEP23] policy created: $display_name"
  fi
}

BASE_ADMIN_FILTER='((resource.type="cloud_run_revision" AND resource.labels.service_name=~"admin.*") OR (resource.type="cloud_function" AND resource.labels.function_name=~"admin.*"))'

upsert_log_metric \
  "sa_admin_errors_total" \
  "SA023: super admin callables severity>=ERROR logs." \
  "$BASE_ADMIN_FILTER AND severity>=ERROR"

upsert_log_metric \
  "sa_admin_permission_denied_total" \
  "SA023: super admin callables permission-denied signals." \
  "$BASE_ADMIN_FILTER AND (textPayload=~\"permission-denied|PERMISSION_DENIED\" OR jsonPayload.message=~\"permission-denied|PERMISSION_DENIED\")"

upsert_log_metric \
  "sa_admin_unauth_total" \
  "SA023: super admin callables unauthenticated signals." \
  "$BASE_ADMIN_FILTER AND (textPayload=~\"UNAUTHENTICATED|unauthenticated\" OR jsonPayload.message=~\"UNAUTHENTICATED|unauthenticated\")"

upsert_log_metric \
  "sa_admin_delete_user_error_total" \
  "SA023: adminDeleteOrAnonymizeUser severity>=ERROR logs." \
  '((resource.type="cloud_run_revision" AND resource.labels.service_name=~"admindeleteoranonymizeuser.*") OR (resource.type="cloud_function" AND resource.labels.function_name="adminDeleteOrAnonymizeUser")) AND severity>=ERROR'

CHANNEL_NAME="$(ensure_email_channel)"
echo "[STEP23] channel=$CHANNEL_NAME"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

cat > "$TMP_DIR/policy_admin_errors.yaml" <<POLICY
combiner: OR
displayName: SA023 super_admin_error_spike
enabled: true
conditions:
  - displayName: admin error logs > 3 in 5m
    conditionThreshold:
      filter: 'resource.type="cloud_run_revision" AND metric.type="logging.googleapis.com/user/sa_admin_errors_total"'
      aggregations:
        - alignmentPeriod: 300s
          perSeriesAligner: ALIGN_DELTA
          crossSeriesReducer: REDUCE_SUM
      comparison: COMPARISON_GT
      thresholdValue: 3
      duration: 0s
      trigger:
        count: 1
documentation:
  content: "SA023: super admin callable error logs exceeded threshold (>3 / 5m)."
  mimeType: text/markdown
notificationChannels:
  - $CHANNEL_NAME
userLabels:
  domain: super_admin
  managed_by: super_admin_monitoring_setup
  sa_step: sa023
POLICY

cat > "$TMP_DIR/policy_permission_denied.yaml" <<POLICY
combiner: OR
displayName: SA023 super_admin_permission_denied_spike
enabled: true
conditions:
  - displayName: permission denied logs > 12 in 10m
    conditionThreshold:
      filter: 'resource.type="cloud_run_revision" AND metric.type="logging.googleapis.com/user/sa_admin_permission_denied_total"'
      aggregations:
        - alignmentPeriod: 600s
          perSeriesAligner: ALIGN_DELTA
          crossSeriesReducer: REDUCE_SUM
      comparison: COMPARISON_GT
      thresholdValue: 12
      duration: 0s
      trigger:
        count: 1
documentation:
  content: "SA023: permission-denied spikes detected (>12 / 10m). Potential policy bypass probing."
  mimeType: text/markdown
notificationChannels:
  - $CHANNEL_NAME
userLabels:
  domain: super_admin
  managed_by: super_admin_monitoring_setup
  sa_step: sa023
POLICY

cat > "$TMP_DIR/policy_unauth.yaml" <<POLICY
combiner: OR
displayName: SA023 super_admin_unauthenticated_spike
enabled: true
conditions:
  - displayName: unauthenticated logs > 8 in 10m
    conditionThreshold:
      filter: 'resource.type="cloud_run_revision" AND metric.type="logging.googleapis.com/user/sa_admin_unauth_total"'
      aggregations:
        - alignmentPeriod: 600s
          perSeriesAligner: ALIGN_DELTA
          crossSeriesReducer: REDUCE_SUM
      comparison: COMPARISON_GT
      thresholdValue: 8
      duration: 0s
      trigger:
        count: 1
documentation:
  content: "SA023: unauthenticated spikes detected (>8 / 10m)."
  mimeType: text/markdown
notificationChannels:
  - $CHANNEL_NAME
userLabels:
  domain: super_admin
  managed_by: super_admin_monitoring_setup
  sa_step: sa023
POLICY

cat > "$TMP_DIR/policy_delete_user_error.yaml" <<POLICY
combiner: OR
displayName: SA023 super_admin_delete_user_error_any
enabled: true
conditions:
  - displayName: delete/anonymize user error > 0 in 5m
    conditionThreshold:
      filter: 'resource.type="cloud_run_revision" AND metric.type="logging.googleapis.com/user/sa_admin_delete_user_error_total"'
      aggregations:
        - alignmentPeriod: 300s
          perSeriesAligner: ALIGN_DELTA
          crossSeriesReducer: REDUCE_SUM
      comparison: COMPARISON_GT
      thresholdValue: 0
      duration: 0s
      trigger:
        count: 1
documentation:
  content: "SA023: adminDeleteOrAnonymizeUser emitted at least one error log. Immediate check required."
  mimeType: text/markdown
notificationChannels:
  - $CHANNEL_NAME
userLabels:
  domain: super_admin
  managed_by: super_admin_monitoring_setup
  sa_step: sa023
POLICY

upsert_policy_from_file "SA023 super_admin_error_spike" "$TMP_DIR/policy_admin_errors.yaml"
upsert_policy_from_file "SA023 super_admin_permission_denied_spike" "$TMP_DIR/policy_permission_denied.yaml"
upsert_policy_from_file "SA023 super_admin_unauthenticated_spike" "$TMP_DIR/policy_unauth.yaml"
upsert_policy_from_file "SA023 super_admin_delete_user_error_any" "$TMP_DIR/policy_delete_user_error.yaml"

echo "[STEP23] done"
