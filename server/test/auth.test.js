const assert = require("node:assert/strict");
const test = require("node:test");
const ROLES = require("../src/constants/roles");
const { hashPassword, verifyPassword } = require("../src/utils/password");
const {
    TOKEN_LIFETIME_SECONDS,
    TokenValidationError,
    signAccessToken,
    verifyAccessToken
} = require("../src/utils/token");
const requireRoles = require("../src/middleware/roleMiddleware");

const secret = "unit-test-signing-secret-with-more-than-32-bytes";

test("password hashes use salted scrypt and verify without storing plaintext", async () => {
    const hash = await hashPassword("Correct horse battery staple");

    assert.match(hash, /^scrypt\$16384\$8\$1\$/);
    assert.notEqual(hash, "Correct horse battery staple");
    assert.equal(await verifyPassword("Correct horse battery staple", hash), true);
    assert.equal(await verifyPassword("incorrect", hash), false);
    assert.equal(await verifyPassword("anything", "not-a-valid-hash"), false);
});

test("password hashing rejects empty and excessively long inputs", async () => {
    await assert.rejects(hashPassword(""), TypeError);
    await assert.rejects(hashPassword("x".repeat(1025)), TypeError);
});

test("access tokens are signed, role-bearing, and expire after one hour", () => {
    const now = Date.UTC(2026, 9, 6, 5, 0, 0);
    const token = signAccessToken({ id: "user-1", role: ROLES.OWNER, hostelId: "hostel-1" }, secret, now);
    const payload = verifyAccessToken(token, secret, now);

    assert.equal(payload.sub, "user-1");
    assert.equal(payload.role, ROLES.OWNER);
    assert.equal(payload.hostelId, "hostel-1");
    assert.equal(payload.exp - payload.iat, TOKEN_LIFETIME_SECONDS);
    assert.throws(() => verifyAccessToken(token, secret, now + TOKEN_LIFETIME_SECONDS * 1000), TokenValidationError);
});

test("access token verification rejects modified signatures and weak secrets", () => {
    const token = signAccessToken({ id: "user-2", role: ROLES.SYSTEM_ADMIN }, secret);
    const [header, payload, signature] = token.split(".");
    const signatureBytes = Buffer.from(signature, "base64url");
    signatureBytes[0] ^= 1;
    const modified = `${header}.${payload}.${signatureBytes.toString("base64url")}`;

    assert.throws(() => verifyAccessToken(modified, secret), TokenValidationError);
    assert.throws(() => signAccessToken({ id: "user-2", role: ROLES.SYSTEM_ADMIN }, "short"), /at least 32 bytes/);
});

test("role middleware distinguishes authentication from authorization", () => {
    const middleware = requireRoles(ROLES.SYSTEM_ADMIN);
    const dashboardMiddleware = requireRoles(ROLES.SYSTEM_ADMIN, ROLES.OWNER, ROLES.WARDEN);
    const createResponse = () => ({
        statusCode: null,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    });
    const next = () => "next";

    const anonymousResponse = createResponse();
    middleware({ auth: null }, anonymousResponse, next);
    assert.equal(anonymousResponse.statusCode, 401);

    const forbiddenResponse = createResponse();
    middleware({ auth: { role: ROLES.STUDENT } }, forbiddenResponse, next);
    assert.equal(forbiddenResponse.statusCode, 403);

    assert.equal(middleware({ auth: { role: ROLES.SYSTEM_ADMIN } }, createResponse(), next), "next");
    assert.equal(dashboardMiddleware({ auth: { role: ROLES.OWNER } }, createResponse(), next), "next");
    assert.equal(dashboardMiddleware({ auth: { role: ROLES.WARDEN } }, createResponse(), next), "next");

    const guardResponse = createResponse();
    dashboardMiddleware({ auth: { role: ROLES.GUARD } }, guardResponse, next);
    assert.equal(guardResponse.statusCode, 403);
});
