import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initializeUpload, registerEntry } from './app.js';
import { mockClient } from 'aws-sdk-client-mock';
import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const s3Mock = mockClient(S3Client);
const docMock = mockClient(DynamoDBDocumentClient);

// createPresignedPostのモック
vi.mock('@aws-sdk/s3-presigned-post', () => {
    return {
        createPresignedPost: vi.fn().mockResolvedValue({
            url: 'https://mock-presigned-url',
            fields: { 'Content-Type': 'image/jpeg' }
        })
    };
});

describe('Entries API Tests', () => {
    beforeEach(() => {
        s3Mock.reset();
        docMock.reset();
        process.env.TABLE_NAME = 'MockTable';
        process.env.PHOTO_BUCKET_NAME = 'MockBucket';
    });

    it('initializeUpload should return 400 if Content-Type is invalid', async () => {
        const event = {
            body: JSON.stringify({ photo_content_type: 'application/pdf' })
        };
        const response = await initializeUpload(event);
        expect(response.statusCode).toBe(400);
        expect(JSON.parse(response.body).error).toContain('Unsupported or missing Content-Type');
    });

    it('initializeUpload should return 200 and presigned URL for valid Content-Type', async () => {
        const event = {
            body: JSON.stringify({ photo_filename: 'test.jpg', photo_content_type: 'image/jpeg' })
        };
        const response = await initializeUpload(event);
        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.body);
        expect(body.upload_url).toBe('https://mock-presigned-url');
        expect(body.photo_key).toContain('jpeg');
    });

    it('registerEntry should return 400 if required params are missing', async () => {
        const event = {
            body: JSON.stringify({ visitor_name: 'John' }) // purpose, company_name, photo_key missing
        };
        const response = await registerEntry(event);
        expect(response.statusCode).toBe(400);
    });

    it('registerEntry should return 201 and save to DynamoDB for valid payload', async () => {
        docMock.on(PutCommand).resolves({});

        const event = {
            body: JSON.stringify({
                company_name: 'Test Inc',
                visitor_name: 'Jane Doe',
                purpose: 'meeting',
                photo_key: 'photos/xyz.jpeg'
            })
        };
        const response = await registerEntry(event);
        expect(response.statusCode).toBe(201);

        const body = JSON.parse(response.body);
        expect(body.pk).toBe('ENTRY');
        expect(body.visitor_name).toBe('Jane Doe');

        // TTLの確認 (現在時刻から計算すると約 7 * 24 * 60 * 60 = 604800 秒後)
        const diff = body.expires_at - (Date.now() / 1000);
        expect(diff).toBeGreaterThan(600000); // 多少のラグを考慮して60万秒以上ならOK
    });
});
