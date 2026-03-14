# テスト仕様書: Issue #50 デプロイ認証情報のローカル管理

## 1. 目的

バックエンドデプロイ時の `ADMIN_AUTH_CREDENTIALS` を、手動 `export` ではなく git 管理外のローカル設定ファイル `.env.deploy` で安全に扱えることを確認する。

## 2. 対象

- [.gitignore](/Users/kuninet/git/顔写真登録アプリ/.gitignore)
- [.env.deploy.example](/Users/kuninet/git/顔写真登録アプリ/.env.deploy.example)
- [scripts/deploy-backend.sh](/Users/kuninet/git/顔写真登録アプリ/scripts/deploy-backend.sh)
- [README.md](/Users/kuninet/git/顔写真登録アプリ/README.md)
- [docs/デプロイ手順書.md](/Users/kuninet/git/顔写真登録アプリ/docs/デプロイ手順書.md)

## 3. 前提条件

- `.env.deploy` はローカル専用で、git 管理対象外とする。
- `scripts/deploy-backend.sh` は `.env.deploy` が存在する場合にそれを読み込む。
- `ADMIN_AUTH_CREDENTIALS` 未設定時はデプロイ前に明示的に失敗する。

## 4. テスト観点

1. `.env.deploy` が `.gitignore` に追加されていること。
2. `.env.deploy.example` から必要な設定項目が分かること。
3. `scripts/deploy-backend.sh` が `.env.deploy` を読めること。
4. `.env.deploy` も環境変数も未設定なら、案内メッセージを出して終了すること。
5. README とデプロイ手順書の手順が実装と一致していること。

## 5. 実行コマンド

```bash
# シェル構文確認
bash -n scripts/deploy-backend.sh

# 設定ファイル未作成時の案内確認
./scripts/deploy-backend.sh
```

## 6. 期待結果

- `bash -n` が成功する。
- `.env.deploy` 未作成時に、`.env.deploy.example` をコピーする案内が表示される。
- ドキュメントに `cp .env.deploy.example .env.deploy` の手順が記載されている。

## 7. 今回の結果保存先

- [tmp/test-results/20260314-111200](/Users/kuninet/git/顔写真登録アプリ/tmp/test-results/20260314-111200)
