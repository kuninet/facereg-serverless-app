#!/bin/bash
# バックエンド（SAM）デプロイスクリプト
# 使い方: ./scripts/deploy-backend.sh
set -euo pipefail

REGION="ap-northeast-1"
STACK_NAME="facereg-app"

if [ -z "${ADMIN_AUTH_CREDENTIALS:-}" ]; then
  echo "ADMIN_AUTH_CREDENTIALS 環境変数を設定してください。例: export ADMIN_AUTH_CREDENTIALS='admin:strong-password'"
  exit 1
fi

echo "=== SAM ビルド ==="
cd backend
sam build

echo "=== SAM デプロイ ==="
sam deploy \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --no-confirm-changeset \
  --parameter-overrides AdminAuthCredentials="$ADMIN_AUTH_CREDENTIALS" \
  --tags Project=facereg-app

echo "=== デプロイ完了 ==="
echo "スタック出力値:"
aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs" \
  --output table
