# テスト仕様書: Issue #35 photo_key 検証強化

## 1. 目的

`registerEntry` が `initializeUpload` と無関係な `photo_key` を受け入れず、正当なアップロード済み画像だけを登録できることを確認する。

## 2. 対象

- [backend/src/entries/app.js](/Users/kuninet/git/顔写真登録アプリ/backend/src/entries/app.js)
- [backend/src/entries/app.test.js](/Users/kuninet/git/顔写真登録アプリ/backend/src/entries/app.test.js)
- [backend/template.yaml](/Users/kuninet/git/顔写真登録アプリ/backend/template.yaml)
- [frontend/src/api/apiClient.ts](/Users/kuninet/git/顔写真登録アプリ/frontend/src/api/apiClient.ts)
- [frontend/src/pages/reception/ReceptionApp.tsx](/Users/kuninet/git/顔写真登録アプリ/frontend/src/pages/reception/ReceptionApp.tsx)
- [scripts/deploy-backend.sh](/Users/kuninet/git/顔写真登録アプリ/scripts/deploy-backend.sh)
- [.env.deploy.example](/Users/kuninet/git/顔写真登録アプリ/.env.deploy.example)

## 3. 前提条件

- 常設課金を増やさないため、新しい常設 AWS リソースは追加しない。
- `initializeUpload` は `entry_id` と `photo_key` に紐づく短命の `upload_token` を返す。
- `registerEntry` は `entry_id`、`photo_key`、`upload_token` を照合し、S3 上の実ファイル存在も確認する。

## 4. テスト観点

1. `initializeUpload` が有効な MIME タイプに対して `upload_token` を返すこと。
2. `registerEntry` が正しい `entry_id`、`photo_key`、`upload_token`、アップロード済み S3 オブジェクトで成功すること。
3. `registerEntry` が不正または期限切れの `upload_token` を拒否すること。
4. `registerEntry` が `photo_key` と `entry_id` の不一致を拒否すること。
5. `registerEntry` が S3 に存在しない画像を拒否すること。
6. フロントエンドが `upload_token` と `entry_id` を登録 API に引き渡すこと。
7. デプロイスクリプトが `UploadTokenSecret` を必須のデプロイ変数として扱うこと。

## 5. 実行コマンド

```bash
cd backend && npm test
cd ../frontend && npm run build
cd ..
bash -n scripts/deploy-backend.sh
bash scripts/test-deploy-backend.sh
sam validate --template-file backend/template.yaml
```

## 6. 期待結果

- backend テストが成功する。
- frontend ビルドが成功する。
- `deploy-backend.sh` の構文チェックが成功する。
- `scripts/test-deploy-backend.sh` が `UploadTokenSecret` を含む `sam deploy` パラメータで成功する。
- `sam validate` が成功する。

## 7. 今回の結果保存先

- [tmp/test-results/20260314-issue35-photo-key-validation](/Users/kuninet/git/顔写真登録アプリ/tmp/test-results/20260314-issue35-photo-key-validation)
