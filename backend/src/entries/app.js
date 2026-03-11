import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const s3Client = new S3Client({});
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
};

/**
 * 署名付きアップロードURL（POST Policy付き）を発行するAPI
 * @param {Object} event HTTP Gateway Event
 */
export const initializeUpload = async (event) => {
    try {
        const body = JSON.parse(event.body || "{}");
        const { photo_filename, photo_content_type } = body;

        // 【セキュリティレビュー反映】対応するMIMEタイプを制限
        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!photo_content_type || !allowedTypes.includes(photo_content_type)) {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: "Unsupported or missing Content-Type (Only JPEG, PNG, WEBP are allowed)." }),
            };
        }

        const bucketName = process.env.PHOTO_BUCKET_NAME;
        // ランダムなIDを生成（簡易的にタイムスタンプ+乱数）
        const entryId = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        // S3に保存するキーパス
        const extension = photo_content_type.split("/")[1];
        const photoKey = `photos/${new Date().toISOString().split('T')[0]}/${entryId}.${extension}`;

        // 【セキュリティレビュー反映】S3 POST Policyを利用してファイルサイズ制限 (Max: 10MB) と MIME 制約を付与
        const { url, fields } = await createPresignedPost(s3Client, {
            Bucket: bucketName,
            Key: photoKey,
            Conditions: [
                ["content-length-range", 0, 10 * 1024 * 1024], // Max 10MB
                ["eq", "$Content-Type", photo_content_type]
            ],
            Fields: {
                "Content-Type": photo_content_type
            },
            Expires: 300, // 有効期限 5分
        });

        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                upload_url: url, // フォームのPOST先URL
                fields: fields,  // フォームに含める追加パラメータ
                photo_key: photoKey,
                entry_id: entryId
            }),
        };

    } catch (error) {
        console.error("Error in initializeUpload", error);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: "Failed to generate presigned URL." }),
        };
    }
};

/**
 * データベースへのエントリー登録API
 * @param {Object} event HTTP Gateway Event
 */
export const registerEntry = async (event) => {
    try {
        const body = JSON.parse(event.body || "{}");
        // OpenAPIの必須項目チェック
        const requiredParams = ["company_name", "visitor_name", "purpose", "photo_key"];
        for (const param of requiredParams) {
            if (!body[param]) {
                return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: `Missing required parameter: ${param}` }) };
            }
        }

        const tableName = process.env.TABLE_NAME;
        const nowMs = Date.now();
        const nowIso = new Date(nowMs).toISOString();

        // 7日後（168時間後）のUNIXタイムスタンプ秒をTTLとして設定
        const TTL_SECONDS = Math.floor(nowMs / 1000) + (7 * 24 * 60 * 60);

        // SKはタイムスタンプの逆順等ではなくシンプルにタイムスタンプと乱数（一覧画面で降順/昇順ソートする用途）
        const sk = `${nowIso}#${Math.random().toString(36).substring(2, 8)}`;

        // DynamoDBへPut
        const item = {
            pk: "ENTRY",
            sk: sk,
            id: sk,
            created_at: nowIso,
            company_name: body.company_name,
            visitor_name: body.visitor_name,
            purpose: body.purpose,
            purpose_detail: body.purpose_detail || "",
            photo_url: body.photo_key, // フロントエンドでCloudFront等から配信する際に利用できるキー
            expires_at: TTL_SECONDS // AWSのTTLメカニズム用
        };

        await docClient.send(new PutCommand({
            TableName: tableName,
            Item: item
        }));

        return {
            statusCode: 201,
            headers: CORS_HEADERS,
            body: JSON.stringify(item),
        };

    } catch (error) {
        console.error("Error in registerEntry", error);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: "Failed to save entry." }),
        };
    }
};
