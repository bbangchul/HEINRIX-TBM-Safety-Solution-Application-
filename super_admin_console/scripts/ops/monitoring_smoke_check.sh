#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-${MONITORING_PROJECT_ID:-tbm-application-v2}}"
FRESHNESS="${MONITORING_FRESHNESS:-30m}"
LIMIT="${MONITORING_LIMIT:-500}"

ERROR_MAX="${ERROR_MAX:-5}"
PERMISSION_DENIED_MAX="${PERMISSION_DENIED_MAX:-25}"
UNAUTH_MAX="${UNAUTH_MAX:-20}"
DELETE_ERROR_MAX="${DELETE_ERROR_MAX:-0}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "[MONITORING] gcloud command not found"
  exit 1
fi

# Cloud Functions v2는 cloud_run_revision, v1은 cloud_function 로그를 사용한다.
BASE_FILTER='(resource.type="cloud_run_revision" OR resource.type="cloud_function") AND (resource.labels.service_name=~"admin.*" OR resource.labels.function_name=~"admin.*")'

count_logs() {
  local filter="$1"
  gcloud logging read "$filter" \
    --project="$PROJECT_ID" \
    --freshness="$FRESHNESS" \
    --limit="$LIMIT" \
    --format="value(timestamp)" 2>/dev/null | sed '/^$/d' | wc -l | tr -d ' '
}

ERROR_FILTER="$BASE_FILTER AND severity>=ERROR"
PERMISSION_DENIED_FILTER="$BASE_FILTER AND (textPayload=~\"permission-denied|PERMISSION_DENIED\" OR jsonPayload.message=~\"permission-denied|PERMISSION_DENIED\")"
UNAUTH_FILTER="$BASE_FILTER AND (textPayload=~\"UNAUTHENTICATED|unauthenticated\" OR jsonPayload.message=~\"UNAUTHENTICATED|unauthenticated\")"
DELETE_USER_ERROR_FILTER="$BASE_FILTER AND (resource.labels.function_name=\"adminDeleteOrAnonymizeUser\" OR resource.labels.service_name=~\"admindeleteoranonymizeuser\") AND severity>=ERROR"

ERROR_COUNT="$(count_logs "$ERROR_FILTER")"
PERMISSION_DENIED_COUNT="$(count_logs "$PERMISSION_DENIED_FILTER")"
UNAUTH_COUNT="$(count_logs "$UNAUTH_FILTER")"
DELETE_USER_ERROR_COUNT="$(count_logs "$DELETE_USER_ERROR_FILTER")"

echo "[MONITORING] project=$PROJECT_ID freshness=$FRESHNESS"
echo "[MONITORING] error_count=$ERROR_COUNT threshold=$ERROR_MAX"
echo "[MONITORING] permission_denied_count=$PERMISSION_DENIED_COUNT threshold=$PERMISSION_DENIED_MAX"
echo "[MONITORING] unauth_count=$UNAUTH_COUNT threshold=$UNAUTH_MAX"
echo "[MONITORING] delete_user_error_count=$DELETE_USER_ERROR_COUNT threshold=$DELETE_ERROR_MAX"

failed=0

if (( ERROR_COUNT > ERROR_MAX )); then
  echo "[MONITORING][FAIL] error_count exceeded threshold"
  failed=1
fi

if (( PERMISSION_DENIED_COUNT > PERMISSION_DENIED_MAX )); then
  echo "[MONITORING][FAIL] permission_denied_count exceeded threshold"
  failed=1
fi

if (( UNAUTH_COUNT > UNAUTH_MAX )); then
  echo "[MONITORING][FAIL] unauth_count exceeded threshold"
  failed=1
fi

if (( DELETE_USER_ERROR_COUNT > DELETE_ERROR_MAX )); then
  echo "[MONITORING][FAIL] delete_user_error_count exceeded threshold"
  failed=1
fi

if (( failed == 1 )); then
  exit 2
fi

echo "[MONITORING] OK"
