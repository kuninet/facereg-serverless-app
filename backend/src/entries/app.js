import crypto from "node:crypto";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const s3Client = new S3Client({});
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const getCorsHeaders = () => ({
    "Access-Control-Allow-Origin": process.env.ALLOWED_CORS_ORIGIN || "https://example.invalid",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
});

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const UPLOAD_TOKEN_TTL_SECONDS = 5 * 60;
const PHOTO_KEY_PATTERN = /^photos\/\d{4}-\d{2}-\d{2}\/([0-9a-f-]+)\.(jpeg|png|webp)$/i;

const getUploadTokenSecret = () => process.env.UPLOAD_TOKEN_SECRET || "";

const createUploadToken = ({ entryId, photoKey, expiresAt }) => {
    const secret = getUploadTokenSecret();

    if (!secret) {
        throw new Error("UPLOAD_TOKEN_SECRET is not configured.");
    }

    const signature = crypto
        .createHmac("sha256", secret)
        .update(`${entryId}:${photoKey}:${expiresAt}`)
        .digest("hex");

    return `${expiresAt}.${signature}`;
};

const isValidUploadToken = ({ entryId, photoKey, uploadToken }) => {
    const [expiresAtText, actualSignature] = String(uploadToken || "").split(".");
    const expiresAt = Number.parseInt(expiresAtText, 10);

    if (!expiresAtText || !actualSignature || !Number.isFinite(expiresAt)) {
        return false;
    }

    if (expiresAt < Math.floor(Date.now() / 1000)) {
        return false;
    }

    const expectedToken = createUploadToken({ entryId, photoKey, expiresAt });
    const [, expectedSignature] = expectedToken.split(".");

    if (!expectedSignature || expectedSignature.length !== actualSignature.length) {
        return false;
    }

    return crypto.timingSafeEqual(
        Buffer.from(actualSignature, "utf8"),
        Buffer.from(expectedSignature, "utf8")
    );
};

const extractEntryIdFromPhotoKey = (photoKey) => {
    const match = String(photoKey || "").match(PHOTO_KEY_PATTERN);
    return match ? match[1] : null;
};

/**
 * 署名付きアップロードURL（POST Policy付き）を発行するAPI
 * @param {Object} event HTTP Gateway Event
 */
export const initializeUpload = async (event) => {
    const corsHeaders = getCorsHeaders();

    try {
        const body = JSON.parse(event.body || "{}");
        const { photo_filename, photo_content_type } = body;

        if (!photo_content_type || !ALLOWED_TYPES.includes(photo_content_type)) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: "Unsupported or missing Content-Type (Only JPEG, PNG, WEBP are allowed)." }),
            };
        }

        const bucketName = process.env.PHOTO_BUCKET_NAME;
        const entryId = crypto.randomUUID();
        const extension = photo_content_type.split("/")[1];
        const photoKey = `photos/${new Date().toISOString().split('T')[0]}/${entryId}.${extension}`;
        const uploadTokenExpiresAt = Math.floor(Date.now() / 1000) + UPLOAD_TOKEN_TTL_SECONDS;
        const uploadToken = createUploadToken({
            entryId,
            photoKey,
            expiresAt: uploadTokenExpiresAt,
        });

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
            headers: corsHeaders,
            body: JSON.stringify({
                upload_url: url, // フォームのPOST先URL
                fields: fields,  // フォームに含める追加パラメータ
                photo_key: photoKey,
                entry_id: entryId,
                upload_token: uploadToken,
                upload_token_expires_at: uploadTokenExpiresAt,
            }),
        };

    } catch (error) {
        console.error("Error in initializeUpload", error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Failed to generate presigned URL." }),
        };
    }
};

/**
 * データベースへのエントリー登録API
 * @param {Object} event HTTP Gateway Event
 */
export const registerEntry = async (event) => {
    const corsHeaders = getCorsHeaders();

    try {
        const body = JSON.parse(event.body || "{}");
        const requiredParams = ["company_name", "visitor_name", "purpose", "photo_key", "entry_id", "upload_token"];
        for (const param of requiredParams) {
            if (!body[param]) {
                return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: `Missing required parameter: ${param}` }) };
            }
        }

        const tableName = process.env.TABLE_NAME;
        const bucketName = process.env.PHOTO_BUCKET_NAME;
        const extractedEntryId = extractEntryIdFromPhotoKey(body.photo_key);

        if (!extractedEntryId || extractedEntryId !== body.entry_id) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: "photo_key does not match entry_id." }),
            };
        }

        if (!isValidUploadToken({
            entryId: body.entry_id,
            photoKey: body.photo_key,
            uploadToken: body.upload_token,
        })) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: "Invalid or expired upload token." }),
            };
        }

        try {
            await s3Client.send(new HeadObjectCommand({
                Bucket: bucketName,
                Key: body.photo_key,
            }));
        } catch (error) {
            console.error("Uploaded photo was not found", body.photo_key, error);
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: "Uploaded photo was not found." }),
            };
        }

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
            photo_url: body.photo_key,
            expires_at: TTL_SECONDS // AWSのTTLメカニズム用
        };

        await docClient.send(new PutCommand({
            TableName: tableName,
            Item: item
        }));

        return {
            statusCode: 201,
            headers: corsHeaders,
            body: JSON.stringify(item),
        };

    } catch (error) {
        console.error("Error in registerEntry", error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Failed to save entry." }),
        };
    }
};
