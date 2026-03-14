#!/bin/bash
# バックエンド（SAM）デプロイスクリプト
# 使い方: ./scripts/deploy-backend.sh
set -euo pipefail

REGION="ap-northeast-1"
STACK_NAME="facereg-app"

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
  --tags Project=facereg-app

echo "=== デプロイ完了 ==="
echo "スタック出力値:"
aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs" \
  --output table

echo "不要期間は ./scripts/destroy-stack.sh でスタックを削除し、継続課金を避けてください。"
