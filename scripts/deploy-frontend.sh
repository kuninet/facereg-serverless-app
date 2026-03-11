#!/bin/bash
# フロントエンドデプロイスクリプト
# 使い方: ./scripts/deploy-frontend.sh
set -euo pipefail

REGION="ap-northeast-1"
STACK_NAME="facereg-app"

# CloudFormation Outputs からバケット名と Distribution ID を取得
FRONTEND_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" \
  --output text)

DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
  --output text)

CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontURL'].OutputValue" \
  --output text)

echo "=== フロントエンドビルド ==="
cd frontend
npm run build

echo "=== S3 へアップロード ==="
aws s3 sync dist/ "s3://${FRONTEND_BUCKET}" \
  --delete \
  --region "$REGION"

echo "=== CloudFront キャッシュクリア ==="
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" \
  --no-cli-pager

echo "=== デプロイ完了 ==="
echo "アクセスURL: ${CLOUDFRONT_URL}"
