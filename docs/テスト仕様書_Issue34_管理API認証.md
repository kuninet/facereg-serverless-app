# テスト仕様書: Issue #34 管理画面API実認証

## 1. 目的

管理画面の見かけ上のログインではなく、`/admin/*` API に対して実認証が必須になっていることを確認する。
あわせて、継続課金を増やさない前提で採用した `API Gateway + Lambda Authorizer + Basic 認証` の導線が破綻していないことを確認する。

## 2. 対象

- [backend/template.yaml](/Users/kuninet/git/顔写真登録アプリ/backend/template.yaml)
- [backend/src/auth/app.js](/Users/kuninet/git/顔写真登録アプリ/backend/src/auth/app.js)
- [frontend/src/api/apiClient.ts](/Users/kuninet/git/顔写真登録アプリ/frontend/src/api/apiClient.ts)
- [frontend/src/pages/admin/AdminApp.tsx](/Users/kuninet/git/顔写真登録アプリ/frontend/src/pages/admin/AdminApp.tsx)
- [frontend/tests/admin.spec.ts](/Users/kuninet/git/顔写真登録アプリ/frontend/tests/admin.spec.ts)

## 3. 前提条件

- 管理画面 API の認証情報は `ADMIN_AUTH_CREDENTIALS` としてデプロイ時に注入される。
- フロントエンドはログイン時に入力した ID / パスワードから Basic 認証ヘッダを生成する。
- `/admin/entries` と `/admin/entries/bulk-delete` は API Gateway Authorizer を必須とする。

## 4. テスト観点

### 4.1 インフラ設定

1. 管理 API に Authorizer が設定されていること。
2. 認証情報が SAM テンプレートの `NoEcho` パラメータで渡されること。
3. デプロイスクリプトが `ADMIN_AUTH_CREDENTIALS` 未設定時に失敗すること。

### 4.2 バックエンド認証ロジック

1. 正しい Basic 認証情報では `Allow` ポリシーを返すこと。
2. 誤った ID / パスワードでは `Unauthorized` となること。
3. `Authorization` ヘッダ欠落時も `Unauthorized` となること。

### 4.3 フロントエンドログイン導線

1. 正しい認証情報ではログイン後に一覧画面が表示されること。
2. 誤った認証情報ではダッシュボードへ遷移しないこと。
3. 認証失敗時に管理者へ分かるエラーメッセージが表示されること。
4. 一覧再取得と一括削除で同じ認証ヘッダが送られること。

### 4.4 退行確認

1. バックエンドの既存ユニットテストが全件成功すること。
2. フロントエンドの本番ビルドが成功すること。
3. 管理画面 E2E テストが成功すること。

## 5. 実行コマンド

```bash
# インフラ定義
sam validate --template-file backend/template.yaml

# バックエンドユニットテスト
cd backend && npm test

# フロントエンドビルド
cd frontend && npm run build

# 管理画面 E2E
cd frontend && ./node_modules/.bin/playwright test tests/admin.spec.ts --config playwright.config.ts --project=chromium
```

## 6. 期待結果

- `sam validate` が成功する。
- `backend` のテストで認証 Authorizer の 3 ケースを含め、全テストが成功する。
- `frontend` のビルドが型エラーなしで成功する。
- Playwright で以下 2 シナリオが成功する。
  - 正しい認証情報でログインし、一覧画面が表示される。
  - 誤った認証情報ではログインできず、エラーメッセージが表示される。

## 7. 今回の結果保存先

- [tmp/test-results/20260314-110117](/Users/kuninet/git/顔写真登録アプリ/tmp/test-results/20260314-110117)

このディレクトリは `.gitignore` 済みで、テスト結果の再確認専用とする。
