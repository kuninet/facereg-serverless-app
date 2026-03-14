import { S3Client, DeleteObjectsCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, BatchGetCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

        const bucketName = process.env.PHOTO_BUCKET_NAME;

        // 画像取得用のPresigned URLを生成
        const itemsWithPresignedUrl = await Promise.all(activeItems.map(async (item) => {
            if (item.photo_url) {
                try {
                    const command = new GetObjectCommand({
                        Bucket: bucketName,
                        Key: item.photo_url
                    });
                    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 * 60 }); // 1時間
                    item.photo_download_url = signedUrl;
                } catch (err) {
                    console.error("Failed to generate presigned URL for", item.photo_url, err);
                }
            }
            return item;
        }));

        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify(itemsWithPresignedUrl),
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
        const { items } = body;

        if (!Array.isArray(items) || items.length === 0) {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: "Invalid or empty keys for deletion." })
            };
        }

        const requestedIds = [...new Set(items.map(item => item?.id).filter(id => typeof id === "string" && id.length > 0))];

        if (requestedIds.length === 0) {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: "Invalid or empty ids for deletion." })
            };
        }

        if (requestedIds.length > 25) {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: "A maximum of 25 entries can be deleted at once." })
            };
        }

        const tableName = process.env.TABLE_NAME;
        const bucketName = process.env.PHOTO_BUCKET_NAME;

        const batchGetResponse = await docClient.send(new BatchGetCommand({
            RequestItems: {
                [tableName]: {
                    Keys: requestedIds.map(id => ({
                        pk: "ENTRY",
                        sk: id
                    }))
                }
            }
        }));

        const resolvedItems = batchGetResponse.Responses?.[tableName] || [];

        if (resolvedItems.length !== requestedIds.length) {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: "One or more entries were not found." })
            };
        }

        const deleteRequests = resolvedItems.map(item => ({
            DeleteRequest: {
                Key: {
                    pk: "ENTRY",
                    sk: item.id
                }
            }
        }));

        if (deleteRequests.length > 0) {
            await docClient.send(new BatchWriteCommand({
                RequestItems: {
                    [tableName]: deleteRequests
                }
            }));
        }

        const s3Objects = resolvedItems
            .filter(item => item.photo_url)
            .map(item => ({ Key: item.photo_url }));

        if (s3Objects.length > 0) {
            await s3Client.send(new DeleteObjectsCommand({
                Bucket: bucketName,
                Delete: {
                    Objects: s3Objects
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
