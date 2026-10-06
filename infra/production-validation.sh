#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# InvoiceReady / Regulenta - Phase 21C Evidence-Based Validation Script
# Project ID: gen-lang-client-0427039673
# Region: asia-east1
# ==============================================================================

PROJECT_ID="gen-lang-client-0427039673"
REGION="asia-east1"
SERVICE_ACCOUNT="invoiceready-runner@${PROJECT_ID}.iam.gserviceaccount.com"
SERVICE_URL=$(gcloud run services describe invoiceready-prod --region="${REGION}" --format="value(status.url)" 2>/dev/null || echo "https://invoiceready-prod-epvy5srfb5ewhdo7mgmmu7-212282537635.asia-east1.run.app")

echo "========================================================================"
echo " InvoiceReady — GCP Production Evidence-Based Verification (Phase 21C)"
echo " Target Service URL: ${SERVICE_URL}"
echo "========================================================================"

FAILED_COUNT=0
PASSED_COUNT=0

assert_check() {
  local title="$1"
  local status="$2"
  local detail="$3"
  if [ "$status" -eq 0 ]; then
    echo " [PASS] ${title} — Evidence: ${detail}"
    PASSED_COUNT=$((PASSED_COUNT + 1))
  else
    echo " [FAIL] ${title} — Evidence: ${detail}"
    FAILED_COUNT=$((FAILED_COUNT + 1))
  fi
}

echo "--- 1. Environment & Container Configuration Checks ---"
ENV_PRIVATE=$(gcloud run services describe invoiceready-prod --region="${REGION}" --format="json" 2>/dev/null | jq -r '.spec.template.spec.containers[0].env[] | select(.name=="GCS_PRIVATE_BUCKET").value' || echo "")
ENV_DOCS=$(gcloud run services describe invoiceready-prod --region="${REGION}" --format="json" 2>/dev/null | jq -r '.spec.template.spec.containers[0].env[] | select(.name=="GCS_DOCUMENTS_BUCKET").value' || echo "")
ENV_GCP_PROJECT=$(gcloud run services describe invoiceready-prod --region="${REGION}" --format="json" 2>/dev/null | jq -r '.spec.template.spec.containers[0].env[] | select(.name=="GOOGLE_CLOUD_PROJECT").value' || echo "")

if [ "${ENV_PRIVATE}" == "${PROJECT_ID}-documents" ] && [ "${ENV_DOCS}" == "${PROJECT_ID}-documents" ]; then
  assert_check "GCS Bucket Env Alignment" 0 "GCS_PRIVATE_BUCKET='${ENV_PRIVATE}', GCS_DOCUMENTS_BUCKET='${ENV_DOCS}'"
else
  assert_check "GCS Bucket Env Alignment" 1 "Mismatch: PRIVATE='${ENV_PRIVATE}', DOCS='${ENV_DOCS}'"
fi

if [ "${ENV_GCP_PROJECT}" == "${PROJECT_ID}" ]; then
  assert_check "GOOGLE_CLOUD_PROJECT Env Check" 0 "GOOGLE_CLOUD_PROJECT='${PROJECT_ID}'"
else
  assert_check "GOOGLE_CLOUD_PROJECT Env Check" 1 "Invalid GOOGLE_CLOUD_PROJECT='${ENV_GCP_PROJECT}'"
fi

echo "--- 2. Cloud SQL PostgreSQL Instance Deep Checks ---"
SQL_DESC=$(gcloud sql instances describe invoiceready-postgres --format="json" 2>/dev/null || echo "{}")
SQL_STATE=$(echo "${SQL_DESC}" | jq -r '.state // "MISSING"')
BACKUP_ENABLED=$(echo "${SQL_DESC}" | jq -r '.settings.backupConfiguration.enabled // false')
PITR_ENABLED=$(echo "${SQL_DESC}" | jq -r '.settings.backupConfiguration.pointInTimeRecoveryEnabled // false')
DEL_PROT=$(echo "${SQL_DESC}" | jq -r '.deletionProtectionEnabled // false')

if [ "${SQL_STATE}" == "RUNNABLE" ] && [ "${BACKUP_ENABLED}" == "true" ] && [ "${PITR_ENABLED}" == "true" ] && [ "${DEL_PROT}" == "true" ]; then
  assert_check "Cloud SQL PostgreSQL Production Hardening" 0 "State=${SQL_STATE}, Backup=${BACKUP_ENABLED}, PITR=${PITR_ENABLED}, DeletionProtection=${DEL_PROT}"
else
  assert_check "Cloud SQL PostgreSQL Production Hardening" 1 "Cloud SQL verification failed: state=${SQL_STATE}, backup=${BACKUP_ENABLED}, pitr=${PITR_ENABLED}, deletionProt=${DEL_PROT}"
fi

echo "--- 3. IAM Least Privilege Verification ---"
PROJECT_IAM=$(gcloud projects get-iam-policy "${PROJECT_ID}" --format="json" 2>/dev/null || echo "{}")
HAS_BROAD_STORAGE_ADMIN=$(echo "${PROJECT_IAM}" | jq -r --arg SA "serviceAccount:${SERVICE_ACCOUNT}" '.bindings[] | select(.role=="roles/storage.objectAdmin") | .members[] | select(.==$SA)' || echo "")

if [ -z "${HAS_BROAD_STORAGE_ADMIN}" ]; then
  assert_check "IAM Bucket-Scoped Least Privilege" 0 "Runtime SA lacks broad project-wide storage.objectAdmin"
else
  assert_check "IAM Bucket-Scoped Least Privilege" 1 "Security violation: SA possesses broad project-wide storage.objectAdmin"
fi

echo "--- 4. Secret Manager Production Secrets Active Versions ---"
SECRETS_OK=true
for SECRET in DATABASE_URL INTERNAL_TASK_SECRET CRON_SECRET GEMINI_API_KEY; do
  STATE=$(gcloud secrets versions list "${SECRET}" --filter="state=ENABLED" --format="value(state)" 2>/dev/null || echo "")
  if [ -z "${STATE}" ]; then
    SECRETS_OK=false
  fi
done

if [ "${SECRETS_OK}" == "true" ]; then
  assert_check "Secret Manager Active Versions" 0 "DATABASE_URL, INTERNAL_TASK_SECRET, CRON_SECRET, GEMINI_API_KEY have active ENABLED versions"
else
  assert_check "Secret Manager Active Versions" 1 "One or more required secrets lack active versions"
fi

echo "--- 5. Cloud Tasks Queue & OIDC Configuration ---"
QUEUE_DESC=$(gcloud tasks queues describe invoiceready-task-queue --location="${REGION}" --format="json" 2>/dev/null || echo "{}")
QUEUE_STATE=$(echo "${QUEUE_DESC}" | jq -r '.state // "MISSING"')

if [ "${QUEUE_STATE}" == "RUNNING" ]; then
  assert_check "Cloud Tasks Queue Readiness" 0 "Queue state: ${QUEUE_STATE}"
else
  assert_check "Cloud Tasks Queue Readiness" 1 "Queue state: ${QUEUE_STATE}"
fi

echo "--- 6. Cloud Scheduler OIDC Service Account & Audience Binding ---"
SCHEDULER_DESC=$(gcloud scheduler jobs describe invoiceready-retention-job --location="${REGION}" --format="json" 2>/dev/null || echo "{}")
SCHED_SA=$(echo "${SCHEDULER_DESC}" | jq -r '.httpTarget.oidcToken.serviceAccountEmail // ""')
SCHED_AUD=$(echo "${SCHEDULER_DESC}" | jq -r '.httpTarget.oidcToken.audience // ""')

if [ "${SCHED_SA}" == "${SERVICE_ACCOUNT}" ] && [ "${SCHED_AUD}" == "${SERVICE_URL}" ]; then
  assert_check "Cloud Scheduler OIDC Verification" 0 "SA='${SCHED_SA}', Audience='${SCHED_AUD}'"
else
  assert_check "Cloud Scheduler OIDC Verification" 1 "OIDC Mismatch: SA='${SCHED_SA}', Audience='${SCHED_AUD}'"
fi

echo "--- 7. Production Live Negative Security Tests ---"
# Test A: Unauthenticated Worker Call
WORKER_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${SERVICE_URL}/api/internal/queue/worker" -H "Content-Type: application/json" -d '{}' || echo "000")
if [ "${WORKER_HTTP}" -eq 401 ] || [ "${WORKER_HTTP}" -eq 403 ]; then
  assert_check "Unauthenticated Worker Rejection" 0 "Worker request rejected with HTTP ${WORKER_HTTP}"
else
  assert_check "Unauthenticated Worker Rejection" 1 "Expected 401/403, got HTTP ${WORKER_HTTP}"
fi

# Test B: Forged Token Scheduler Call
RETENTION_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${SERVICE_URL}/api/jobs/retention" -H "Authorization: Bearer forged.invalid.token" || echo "000")
if [ "${RETENTION_HTTP}" -eq 401 ] || [ "${RETENTION_HTTP}" -eq 403 ]; then
  assert_check "Forged Token Rejection" 0 "Scheduler request rejected with HTTP ${RETENTION_HTTP}"
else
  assert_check "Forged Token Rejection" 1 "Expected 401/403, got HTTP ${RETENTION_HTTP}"
fi

# Test C: Dev Token Route Unmapped
DEV_TOKEN_HTTP=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/api/auth/token" || echo "000")
if [ "${DEV_TOKEN_HTTP}" -eq 404 ]; then
  assert_check "Dev Endpoint Route Hygiene" 0 "/api/auth/token unmapped (HTTP 404) in production"
else
  assert_check "Dev Endpoint Route Hygiene" 1 "/api/auth/token accessible (HTTP ${DEV_TOKEN_HTTP})"
fi

echo "--- 8. Live Service Health Probe ---"
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/api/health" || echo "000")
if [ "${HEALTH_STATUS}" -eq 200 ]; then
  assert_check "Live Service Health Probe" 0 "Service URL responded with HTTP 200 OK"
else
  assert_check "Live Service Health Probe" 1 "Health check failed with HTTP ${HEALTH_STATUS}"
fi

echo "========================================================================"
echo " Validation Completed: Passed=${PASSED_COUNT}, Failed=${FAILED_COUNT}"
echo "========================================================================"

if [ "${FAILED_COUNT}" -ne 0 ]; then
  exit 1
fi
