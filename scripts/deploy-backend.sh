#!/bin/bash
# バックエンド（SAM）デプロイスクリプト
# 使い方: ./scripts/deploy-backend.sh
set -euo pipefail

REGION="ap-northeast-1"
STACK_NAME="facereg-app"
PHASE1_TEMPLATE=".codex-bootstrap-admin-auth-template.yaml"
PHASE1_BUILD_DIR=".aws-sam/bootstrap-build"
DEPLOY_ENV_FILE=".env.deploy"

if [ -z "${ADMIN_AUTH_CREDENTIALS:-}" ] && [ -f "$DEPLOY_ENV_FILE" ]; then
  set -a
  . "./${DEPLOY_ENV_FILE}"
  set +a
fi

deploy_stack() {
  local template_file="$1"
  local build_dir="$2"
  local label="$3"

  echo "=== SAM ビルド (${label}) ==="
  sam build --template-file "$template_file" --build-dir "$build_dir"

  echo "=== SAM デプロイ (${label}) ==="
  sam deploy \
    --template-file "${build_dir}/template.yaml" \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --resolve-s3 \
    --capabilities CAPABILITY_IAM \
    --no-confirm-changeset \
    --parameter-overrides AdminAuthCredentials="$ADMIN_AUTH_CREDENTIALS" \
    --tags Project=facereg-app
}

cleanup_phase1_template() {
  rm -f "$PHASE1_TEMPLATE"
}

delete_unmanaged_log_group_if_needed() {
  local function_logical_id="$1"
  local log_group_logical_id="$2"

  if aws cloudformation describe-stack-resource \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --logical-resource-id "$log_group_logical_id" >/dev/null 2>&1; then
    return
  fi

  local function_name
  function_name="$(
    aws cloudformation describe-stack-resource \
      --stack-name "$STACK_NAME" \
      --region "$REGION" \
      --logical-resource-id "$function_logical_id" \
      --query 'StackResourceDetail.PhysicalResourceId' \
      --output text 2>/dev/null || true
  )"

  if [ -z "$function_name" ] || [ "$function_name" = "None" ]; then
    return
  fi

  echo "CloudFormation 管理前の既存ロググループを削除します: /aws/lambda/${function_name}"
  aws logs delete-log-group \
    --region "$REGION" \
    --log-group-name "/aws/lambda/${function_name}" >/dev/null 2>&1 || true
}

prepare_managed_log_groups() {
  delete_unmanaged_log_group_if_needed InitializeUploadFunction InitializeUploadLogGroup
  delete_unmanaged_log_group_if_needed RegisterEntryFunction RegisterEntryLogGroup
  delete_unmanaged_log_group_if_needed ListEntriesFunction ListEntriesLogGroup
  delete_unmanaged_log_group_if_needed BulkDeleteFunction BulkDeleteLogGroup
}

create_phase1_template() {
  perl -0pe '
    s/\n      Auth:\n        Authorizers:\n          AdminApiAuthorizer:\n            FunctionArn: !GetAtt AdminAuthorizerFunction.Arn\n            FunctionPayloadType: TOKEN\n            Identity:\n              Header: Authorization\n              ReauthorizeEvery: 0//s;
    s/\n            Auth:\n              Authorizer: AdminApiAuthorizer//g;
  ' template.yaml > "$PHASE1_TEMPLATE"
}

if [ -z "${ADMIN_AUTH_CREDENTIALS:-}" ]; then
  echo "${DEPLOY_ENV_FILE} を作成するか、ADMIN_AUTH_CREDENTIALS 環境変数を設定してください。"
  echo "例: cp .env.deploy.example .env.deploy"
  exit 1
fi

cd backend
prepare_managed_log_groups

if ! aws cloudformation describe-stack-resource \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --logical-resource-id AdminAuthorizerFunction >/dev/null 2>&1; then
  echo "AdminAuthorizerFunction が未作成のため、初回導入として 2 段階デプロイを実行します。"
  trap cleanup_phase1_template EXIT
  create_phase1_template
  deploy_stack "$PHASE1_TEMPLATE" "$PHASE1_BUILD_DIR" "初回導入フェーズ1"
fi

deploy_stack "template.yaml" ".aws-sam/build" "通常フェーズ"

echo "=== デプロイ完了 ==="
echo "スタック出力値:"
aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs" \
  --output table

echo "不要期間は ./scripts/destroy-stack.sh でスタックを削除し、継続課金を避けてください。"
