#!/usr/bin/env bash
# InvoiceReady - Authoritative Production Service URL Export
# Canonical URL: https://invoiceready-prod-epvy5srfb5ewhdo7mgmmu7-212282537635.asia-east1.run.app

export SERVICE_URL="https://invoiceready-prod-epvy5srfb5ewhdo7mgmmu7-212282537635.asia-east1.run.app"
export APP_URL="https://invoiceready-prod-epvy5srfb5ewhdo7mgmmu7-212282537635.asia-east1.run.app"
export GOOGLE_CLOUD_PROJECT="gen-lang-client-0427039673"
export CLOUD_RUN_REGION="asia-east1"
export CLOUD_RUN_SERVICE="invoiceready-prod"
export CLOUD_TASKS_QUEUE="invoiceready-task-queue"
export CLOUD_TASKS_LOCATION="asia-east1"
export CLOUD_TASKS_SERVICE_ACCOUNT="invoiceready-runner@gen-lang-client-0427039673.iam.gserviceaccount.com"
export CLOUD_TASKS_AUDIENCE="https://invoiceready-prod-epvy5srfb5ewhdo7mgmmu7-212282537635.asia-east1.run.app"
export GCS_PRIVATE_BUCKET="gen-lang-client-0427039673-documents"
export GCS_QUARANTINE_BUCKET="gen-lang-client-0427039673-quarantine"
export INTERNAL_TASK_SECRET="invoiceready-cloud-tasks-secret-2026-auth"
export CRON_SECRET="invoiceready-scheduler-retention-secret-2026"

echo "Exported SERVICE_URL=${SERVICE_URL}"
