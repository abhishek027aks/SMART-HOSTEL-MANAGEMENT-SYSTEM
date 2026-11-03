const { createHmac, timingSafeEqual } = require("node:crypto");
const ROLES = require("../constants/roles");

const ISSUER = "smart-hostel-management-system";
const TOKEN_LIFETIME_SECONDS = 60 * 60;

class TokenValidationError extends Error {}

const assertSecret = (secret) => {
    if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32) {
        throw new Error("JWT_SECRET must be configured with at least 32 bytes.");
    }
};

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

const signatureFor = (content, secret) => createHmac("sha256", secret).update(content).digest();

const signAccessToken = (user, secret, now = Date.now()) => {
    assertSecret(secret);

    if (!user || typeof user.id !== "string" || !Object.values(ROLES).includes(user.role)) {
        throw new TypeError("A valid user ID and role are required to sign an access token.");
    }

    const issuedAt = Math.floor(now / 1000);
    const header = encode({ alg: "HS256", typ: "JWT" });
    const payload = encode({
        sub: user.id,
        role: user.role,
        hostelId: user.hostelId || null,
        iss: ISSUER,
        iat: issuedAt,
        exp: issuedAt + TOKEN_LIFETIME_SECONDS
    });
    const content = `${header}.${payload}`;

    return `${content}.${signatureFor(content, secret).toString("base64url")}`;
};

const verifyAccessToken = (token, secret, now = Date.now()) => {
    assertSecret(secret);

    if (typeof token !== "string" || token.length > 4096) {
        throw new TokenValidationError("Invalid access token.");
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
        throw new TokenValidationError("Invalid access token.");
    }

    let header;
    let payload;
    let receivedSignature;
    try {
        header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
        payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
        receivedSignature = Buffer.from(parts[2], "base64url");
    } catch {
        throw new TokenValidationError("Invalid access token.");
    }

    if (!header || typeof header !== "object" || !payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new TokenValidationError("Invalid access token.");
    }
    if (header.alg !== "HS256" || header.typ !== "JWT") {
        throw new TokenValidationError("Invalid access token.");
    }

    const content = `${parts[0]}.${parts[1]}`;
    const expectedSignature = signatureFor(content, secret);
    if (receivedSignature.length !== expectedSignature.length || !timingSafeEqual(receivedSignature, expectedSignature)) {
        throw new TokenValidationError("Invalid access token.");
    }

    const currentTime = Math.floor(now / 1000);
    if (
        payload.iss !== ISSUER ||
        typeof payload.sub !== "string" ||
        !Object.values(ROLES).includes(payload.role) ||
        !(payload.hostelId === null || typeof payload.hostelId === "string") ||
        !Number.isInteger(payload.iat) ||
        !Number.isInteger(payload.exp) ||
        payload.iat > currentTime ||
        payload.exp <= currentTime
    ) {
        throw new TokenValidationError("Invalid or expired access token.");
    }

    return payload;
};

module.exports = {
    TOKEN_LIFETIME_SECONDS,
    TokenValidationError,
    signAccessToken,
    verifyAccessToken
};
