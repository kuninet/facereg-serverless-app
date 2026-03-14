import { timingSafeEqual } from "node:crypto";

const unauthorized = () => {
    throw "Unauthorized";
};

const safeEquals = (left, right) => {
    const leftBuffer = Buffer.from(left, "utf8");
    const rightBuffer = Buffer.from(right, "utf8");

    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
};

const parseBasicAuthHeader = (authorizationHeader) => {
    if (!authorizationHeader || !authorizationHeader.startsWith("Basic ")) {
        return null;
    }

    try {
        const decoded = Buffer.from(authorizationHeader.slice(6), "base64").toString("utf8");
        const separatorIndex = decoded.indexOf(":");
        if (separatorIndex < 0) {
            return null;
        }

        return {
            username: decoded.slice(0, separatorIndex),
            password: decoded.slice(separatorIndex + 1),
        };
    } catch {
        return null;
    }
};

const generatePolicy = (principalId, effect, resource) => ({
    principalId,
    policyDocument: {
        Version: "2012-10-17",
        Statement: [
            {
                Action: "execute-api:Invoke",
                Effect: effect,
                Resource: resource,
            },
        ],
    },
});

export const authorize = async (event) => {
    const configuredCredentials = (process.env.ADMIN_AUTH_CREDENTIALS || "")
        .split(",")
        .map((credential) => credential.trim())
        .filter(Boolean);

    if (configuredCredentials.length === 0) {
        console.error("ADMIN_AUTH_CREDENTIALS is not configured.");
        unauthorized();
    }

    const credentials = parseBasicAuthHeader(event.authorizationToken);
    if (!credentials) {
        unauthorized();
    }

    const providedCredential = `${credentials.username}:${credentials.password}`;
    const matchedCredential = configuredCredentials.find((credential) =>
        safeEquals(credential, providedCredential)
    );

    if (!matchedCredential) {
        unauthorized();
    }

    return generatePolicy(credentials.username, "Allow", event.methodArn);
};
