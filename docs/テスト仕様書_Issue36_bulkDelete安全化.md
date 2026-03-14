# テスト仕様書: Issue #36 bulkDelete 安全化

## 1. 目的

管理API の `bulkDelete` がクライアント指定の `photo_url` を信頼せず、DynamoDB 上の正当なエントリーに紐づく S3 オブジェクトだけを削除することを確認する。

## 2. 対象

- [backend/src/admin/app.js](/Users/kuninet/git/顔写真登録アプリ/backend/src/admin/app.js)
- [backend/src/admin/app.test.js](/Users/kuninet/git/顔写真登録アプリ/backend/src/admin/app.test.js)
- [frontend/src/api/apiClient.ts](/Users/kuninet/git/顔写真登録アプリ/frontend/src/api/apiClient.ts)
- [frontend/src/pages/admin/AdminApp.tsx](/Users/kuninet/git/顔写真登録アプリ/frontend/src/pages/admin/AdminApp.tsx)

## 3. 前提条件

- 管理API 認証は導入済みである。
- `bulkDelete` は削除要求で `id` のみを受け取り、サーバ側で DynamoDB から `photo_url` を再解決する。
- 存在しない `id` が含まれる場合は削除を行わず、エラーを返す。

## 4. テスト観点

1. 一覧取得 API が既存どおり期限切れレコードを返さないこと。
2. `bulkDelete` がリクエスト中の `photo_url` を無視し、DynamoDB から解決した `photo_url` だけで S3 削除すること。
3. `bulkDelete` が DynamoDB に存在しない `id` を含む要求を 400 で拒否すること。
4. 管理画面フロントが一括削除・単体削除ともに `id` のみを送ること。
5. frontend build が通り、型定義変更が崩れていないこと。

## 5. 実行コマンド

```bash
cd backend && npm test
cd ../frontend && npm run build
```

## 6. 期待結果

- backend テストが成功する。
- frontend build が成功する。
- `bulkDelete` の S3 削除キーは DynamoDB から解決した値になる。
- 存在しない `id` を含む要求では S3 削除が実行されない。

## 7. 今回の結果保存先

- [tmp/test-results/20260314-issue36-safe-bulk-delete](/Users/kuninet/git/顔写真登録アプリ/tmp/test-results/20260314-issue36-safe-bulk-delete)
