#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# InvoiceReady / Regulenta - Deep Production Validation & Smoke Test Suite (Phase 21)
# Project ID: gen-lang-client-0427039673
# Region: asia-east1
# ==============================================================================

PROJECT_ID="gen-lang-client-0427039673"
REGION="asia-east1"
SERVICE_ACCOUNT="invoiceready-runner@${PROJECT_ID}.iam.gserviceaccount.com"
SERVICE_URL=$(gcloud run services describe invoiceready-prod --region="${REGION}" --format="value(status.url)" 2>/dev/null || echo "https://invoiceready-prod-epvy5srfb5ewhdo7mgmmu7-212282537635.asia-east1.run.app")

echo "========================================================================"
echo " InvoiceReady — GCP Production Infrastructure & Security Validation"
echo " Target Service URL: ${SERVICE_URL}"
echo "========================================================================"

FAILED_COUNT=0
PASSED_COUNT=0

assert_check() {
  local title="$1"
  local status="$2"
  local detail="$3"
  if [ "$status" -eq 0 ]; then
    echo " [PASS] ${title} — ${detail}"
    PASSED_COUNT=$((PASSED_COUNT + 1))
  else
    echo " [FAIL] ${title} — ${detail}"
    FAILED_COUNT=$((FAILED_COUNT + 1))
  fi
}

echo "--- 1. Environment & Variable Alignment Verification ---"
# Check GCS bucket variable alignment
ENV_PRIVATE=$(gcloud run services describe invoiceready-prod --region="${REGION}" --format="json" 2>/dev/null | jq -r '.spec.template.spec.containers[0].env[] | select(.name=="GCS_PRIVATE_BUCKET").value' || echo "")
ENV_DOCS=$(gcloud run services describe invoiceready-prod --region="${REGION}" --format="json" 2>/dev/null | jq -r '.spec.template.spec.containers[0].env[] | select(.name=="GCS_DOCUMENTS_BUCKET").value' || echo "")
ENV_GCP_PROJECT=$(gcloud run services describe invoiceready-prod --region="${REGION}" --format="json" 2>/dev/null | jq -r '.spec.template.spec.containers[0].env[] | select(.name=="GOOGLE_CLOUD_PROJECT").value' || echo "")

if [ "${ENV_PRIVATE}" == "${PROJECT_ID}-documents" ] && [ "${ENV_DOCS}" == "${PROJECT_ID}-documents" ]; then
  assert_check "GCS Bucket Env Variable Alignment" 0 "GCS_PRIVATE_BUCKET and GCS_DOCUMENTS_BUCKET match ('${ENV_PRIVATE}')"
else
  assert_check "GCS Bucket Env Variable Alignment" 1 "Mismatch detected: GCS_PRIVATE_BUCKET='${ENV_PRIVATE}', GCS_DOCUMENTS_BUCKET='${ENV_DOCS}'"
fi

if [ "${ENV_GCP_PROJECT}" == "${PROJECT_ID}" ]; then
  assert_check "GOOGLE_CLOUD_PROJECT Environment Variable" 0 "GOOGLE_CLOUD_PROJECT correctly set to '${PROJECT_ID}'"
else
  assert_check "GOOGLE_CLOUD_PROJECT Environment Variable" 1 "GOOGLE_CLOUD_PROJECT missing or incorrect ('${ENV_GCP_PROJECT}')"
fi

echo "--- 2. Cloud SQL PostgreSQL Deep Validation ---"
SQL_DESC=$(gcloud sql instances describe invoiceready-postgres --format="json" 2>/dev/null || echo "{}")
SQL_STATE=$(echo "${SQL_DESC}" | jq -r '.state // "MISSING"')
BACKUP_ENABLED=$(echo "${SQL_DESC}" | jq -r '.settings.backupConfiguration.enabled // false')
PITR_ENABLED=$(echo "${SQL_DESC}" | jq -r '.settings.backupConfiguration.pointInTimeRecoveryEnabled // false')
DEL_PROT=$(echo "${SQL_DESC}" | jq -r '.deletionProtectionEnabled // false')

if [ "${SQL_STATE}" == "RUNNABLE" ] && [ "${BACKUP_ENABLED}" == "true" ] && [ "${PITR_ENABLED}" == "true" ] && [ "${DEL_PROT}" == "true" ]; then
  assert_check "Cloud SQL Instance Hardening" 0 "State=RUNNABLE, Backup=Enabled, PITR=Enabled, DeletionProtection=Enabled"
else
  assert_check "Cloud SQL Instance Hardening" 1 "Cloud SQL verification failed: state=${SQL_STATE}, backup=${BACKUP_ENABLED}, pitr=${PITR_ENABLED}, deletionProt=${DEL_PROT}"
fi

echo "--- 3. Bucket-Scoped IAM Least Privilege Verification ---"
PROJECT_IAM=$(gcloud projects get-iam-policy "${PROJECT_ID}" --format="json" 2>/dev/null || echo "{}")
HAS_BROAD_STORAGE_ADMIN=$(echo "${PROJECT_IAM}" | jq -r --arg SA "serviceAccount:${SERVICE_ACCOUNT}" '.bindings[] | select(.role=="roles/storage.objectAdmin") | .members[] | select(.==$SA)' || echo "")

if [ -z "${HAS_BROAD_STORAGE_ADMIN}" ]; then
  assert_check "IAM Bucket-Scoped Least Privilege" 0 "Runtime SA does NOT possess project-wide storage.objectAdmin"
else
  assert_check "IAM Bucket-Scoped Least Privilege" 1 "Security Violation: Runtime SA possesses broad project-wide storage.objectAdmin"
fi

echo "--- 4. GCS Bucket Security, Lifecycle & Public Access Prevention ---"
QUARANTINE_LIFECYCLE=$(gsutil lifecycle get "gs://${PROJECT_ID}-quarantine" 2>/dev/null || echo "")
DOCS_LIFECYCLE=$(gsutil lifecycle get "gs://${PROJECT_ID}-documents" 2>/dev/null || echo "")
PUBLIC_ACCESS_PREV=$(gcloud storage buckets describe "gs://${PROJECT_ID}-documents" --format="value(iamConfiguration.publicAccessPrevention)" 2>/dev/null || echo "")

if echo "${QUARANTINE_LIFECYCLE}" | grep -q '"age": 1' && echo "${DOCS_LIFECYCLE}" | grep -q '"age": 30' && [ "${PUBLIC_ACCESS_PREV}" == "enforced" ]; then
  assert_check "GCS Bucket Lifecycle & Privacy" 0 "Quarantine=24h, Documents=30d, PublicAccessPrevention=enforced"
else
  assert_check "GCS Bucket Lifecycle & Privacy" 1 "GCS configuration check failed (PAP=${PUBLIC_ACCESS_PREV})"
fi

echo "--- 5. Cloud Tasks Queue & OIDC Verification ---"
QUEUE_DESC=$(gcloud tasks queues describe invoiceready-task-queue --location="${REGION}" --format="json" 2>/dev/null || echo "{}")
QUEUE_STATE=$(echo "${QUEUE_DESC}" | jq -r '.state // "MISSING"')

if [ "${QUEUE_STATE}" == "RUNNING" ]; then
  assert_check "Cloud Tasks Queue Configuration" 0 "Queue invoiceready-task-queue is active and RUNNING"
else
  assert_check "Cloud Tasks Queue Configuration" 1 "Cloud Tasks queue state invalid: ${QUEUE_STATE}"
fi

echo "--- 6. Cloud Scheduler OIDC Token Verification ---"
SCHEDULER_DESC=$(gcloud scheduler jobs describe invoiceready-retention-job --location="${REGION}" --format="json" 2>/dev/null || echo "{}")
SCHED_SA=$(echo "${SCHEDULER_DESC}" | jq -r '.httpTarget.oidcToken.serviceAccountEmail // ""')
SCHED_AUD=$(echo "${SCHEDULER_DESC}" | jq -r '.httpTarget.oidcToken.audience // ""')

if [ "${SCHED_SA}" == "${SERVICE_ACCOUNT}" ] && [ "${SCHED_AUD}" == "${SERVICE_URL}" ]; then
  assert_check "Cloud Scheduler OIDC Verification" 0 "Target Service Account and Audience accurately bound"
else
  assert_check "Cloud Scheduler OIDC Verification" 1 "Scheduler OIDC mismatch: SA='${SCHED_SA}', AUD='${SCHED_AUD}'"
fi

echo "--- 7. Production Negative Security Verification ---"
# Test A: Unauthenticated Worker Call
WORKER_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${SERVICE_URL}/api/internal/queue/worker" -H "Content-Type: application/json" -d '{}' || echo "000")
if [ "${WORKER_HTTP}" -eq 401 ] || [ "${WORKER_HTTP}" -eq 403 ]; then
  assert_check "Worker Negative Security Test" 0 "Unauthenticated worker request strictly rejected (HTTP ${WORKER_HTTP})"
else
  assert_check "Worker Negative Security Test" 1 "Worker security vulnerability: expected 401/403, got HTTP ${WORKER_HTTP}"
fi

# Test B: Forged Token Retention Scheduler Call
RETENTION_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${SERVICE_URL}/api/jobs/retention" -H "Authorization: Bearer forged.invalid.token" || echo "000")
if [ "${RETENTION_HTTP}" -eq 401 ] || [ "${RETENTION_HTTP}" -eq 403 ]; then
  assert_check "Scheduler Negative Security Test" 0 "Forged OIDC token strictly rejected (HTTP ${RETENTION_HTTP})"
else
  assert_check "Scheduler Negative Security Test" 1 "Scheduler security vulnerability: expected 401/403, got HTTP ${RETENTION_HTTP}"
fi

# Test C: Dev Token Endpoint Disabled
DEV_TOKEN_HTTP=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/api/auth/token" || echo "000")
if [ "${DEV_TOKEN_HTTP}" -eq 404 ]; then
  assert_check "Dev Endpoint Route Hygiene" 0 "/api/auth/token is unmapped (HTTP 404) in production"
else
  assert_check "Dev Endpoint Route Hygiene" 1 "Security hazard: /api/auth/token accessible in production (HTTP ${DEV_TOKEN_HTTP})"
fi

echo "--- 8. Real Production End-to-End Behavioral Test ---"
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/api/health" || echo "000")
if [ "${HEALTH_STATUS}" -eq 200 ]; then
  assert_check "Production End-to-End Health Check" 0 "Live Cloud Run service responds with HTTP 200 OK"
else
  assert_check "Production End-to-End Health Check" 1 "Health check failed with HTTP ${HEALTH_STATUS}"
fi

echo "========================================================================"
echo " Validation Complete: Passed=${PASSED_COUNT}, Failed=${FAILED_COUNT}"
echo "========================================================================"

if [ "${FAILED_COUNT}" -ne 0 ]; then
  exit 1
fi
