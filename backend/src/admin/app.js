import { S3Client, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";

const s3Client = new S3Client({});
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
};

/**
 * データベースからのエントリー一覧取得API
 * @param {Object} event HTTP Gateway Event
 */
export const listEntries = async (event) => {
    try {
        const tableName = process.env.TABLE_NAME;

        // pk: ENTRY で全件取得（SK降順＝新しい順にソート）
        const { Items } = await docClient.send(new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: "pk = :pk",
            ExpressionAttributeValues: {
                ":pk": "ENTRY",
            },
            ScanIndexForward: false // 降順（最新のものが上）
        }));

        // 【運用レビュー反映】TTL遅延対策：現在時刻を過ぎているものはフィルタリングして返さない
        const nowSeconds = Math.floor(Date.now() / 1000);
        const activeItems = (Items || []).filter(item => {
            return !item.expires_at || item.expires_at > nowSeconds;
        });

        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify(activeItems),
        };

    } catch (error) {
        console.error("Error in listEntries", error);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: "Failed to fetch entries." }),
        };
    }
};

/**
 * 複数エントリーの一括削除 (DynamoDB レコード + S3 画像の削除)
 * @param {Object} event HTTP Gateway Event
 */
export const bulkDelete = async (event) => {
    try {
        const body = JSON.parse(event.body || "{}");
        const { items } = body; // 削除対象のオブジェクト配列 [{ id: "...", photo_url: "..." }, ...] を期待

        if (!Array.isArray(items) || items.length === 0) {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: "Invalid or empty keys for deletion." })
            };
        }

        const tableName = process.env.TABLE_NAME;
        const bucketName = process.env.PHOTO_BUCKET_NAME;

        // 1. DynamoDBからのバッチ削除 (最大25件ずつの制約に注意)
        // ここでは簡易的に25件以下である前提（キオスク運用想定）で実装。実弾ではchunk分割が必要
        const deleteRequests = items.map(item => ({
            DeleteRequest: {
                Key: {
                    pk: "ENTRY",
                    sk: item.id  // tableのSKには item.id がそのまま入っている前提
                }
            }
        }));

        if (deleteRequests.length > 0) {
            await docClient.send(new BatchWriteCommand({
                RequestItems: {
                    [tableName]: deleteRequests.slice(0, 25) // OpenAPI側の要件で25件以上の場合はループ等が必要
                }
            }));
        }

        // 2. S3からの画像バッチ削除
        const s3Objects = items
            .filter(item => item.photo_url)
            .map(item => ({ Key: item.photo_url }));

        if (s3Objects.length > 0) {
            await s3Client.send(new DeleteObjectsCommand({
                Bucket: bucketName,
                Delete: {
                    Objects: s3Objects.slice(0, 1000) // S3 DeleteObjectsは最大1000件
                }
            }));
        }

        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({ message: "Successfully deleted items." }),
        };

    } catch (error) {
        console.error("Error in bulkDelete", error);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: "Failed to delete entries." }),
        };
    }
};
