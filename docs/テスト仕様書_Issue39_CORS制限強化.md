# テスト仕様書: Issue39 CORS 制限強化

## 対象

- [/Users/kuninet/git/顔写真登録アプリ/backend/src/admin/app.js](/Users/kuninet/git/顔写真登録アプリ/backend/src/admin/app.js)
- [/Users/kuninet/git/顔写真登録アプリ/backend/src/admin/app.test.js](/Users/kuninet/git/顔写真登録アプリ/backend/src/admin/app.test.js)
- [/Users/kuninet/git/顔写真登録アプリ/backend/src/entries/app.js](/Users/kuninet/git/顔写真登録アプリ/backend/src/entries/app.js)
- [/Users/kuninet/git/顔写真登録アプリ/backend/src/entries/app.test.js](/Users/kuninet/git/顔写真登録アプリ/backend/src/entries/app.test.js)
- [/Users/kuninet/git/顔写真登録アプリ/backend/template.yaml](/Users/kuninet/git/顔写真登録アプリ/backend/template.yaml)
- [/Users/kuninet/git/顔写真登録アプリ/scripts/deploy-backend.sh](/Users/kuninet/git/顔写真登録アプリ/scripts/deploy-backend.sh)
- [/Users/kuninet/git/顔写真登録アプリ/scripts/test-deploy-backend.sh](/Users/kuninet/git/顔写真登録アプリ/scripts/test-deploy-backend.sh)

## 確認観点

1. API レスポンスの `Access-Control-Allow-Origin` が `*` ではなく、`ALLOWED_CORS_ORIGIN` に一致すること。
2. 正常系・異常系を問わず同じ CORS ヘッダが返ること。
3. デプロイスクリプトが `AllowedCorsOrigin` を `sam deploy` に渡すこと。
4. 写真バケットの `AllowedOrigins` が `AllowedCorsOrigin` Parameter を参照すること。

## 実行コマンド

```bash
cd backend && npm test
./scripts/test-deploy-backend.sh
cd backend && sam validate --template-file template.yaml
```

## 期待結果

- バックエンドのユニットテストが成功する。
- デプロイスクリプト回帰テストが成功する。
- SAM テンプレート検証が成功する。
