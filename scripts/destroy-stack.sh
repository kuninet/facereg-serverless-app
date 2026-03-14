#!/bin/bash
# 継続課金を残さないためのスタック撤去スクリプト
# 使い方: ./scripts/destroy-stack.sh
set -euo pipefail

REGION="ap-northeast-1"
STACK_NAME="facereg-app"

if ! aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" >/dev/null 2>&1; then
  echo "スタック ${STACK_NAME} は存在しません。"
  exit 0
fi

FRONTEND_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" \
  --output text)

PHOTOS_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='PhotosBucketName'].OutputValue" \
  --output text)

echo "=== フロントエンドバケットを空にします ==="
aws s3 rm "s3://${FRONTEND_BUCKET}" --recursive --region "$REGION" || true

echo "=== 写真バケットを空にします ==="
aws s3 rm "s3://${PHOTOS_BUCKET}" --recursive --region "$REGION" || true

echo "=== CloudFormation スタックを削除します ==="
aws cloudformation delete-stack --stack-name "$STACK_NAME" --region "$REGION"

echo "削除開始済みです。完了確認:"
echo "aws cloudformation wait stack-delete-complete --stack-name ${STACK_NAME} --region ${REGION}"
