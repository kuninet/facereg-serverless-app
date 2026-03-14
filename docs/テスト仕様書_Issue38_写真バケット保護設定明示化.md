# テスト仕様書: Issue #38 写真バケット保護設定明示化

## 1. 目的

`PhotosBucket` に対して、公開防止・暗号化・TLS 強制の保護設定が SAM テンプレートで明示されていることを確認する。

## 2. 対象

- [backend/template.yaml](/Users/kuninet/git/顔写真登録アプリ/backend/template.yaml)

## 3. 前提条件

- 継続課金を増やさないため、暗号化は追加料金のない SSE-S3 を採用する。
- 写真バケットは公開配信を前提としない。

## 4. テスト観点

1. `PhotosBucket` に `PublicAccessBlockConfiguration` があること。
2. `PhotosBucket` に `BucketEncryption` があり、`AES256` が設定されていること。
3. `PhotosBucketPolicy` で `aws:SecureTransport: false` を拒否していること。
4. テンプレート全体が `sam validate` を通ること。

## 5. 実行コマンド

```bash
sam validate --template-file backend/template.yaml
```

## 6. 期待結果

- `sam validate` が成功する。
- `PhotosBucket` の保護設定がテンプレート上で読み取れる。

## 7. 今回の結果保存先

- [tmp/test-results/20260314-issue38-photos-bucket-hardening](/Users/kuninet/git/顔写真登録アプリ/tmp/test-results/20260314-issue38-photos-bucket-hardening)
