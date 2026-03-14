import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initializeUpload, registerEntry } from './app.js';
import { mockClient } from 'aws-sdk-client-mock';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
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
        process.env.UPLOAD_TOKEN_SECRET = 'test-upload-token-secret';
        process.env.ALLOWED_CORS_ORIGIN = 'https://app.example.com';
    });

    it('initializeUpload should return 400 if Content-Type is invalid', async () => {
        const event = {
            body: JSON.stringify({ photo_content_type: 'application/pdf' })
        };
        const response = await initializeUpload(event);
        expect(response.statusCode).toBe(400);
        expect(response.headers["Access-Control-Allow-Origin"]).toBe('https://app.example.com');
        expect(JSON.parse(response.body).error).toContain('Unsupported or missing Content-Type');
    });

    it('initializeUpload should return 200 and presigned URL for valid Content-Type', async () => {
        const event = {
            body: JSON.stringify({ photo_filename: 'test.jpg', photo_content_type: 'image/jpeg' })
        };
        const response = await initializeUpload(event);
        expect(response.statusCode).toBe(200);
        expect(response.headers["Access-Control-Allow-Origin"]).toBe('https://app.example.com');

        const body = JSON.parse(response.body);
        expect(body.upload_url).toBe('https://mock-presigned-url');
        expect(body.photo_key).toContain('jpeg');
        expect(body.entry_id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
        expect(body.upload_token).toMatch(/^\d+\.[0-9a-f]+$/);
    });

    it('registerEntry should return 400 if required params are missing', async () => {
        const event = {
            body: JSON.stringify({ visitor_name: 'John' }) // purpose, company_name, photo_key missing
        };
        const response = await registerEntry(event);
        expect(response.statusCode).toBe(400);
        expect(response.headers["Access-Control-Allow-Origin"]).toBe('https://app.example.com');
    });

    it('registerEntry should return 201 and save to DynamoDB for valid payload', async () => {
        s3Mock.on(HeadObjectCommand).resolves({});
        docMock.on(PutCommand).resolves({});

        const initResponse = await initializeUpload({
            body: JSON.stringify({ photo_filename: 'test.jpg', photo_content_type: 'image/jpeg' })
        });
        const initBody = JSON.parse(initResponse.body);

        const event = {
            body: JSON.stringify({
                company_name: 'Test Inc',
                visitor_name: 'Jane Doe',
                purpose: 'meeting',
                photo_key: initBody.photo_key,
                entry_id: initBody.entry_id,
                upload_token: initBody.upload_token
            })
        };
        const response = await registerEntry(event);
        expect(response.statusCode).toBe(201);
        expect(response.headers["Access-Control-Allow-Origin"]).toBe('https://app.example.com');

        const body = JSON.parse(response.body);
        expect(body.pk).toBe('ENTRY');
        expect(body.visitor_name).toBe('Jane Doe');

        // TTLの確認 (現在時刻から計算すると約 7 * 24 * 60 * 60 = 604800 秒後)
        const diff = body.expires_at - (Date.now() / 1000);
        expect(diff).toBeGreaterThan(600000); // 多少のラグを考慮して60万秒以上ならOK
    });

    it('registerEntry should return 400 for invalid upload token', async () => {
        const event = {
            body: JSON.stringify({
                company_name: 'Test Inc',
                visitor_name: 'Jane Doe',
                purpose: 'meeting',
                photo_key: 'photos/2026-03-14/123e4567-e89b-12d3-a456-426614174000.jpeg',
                entry_id: '123e4567-e89b-12d3-a456-426614174000',
                upload_token: '1.invalid'
            })
        };

        const response = await registerEntry(event);
        expect(response.statusCode).toBe(400);
        expect(response.headers["Access-Control-Allow-Origin"]).toBe('https://app.example.com');
        expect(JSON.parse(response.body).error).toContain('Invalid or expired upload token');
    });

    it('registerEntry should return 400 when photo does not exist in S3', async () => {
        s3Mock.on(HeadObjectCommand).rejects(new Error('NotFound'));

        const initResponse = await initializeUpload({
            body: JSON.stringify({ photo_filename: 'test.jpg', photo_content_type: 'image/jpeg' })
        });
        const initBody = JSON.parse(initResponse.body);

        const event = {
            body: JSON.stringify({
                company_name: 'Test Inc',
                visitor_name: 'Jane Doe',
                purpose: 'meeting',
                photo_key: initBody.photo_key,
                entry_id: initBody.entry_id,
                upload_token: initBody.upload_token
            })
        };

        const response = await registerEntry(event);
        expect(response.statusCode).toBe(400);
        expect(response.headers["Access-Control-Allow-Origin"]).toBe('https://app.example.com');
        expect(JSON.parse(response.body).error).toContain('Uploaded photo was not found');
    });
});
