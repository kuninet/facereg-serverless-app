import { describe, it, expect, beforeEach } from 'vitest';
import { listEntries, bulkDelete } from './app.js';
import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient, QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const s3Mock = mockClient(S3Client);
const docMock = mockClient(DynamoDBDocumentClient);

describe('Admin API Tests', () => {
    beforeEach(() => {
        s3Mock.reset();
        docMock.reset();
        process.env.TABLE_NAME = 'MockTable';
        process.env.PHOTO_BUCKET_NAME = 'MockBucket';
    });

    it('listEntries should return active items and filter out expired items', async () => {
        const nowSeconds = Math.floor(Date.now() / 1000);

        docMock.on(QueryCommand).resolves({
            Items: [
                { id: '1', expires_at: nowSeconds + 1000 }, // Active
                { id: '2', expires_at: nowSeconds - 1000 }, // Expired (should be filtered)
                { id: '3' } // Active (no expires_at field)
            ]
        });

        const event = {};
        const response = await listEntries(event);
        expect(response.statusCode).toBe(200);

        const items = JSON.parse(response.body);
        expect(items.length).toBe(2);
        expect(items.map(i => i.id)).toEqual(['1', '3']);
    });

    it('bulkDelete should return 400 if items array is missing or empty', async () => {
        const event = {
            body: JSON.stringify({ items: [] })
        };
        const response = await bulkDelete(event);
        expect(response.statusCode).toBe(400);
    });

    it('bulkDelete should trigger DynamoDB BatchWrite and S3 DeleteObjects', async () => {
        docMock.on(BatchWriteCommand).resolves({});
        s3Mock.on(DeleteObjectsCommand).resolves({});

        const event = {
            body: JSON.stringify({
                items: [
                    { id: 'key1', photo_url: 'photos/1.jpg' },
                    { id: 'key2', photo_url: 'photos/2.jpg' }
                ]
            })
        };
        const response = await bulkDelete(event);
        expect(response.statusCode).toBe(200);

        // APIコールの確認
        expect(docMock.calls().length).toBe(1);
        expect(s3Mock.calls().length).toBe(1);

        const s3Call = s3Mock.call(0);
        // DeleteObjectsCommand のパラメータ検証
        expect(s3Call.args[0].input.Delete.Objects).toEqual([
            { Key: 'photos/1.jpg' },
            { Key: 'photos/2.jpg' }
        ]);

        const ddbCall = docMock.call(0);
        // BatchWriteCommand のパラメータ検証
        const reqItems = ddbCall.args[0].input.RequestItems['MockTable'];
        expect(reqItems.length).toBe(2);
        expect(reqItems[0].DeleteRequest.Key.sk).toBe('key1');
    });
});
