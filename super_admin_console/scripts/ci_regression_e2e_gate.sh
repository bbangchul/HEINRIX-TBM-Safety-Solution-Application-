#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FUNCTIONS_DIR="$ROOT_DIR/firebase/functions"
WEB_DIR="$ROOT_DIR/web"

if [[ -z "${FIREBASE_API_KEY:-}" ]]; then
  echo "FIREBASE_API_KEY is required."
  exit 1
fi

echo "[CI] install dependencies"
npm --prefix "$FUNCTIONS_DIR" ci
npm --prefix "$WEB_DIR" ci

echo "[CI] static quality gates"
npm --prefix "$FUNCTIONS_DIR" run verify:admin-api-layer
npm --prefix "$FUNCTIONS_DIR" run verify:security-controls
npm --prefix "$WEB_DIR" run verify:callable-only

echo "[CI] regression e2e"
npm --prefix "$FUNCTIONS_DIR" run test:regression:e2e
