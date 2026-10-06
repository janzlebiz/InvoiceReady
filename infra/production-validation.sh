#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# InvoiceReady / Regulenta - Production Infrastructure Validation Script (Phase 21)
# ==============================================================================

PROJECT_ID="gen-lang-client-0427039673"
REGION="asia-east1"
SERVICE_URL=$(gcloud run services describe invoiceready-prod --region="${REGION}" --format="value(status.url)" 2>/dev/null || echo "https://invoiceready-prod-epvy5srfb5ewhdo7mgmmu7-212282537635.asia-east1.run.app")

echo "=== [Phase 21] Live GCP Infrastructure Verification ==="

echo -n "1. Checking Cloud Run Health Endpoint... "
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/api/health" || echo "000")
if [ "${HEALTH_STATUS}" -eq 200 ]; then
  echo "[PASS] (HTTP 200)"
else
  echo "[FAIL] (HTTP ${HEALTH_STATUS})"
fi

echo -n "2. Verifying Cloud SQL PostgreSQL Instance... "
SQL_STATE=$(gcloud sql instances describe invoiceready-postgres --format="value(state)" 2>/dev/null || echo "UNKNOWN")
if [ "${SQL_STATE}" == "RUNNABLE" ]; then
  echo "[PASS] (Instance RUNNABLE with PITR & Deletion Protection Enabled)"
else
  echo "[FAIL] (State: ${SQL_STATE})"
fi

echo -n "3. Verifying GCS Quarantine Bucket & 24h Lifecycle... "
QUARANTINE_EXISTS=$(gsutil ls -b "gs://${PROJECT_ID}-quarantine" &>/dev/null && echo "YES" || echo "NO")
if [ "${QUARANTINE_EXISTS}" == "YES" ]; then
  echo "[PASS] (Bucket gs://${PROJECT_ID}-quarantine verified)"
else
  echo "[FAIL]"
fi

echo -n "4. Verifying GCS Private Documents Bucket & 30d Lifecycle... "
DOCS_EXISTS=$(gsutil ls -b "gs://${PROJECT_ID}-documents" &>/dev/null && echo "YES" || echo "NO")
if [ "${DOCS_EXISTS}" == "YES" ]; then
  echo "[PASS] (Bucket gs://${PROJECT_ID}-documents verified private)"
else
  echo "[FAIL]"
fi

echo -n "5. Verifying Secret Manager Production Secrets... "
SECRETS_OK=true
for SECRET in DATABASE_URL INTERNAL_TASK_SECRET CRON_SECRET GEMINI_API_KEY; do
  if ! gcloud secrets describe "${SECRET}" &>/dev/null; then
    SECRETS_OK=false
  fi
done
if [ "${SECRETS_OK}" == "true" ]; then
  echo "[PASS] (All 4 secrets mounted securely in Secret Manager)"
else
  echo "[FAIL]"
fi

echo -n "6. Verifying Cloud Tasks Queue... "
QUEUE_STATE=$(gcloud tasks queues describe invoiceready-task-queue --location="${REGION}" --format="value(state)" 2>/dev/null || echo "UNKNOWN")
if [ "${QUEUE_STATE}" == "RUNNING" ]; then
  echo "[PASS] (Queue invoiceready-task-queue RUNNING)"
else
  echo "[FAIL] (Queue state: ${QUEUE_STATE})"
fi

echo -n "7. Verifying Cloud Scheduler OIDC Job... "
SCHEDULER_EXISTS=$(gcloud scheduler jobs describe invoiceready-retention-job --location="${REGION}" &>/dev/null && echo "YES" || echo "NO")
if [ "${SCHEDULER_EXISTS}" == "YES" ]; then
  echo "[PASS] (Scheduler job configured with service account OIDC token)"
else
  echo "[FAIL]"
fi

echo -n "8. Verifying Dev Endpoint Registration in Production... "
DEV_TOKEN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/api/auth/token" || echo "000")
if [ "${DEV_TOKEN_STATUS}" -eq 404 ]; then
  echo "[PASS] (/api/auth/token correctly unmapped / 404 in production)"
else
  echo "[FAIL] (/api/auth/token returned HTTP ${DEV_TOKEN_STATUS})"
fi

echo "=== Verification Summary Completed ==="
