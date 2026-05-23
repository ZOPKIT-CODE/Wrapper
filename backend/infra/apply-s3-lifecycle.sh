#!/usr/bin/env bash
# Apply the 7-day expiry lifecycle rule to the Platform Bus claim-check S3 bucket.
#
# Run once after the bucket is created, or after any manual bucket re-creation.
# Requires: AWS CLI configured with credentials that have s3:PutLifecycleConfiguration.
#
# Environment variables:
#   PLATFORM_BUS_CLAIM_CHECK_BUCKET  — name of the S3 bucket (required)
#   AWS_REGION                        — AWS region (optional, uses CLI default)
#
# Usage:
#   PLATFORM_BUS_CLAIM_CHECK_BUCKET=my-bucket ./infra/apply-s3-lifecycle.sh
set -euo pipefail

BUCKET="${PLATFORM_BUS_CLAIM_CHECK_BUCKET:?PLATFORM_BUS_CLAIM_CHECK_BUCKET env var is required}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIFECYCLE_FILE="${SCRIPT_DIR}/s3-lifecycle.json"

if [[ ! -f "${LIFECYCLE_FILE}" ]]; then
  echo "ERROR: lifecycle config not found at ${LIFECYCLE_FILE}" >&2
  exit 1
fi

echo "Applying S3 lifecycle rule to s3://${BUCKET} ..."
aws s3api put-bucket-lifecycle-configuration \
  --bucket "${BUCKET}" \
  --lifecycle-configuration "file://${LIFECYCLE_FILE}" \
  ${AWS_REGION:+--region "${AWS_REGION}"}

echo "Done — objects under platform-bus/ prefix will expire after 7 days."
echo "Verify: aws s3api get-bucket-lifecycle-configuration --bucket ${BUCKET}"
