import { beforeEach, describe, expect, it } from "vitest";
import { authorize } from "./app.js";

describe("Admin Authorizer", () => {
    beforeEach(() => {
        process.env.ADMIN_AUTH_CREDENTIALS = "admin:password,ops:secret";
    });

    it("正しいBasic認証情報ならAllowを返す", async () => {
        const token = Buffer.from("admin:password", "utf8").toString("base64");

        const response = await authorize({
            authorizationToken: `Basic ${token}`,
            methodArn: "arn:aws:execute-api:ap-northeast-1:123456789012:api/v1/GET/admin/entries",
        });

        expect(response.principalId).toBe("admin");
        expect(response.policyDocument.Statement[0].Effect).toBe("Allow");
    });

    it("誤った認証情報ならUnauthorizedを返す", async () => {
        const token = Buffer.from("admin:wrong", "utf8").toString("base64");

        await expect(
            authorize({
                authorizationToken: `Basic ${token}`,
                methodArn: "arn:aws:execute-api:ap-northeast-1:123456789012:api/v1/GET/admin/entries",
            })
        ).rejects.toBe("Unauthorized");
    });

    it("Authorizationヘッダがない場合はUnauthorizedを返す", async () => {
        await expect(
            authorize({
                methodArn: "arn:aws:execute-api:ap-northeast-1:123456789012:api/v1/GET/admin/entries",
            })
        ).rejects.toBe("Unauthorized");
    });
});
