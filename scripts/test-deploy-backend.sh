#!/bin/bash
# deploy-backend.sh の段階デプロイ分岐をローカルで確認するテスト
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

LOG_FILE="$TMP_DIR/commands.log"
STATE_FILE="$TMP_DIR/authorizer-created"

cat > "$TMP_DIR/aws" <<'EOF'
#!/bin/bash
set -euo pipefail
echo "aws $*" >> "$TEST_LOG_FILE"

if [ "$1" = "cloudformation" ] && [ "$2" = "describe-stack-resource" ]; then
  logical_id=""
  previous=""
  for arg in "$@"; do
    if [ "$previous" = "--logical-resource-id" ]; then
      logical_id="$arg"
      break
    fi
    previous="$arg"
  done

  case "$logical_id" in
    InitializeUploadFunction)
      echo '{"StackResourceDetail":{"PhysicalResourceId":"facereg-app-InitializeUploadFunction"}}'
      exit 0
      ;;
    RegisterEntryFunction)
      echo '{"StackResourceDetail":{"PhysicalResourceId":"facereg-app-RegisterEntryFunction"}}'
      exit 0
      ;;
    ListEntriesFunction)
      echo '{"StackResourceDetail":{"PhysicalResourceId":"facereg-app-ListEntriesFunction"}}'
      exit 0
      ;;
    BulkDeleteFunction)
      echo '{"StackResourceDetail":{"PhysicalResourceId":"facereg-app-BulkDeleteFunction"}}'
      exit 0
      ;;
    InitializeUploadLogGroup|RegisterEntryLogGroup|ListEntriesLogGroup|BulkDeleteLogGroup)
      if [ -f "$TEST_STATE_FILE" ]; then
        echo '{"StackResourceDetail":{"LogicalResourceId":"ManagedLogGroup"}}'
        exit 0
      fi
      exit 255
      ;;
  esac

  if [ -f "$TEST_STATE_FILE" ]; then
    echo '{"StackResourceDetail":{"LogicalResourceId":"AdminAuthorizerFunction"}}'
    exit 0
  fi
  exit 255
fi

if [ "$1" = "logs" ] && [ "$2" = "delete-log-group" ]; then
  exit 0
fi

if [ "$1" = "cloudformation" ] && [ "$2" = "describe-stacks" ]; then
  echo '{"Stacks":[{"Outputs":[]}]}'
  exit 0
fi

exit 0
EOF

cat > "$TMP_DIR/sam" <<'EOF'
#!/bin/bash
set -euo pipefail
echo "sam $*" >> "$TEST_LOG_FILE"

if [ "$1" = "build" ]; then
  exit 0
fi

if [ "$1" = "deploy" ]; then
  if [[ "$*" == *".aws-sam/bootstrap-build/template.yaml"* ]]; then
    touch "$TEST_STATE_FILE"
  fi
  exit 0
fi

exit 0
EOF

chmod +x "$TMP_DIR/aws" "$TMP_DIR/sam"

assert_contains() {
  local pattern="$1"
  if ! rg -F "$pattern" "$LOG_FILE" >/dev/null; then
    echo "期待したパターンが見つかりません: $pattern" >&2
    exit 1
  fi
}

assert_count() {
  local pattern="$1"
  local expected="$2"
  local actual
  actual="$(rg -F -c "$pattern" "$LOG_FILE" || true)"
  actual="${actual:-0}"
  if [ "$actual" -ne "$expected" ]; then
    echo "出現回数が一致しません: $pattern expected=$expected actual=$actual" >&2
    exit 1
  fi
}

run_case() {
  local label="$1"
  local precreate_state="$2"

  : > "$LOG_FILE"
  rm -f "$STATE_FILE"
  if [ "$precreate_state" = "true" ]; then
    touch "$STATE_FILE"
  fi

  (
    cd "$ROOT_DIR"
    PATH="$TMP_DIR:$PATH" \
    TEST_LOG_FILE="$LOG_FILE" \
    TEST_STATE_FILE="$STATE_FILE" \
    ADMIN_AUTH_CREDENTIALS="admin:test-password" \
    UPLOAD_TOKEN_SECRET="test-upload-token-secret" \
    ALLOWED_CORS_ORIGIN="https://app.example.com" \
    ./scripts/deploy-backend.sh >/dev/null
  )

  if [ "$label" = "initial" ]; then
    assert_count "aws logs delete-log-group" 4
    assert_contains "sam build --template-file .codex-bootstrap-admin-auth-template.yaml --build-dir .aws-sam/bootstrap-build"
    assert_contains "sam deploy --template-file .aws-sam/bootstrap-build/template.yaml --stack-name facereg-app --region ap-northeast-1 --resolve-s3 --capabilities CAPABILITY_IAM --no-confirm-changeset --parameter-overrides AdminAuthCredentials=admin:test-password UploadTokenSecret=test-upload-token-secret AllowedCorsOrigin=https://app.example.com --tags Project=facereg-app"
    assert_contains "sam build --template-file template.yaml --build-dir .aws-sam/build"
    assert_contains "sam deploy --template-file .aws-sam/build/template.yaml --stack-name facereg-app --region ap-northeast-1 --resolve-s3 --capabilities CAPABILITY_IAM --no-confirm-changeset --parameter-overrides AdminAuthCredentials=admin:test-password UploadTokenSecret=test-upload-token-secret AllowedCorsOrigin=https://app.example.com --tags Project=facereg-app"
    assert_count "sam build" 2
    assert_count "sam deploy" 2
  else
    assert_count "aws logs delete-log-group" 0
    assert_contains "sam build --template-file template.yaml --build-dir .aws-sam/build"
    assert_contains "sam deploy --template-file .aws-sam/build/template.yaml --stack-name facereg-app --region ap-northeast-1 --resolve-s3 --capabilities CAPABILITY_IAM --no-confirm-changeset --parameter-overrides AdminAuthCredentials=admin:test-password UploadTokenSecret=test-upload-token-secret AllowedCorsOrigin=https://app.example.com --tags Project=facereg-app"
    assert_count "sam build" 1
    assert_count "sam deploy" 1
  fi
}

run_case initial false
run_case subsequent true

echo "deploy-backend.sh の段階デプロイテストに成功しました。"
