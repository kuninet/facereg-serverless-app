import { describe, it, expect, beforeEach } from 'vitest';
import { listEntries, bulkDelete } from './app.js';
import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient, QueryCommand, BatchGetCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const s3Mock = mockClient(S3Client);
const docMock = mockClient(DynamoDBDocumentClient);

describe('Admin API Tests', () => {
    beforeEach(() => {
        s3Mock.reset();
        docMock.reset();
        process.env.TABLE_NAME = 'MockTable';
        process.env.PHOTO_BUCKET_NAME = 'MockBucket';
        process.env.ALLOWED_CORS_ORIGIN = 'https://admin.example.com';
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
        expect(response.headers["Access-Control-Allow-Origin"]).toBe('https://admin.example.com');

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
        expect(response.headers["Access-Control-Allow-Origin"]).toBe('https://admin.example.com');
    });

    it('bulkDelete should resolve photo_url from DynamoDB and delete matched entries only', async () => {
        docMock.on(BatchGetCommand).resolves({
            Responses: {
                MockTable: [
                    { id: 'key1', pk: 'ENTRY', sk: 'key1', photo_url: 'photos/1.jpg' },
                    { id: 'key2', pk: 'ENTRY', sk: 'key2', photo_url: 'photos/2.jpg' }
                ]
            }
        });
        docMock.on(BatchWriteCommand).resolves({});
        s3Mock.on(DeleteObjectsCommand).resolves({});

        const event = {
            body: JSON.stringify({
                items: [
                    { id: 'key1', photo_url: 'photos/evil.jpg' },
                    { id: 'key2', photo_url: 'photos/also-evil.jpg' }
                ]
            })
        };
        const response = await bulkDelete(event);
        expect(response.statusCode).toBe(200);
        expect(response.headers["Access-Control-Allow-Origin"]).toBe('https://admin.example.com');

        expect(docMock.calls().length).toBe(2);
        expect(s3Mock.calls().length).toBe(1);

        const batchGetCall = docMock.call(0);
        expect(batchGetCall.args[0].input.RequestItems['MockTable'].Keys).toEqual([
            { pk: 'ENTRY', sk: 'key1' },
            { pk: 'ENTRY', sk: 'key2' }
        ]);

        const s3Call = s3Mock.call(0);
        expect(s3Call.args[0].input.Delete.Objects).toEqual([
            { Key: 'photos/1.jpg' },
            { Key: 'photos/2.jpg' }
        ]);

        const ddbCall = docMock.call(1);
        const reqItems = ddbCall.args[0].input.RequestItems['MockTable'];
        expect(reqItems.length).toBe(2);
        expect(reqItems[0].DeleteRequest.Key.sk).toBe('key1');
    });

    it('bulkDelete should return 400 when requested ids are not found', async () => {
        docMock.on(BatchGetCommand).resolves({
            Responses: {
                MockTable: [{ id: 'key1', pk: 'ENTRY', sk: 'key1', photo_url: 'photos/1.jpg' }]
            }
        });

        const event = {
            body: JSON.stringify({
                items: [{ id: 'key1' }, { id: 'missing-key' }]
            })
        };
        const response = await bulkDelete(event);
        expect(response.statusCode).toBe(400);
        expect(response.headers["Access-Control-Allow-Origin"]).toBe('https://admin.example.com');
        expect(JSON.parse(response.body).error).toContain('not found');
        expect(s3Mock.calls().length).toBe(0);
    });
});
