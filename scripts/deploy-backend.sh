#!/bin/bash
# バックエンド（SAM）デプロイスクリプト
# 使い方: ./scripts/deploy-backend.sh
set -euo pipefail

REGION="ap-northeast-1"
STACK_NAME="facereg-app"
DEPLOY_ENV_FILE=".env.deploy"

if [ -f "$DEPLOY_ENV_FILE" ]; then
  set -a
  . "./${DEPLOY_ENV_FILE}"
  set +a
fi

if [ -z "${ADMIN_AUTH_CREDENTIALS:-}" ]; then
  echo "${DEPLOY_ENV_FILE} を作成するか、ADMIN_AUTH_CREDENTIALS 環境変数を設定してください。"
  echo "例: cp .env.deploy.example .env.deploy"
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

echo "不要期間は ./scripts/destroy-stack.sh でスタックを削除し、継続課金を避けてください。"
