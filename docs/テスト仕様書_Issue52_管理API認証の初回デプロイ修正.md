# テスト仕様書: Issue #52 管理API認証の初回デプロイ修正

## 1. 目的

管理API認証を導入済みのテンプレートでも、`./scripts/deploy-backend.sh` 1 回で既存スタックへ安全に反映できることを確認する。

## 2. 対象

- [.env.deploy.example](/Users/kuninet/git/顔写真登録アプリ/.env.deploy.example)
- [backend/template.yaml](/Users/kuninet/git/顔写真登録アプリ/backend/template.yaml)
- [scripts/deploy-backend.sh](/Users/kuninet/git/顔写真登録アプリ/scripts/deploy-backend.sh)
- [scripts/test-deploy-backend.sh](/Users/kuninet/git/顔写真登録アプリ/scripts/test-deploy-backend.sh)
- [docs/デプロイ手順書.md](/Users/kuninet/git/顔写真登録アプリ/docs/デプロイ手順書.md)

## 3. 前提条件

- `AdminAuthorizerFunction` 未作成のスタックでは、Authorizer 本体作成と API 紐付けを同一 change set に入れると失敗する。
- 既存 Lambda の CloudWatch Logs が CloudFormation 管理外で存在すると、LogGroup リソース追加時に競合する。
- 初回だけ Authorizer 参照を外した一時テンプレートで Authorizer 関連リソースを先に作成し、その後に通常テンプレートをデプロイする。

## 4. テスト観点

1. `backend/template.yaml` は通常状態のまま維持し、管理APIが Authorizer を必須化していること。
2. `scripts/deploy-backend.sh` が `AdminAuthorizerFunction` の有無を見て、初回のみ一時テンプレート + 通常テンプレートの 2 段階デプロイを行うこと。
3. 既存の未管理ロググループがある場合、通常デプロイ前に削除して CloudFormation 管理へ移行できること。
4. 2 回目以降は不要な 1 段階目やロググループ削除を実行しないこと。
5. 手順書に初回の自動 2 段階デプロイが明記されていること。
6. `.env.deploy` 未作成時に、コピー元として `.env.deploy.example` の案内が出ること。
7. `ADMIN_AUTH_CREDENTIALS` を明示的に環境変数で渡した場合、`.env.deploy` より優先されること。

## 5. 実行コマンド

```bash
# テンプレート妥当性確認
sam validate --template-file backend/template.yaml

# .env.deploy 未作成時の案内確認
./scripts/deploy-backend.sh

# デプロイスクリプトの分岐テスト
bash scripts/test-deploy-backend.sh
```

## 6. 期待結果

- `sam validate` が成功する。
- `.env.deploy` 未作成時に `.env.deploy.example` をコピーする案内が出る。
- `ADMIN_AUTH_CREDENTIALS` を環境変数で与えたテストでは、その値で `sam deploy` が実行される。
- `scripts/test-deploy-backend.sh` が成功する。
- 初回ケースでは既存ロググループ削除 4 回、一時テンプレート用と通常テンプレート用の 2 回の `sam deploy` が記録される。
- 2 回目以降のケースでは通常テンプレート用の 1 回だけが記録される。

## 7. 今回の結果保存先

- [tmp/test-results/20260314-issue52-admin-auth-deploy-fix](/Users/kuninet/git/顔写真登録アプリ/tmp/test-results/20260314-issue52-admin-auth-deploy-fix)
