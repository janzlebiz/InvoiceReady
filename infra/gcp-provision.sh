#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# InvoiceReady / Regulenta - Production GCP Provisioning Script (Phase 21)
# Project ID: gen-lang-client-0427039673
# Region: asia-east1
# ==============================================================================

PROJECT_ID="gen-lang-client-0427039673"
REGION="asia-east1"
SERVICE_ACCOUNT="invoiceready-runner@${PROJECT_ID}.iam.gserviceaccount.com"
DB_INSTANCE="invoiceready-postgres"
DB_NAME="invoiceready_prod"
QUARANTINE_BUCKET="${PROJECT_ID}-quarantine"
DOCUMENTS_BUCKET="${PROJECT_ID}-documents"
TASK_QUEUE="invoiceready-task-queue"
SCHEDULER_JOB="invoiceready-retention-job"
REPO_NAME="invoiceready-repo"

echo "=== [1/8] Setting GCP Project and Enabling Required APIs ==="
gcloud config set project "${PROJECT_ID}"
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  cloudtasks.googleapis.com \
  cloudscheduler.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  artifactregistry.googleapis.com \
  vpcaccess.googleapis.com

echo "=== [2/8] Creating Artifact Registry Repository ==="
if ! gcloud artifacts repositories describe "${REPO_NAME}" --location="${REGION}" &>/dev/null; then
  gcloud artifacts repositories create "${REPO_NAME}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="InvoiceReady Production Container Registry"
fi

echo "=== [3/8] Creating IAM Service Account & Bucket-Scoped Role Bindings ==="
if ! gcloud iam service-accounts describe "${SERVICE_ACCOUNT}" &>/dev/null; then
  gcloud iam service-accounts create invoiceready-runner \
    --display-name="InvoiceReady Cloud Run Runtime SA"
fi

# Project-level non-storage roles (Least Privilege)
PROJECT_ROLES=(
  "roles/cloudsql.client"
  "roles/cloudtasks.enqueuer"
  "roles/secretmanager.secretAccessor"
)

for ROLE in "${PROJECT_ROLES[@]}"; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="${ROLE}"
done

echo "=== [4/8] Provisioning Cloud SQL PostgreSQL Instance & Networking ==="
if ! gcloud sql instances describe "${DB_INSTANCE}" &>/dev/null; then
  gcloud sql instances create "${DB_INSTANCE}" \
    --database-version=POSTGRES_15 \
    --tier=db-custom-2-7680 \
    --region="${REGION}" \
    --storage-auto-increase \
    --backup-start-time=02:00 \
    --enable-point-in-time-recovery \
    --deletion-protection
fi

if ! gcloud sql databases describe "${DB_NAME}" --instance="${DB_INSTANCE}" &>/dev/null; then
  gcloud sql databases create "${DB_NAME}" --instance="${DB_INSTANCE}"
fi

echo "=== [5/8] Provisioning GCS Buckets with Bucket-Scoped Least Privilege ==="
# Quarantine Bucket (24-hour retention)
if ! gsutil ls -b "gs://${QUARANTINE_BUCKET}" &>/dev/null; then
  gsutil mb -p "${PROJECT_ID}" -l "${REGION}" -b on "gs://${QUARANTINE_BUCKET}"
fi
gsutil lifecycle set infra/gcs-lifecycle-quarantine.json "gs://${QUARANTINE_BUCKET}"
# Bucket-scoped objectAdmin binding ONLY
gsutil iam ch "serviceAccount:${SERVICE_ACCOUNT}:objectAdmin" "gs://${QUARANTINE_BUCKET}"

# Documents Bucket (30-day retention, strictly private)
if ! gsutil ls -b "gs://${DOCUMENTS_BUCKET}" &>/dev/null; then
  gsutil mb -p "${PROJECT_ID}" -l "${REGION}" -b on "gs://${DOCUMENTS_BUCKET}"
fi
gsutil lifecycle set infra/gcs-lifecycle-documents.json "gs://${DOCUMENTS_BUCKET}"
gcloud storage buckets update "gs://${DOCUMENTS_BUCKET}" --public-access-prevention
# Bucket-scoped objectAdmin binding ONLY
gsutil iam ch "serviceAccount:${SERVICE_ACCOUNT}:objectAdmin" "gs://${DOCUMENTS_BUCKET}"

echo "=== [6/8] Provisioning Secret Manager Production Secrets ==="
SECRETS=("DATABASE_URL" "INTERNAL_TASK_SECRET" "CRON_SECRET" "GEMINI_API_KEY")

for SECRET in "${SECRETS[@]}"; do
  if ! gcloud secrets describe "${SECRET}" &>/dev/null; then
    gcloud secrets create "${SECRET}" --replication-policy="automatic"
  fi
  gcloud secrets add-iam-policy-binding "${SECRET}" \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor"
done

echo "=== [7/8] Provisioning Cloud Tasks Queue with OIDC Authorization ==="
if ! gcloud tasks queues describe "${TASK_QUEUE}" --location="${REGION}" &>/dev/null; then
  gcloud tasks queues create "${TASK_QUEUE}" \
    --location="${REGION}" \
    --max-dispatches-per-second=50 \
    --max-concurrent-dispatches=20 \
    --max-attempts=5
fi

echo "=== [8/8] Provisioning Cloud Scheduler Retention Job with OIDC Token ==="
SERVICE_URL=$(gcloud run services describe invoiceready-prod --region="${REGION}" --format="value(status.url)" 2>/dev/null || echo "https://invoiceready-prod-epvy5srfb5ewhdo7mgmmu7-212282537635.asia-east1.run.app")

if ! gcloud scheduler jobs describe "${SCHEDULER_JOB}" --location="${REGION}" &>/dev/null; then
  gcloud scheduler jobs create http "${SCHEDULER_JOB}" \
    --location="${REGION}" \
    --schedule="0 2 * * *" \
    --uri="${SERVICE_URL}/api/jobs/retention" \
    --http-method="POST" \
    --oidc-service-account-email="${SERVICE_ACCOUNT}" \
    --oidc-token-audience="${SERVICE_URL}"
fi

echo "=== GCP Infrastructure Provisioning Complete ==="
