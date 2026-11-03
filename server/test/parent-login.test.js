const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const test = require("node:test");

process.env.JWT_SECRET = process.env.JWT_SECRET || randomBytes(48).toString("hex");

const User = require("../src/models/User");
const Hostel = require("../src/models/Hostel");
const HostelMembership = require("../src/models/HostelMembership");
const ROLES = require("../src/constants/roles");
const { login } = require("../src/controllers/authController");
const { hashPassword } = require("../src/utils/password");
const { verifyAccessToken } = require("../src/utils/token");
const config = require("../src/config");

const hostelId = "64b64c1a1e2c3d4e5f607181";
const parentUserId = "64b64c1a1e2c3d4e5f607182";

function membershipQuery(records) {
    return {
        select() {
            return {
                lean: async () => records
            };
        }
    };
}

function hostelQuery(records) {
    return {
        select() {
            return {
                lean: async () => records
            };
        }
    };
}

async function invokeLogin(body) {
    const response = {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        }
    };

    let forwardedError;
    await login({ body }, response, (error) => {
        forwardedError = error;
    });

    if (forwardedError) throw forwardedError;
    return response;
}

async function withParentMocks({ password, memberships, operation }) {
    const originals = {
        userFind: User.find,
        membershipFind: HostelMembership.find,
        hostelFind: Hostel.find
    };

    const user = {
        _id: parentUserId,
        name: "Parent Test Account",
        email: "parent.test@example.invalid",
        mobile: "9876501200",
        photoUrl: "",
        role: ROLES.PARENT,
        hostelId,
        status: "ACTIVE",
        isDeleted: false,
        passwordHash: await hashPassword(password)
    };

    try {
        User.find = () => ({
            limit: async () => [user]
        });

        HostelMembership.find = () => membershipQuery(
            memberships.map((id) => ({ hostelId: id }))
        );

        Hostel.find = () => hostelQuery(
            memberships.map((id) => ({ _id: id }))
        );

        return await operation(user);
    } finally {
        User.find = originals.userFind;
        HostelMembership.find = originals.membershipFind;
        Hostel.find = originals.hostelFind;
    }
}

test("Parent can log in with email and password and receives a Parent-scoped token", async () => {
    await withParentMocks({
        password: "ParentSecurePass123!",
        memberships: [hostelId],
        operation: async (user) => {
            const response = await invokeLogin({
                identifier: user.email,
                password: "ParentSecurePass123!",
                role: ROLES.PARENT
            });

            assert.equal(response.statusCode, 200);
            assert.equal(response.body.status, "success");
            assert.equal(response.body.data.user.role, ROLES.PARENT);
            assert.equal(response.body.data.user.hostelId, hostelId);
            assert.equal(response.body.data.user.id, parentUserId);
            assert.equal(Object.hasOwn(response.body.data.user, "passwordHash"), false);

            const tokenPayload = verifyAccessToken(
                response.body.data.token,
                config.jwtSecret
            );

            assert.equal(tokenPayload.sub, parentUserId);
            assert.equal(tokenPayload.role, ROLES.PARENT);
            assert.equal(tokenPayload.hostelId, hostelId);
        }
    });
});

test("Parent can log in using the registered mobile number", async () => {
    await withParentMocks({
        password: "ParentSecurePass123!",
        memberships: [hostelId],
        operation: async () => {
            const response = await invokeLogin({
                identifier: "9876501200",
                password: "ParentSecurePass123!",
                role: ROLES.PARENT
            });

            assert.equal(response.statusCode, 200);
            assert.equal(response.body.data.user.role, ROLES.PARENT);
        }
    });
});

test("Parent login rejects an incorrect password", async () => {
    await withParentMocks({
        password: "ParentSecurePass123!",
        memberships: [hostelId],
        operation: async (user) => {
            const response = await invokeLogin({
                identifier: user.email,
                password: "WrongPassword123!",
                role: ROLES.PARENT
            });

            assert.equal(response.statusCode, 401);
            assert.equal(response.body.message, "Invalid credentials");
        }
    });
});

test("Parent login rejects an incorrect requested role", async () => {
    await withParentMocks({
        password: "ParentSecurePass123!",
        memberships: [hostelId],
        operation: async (user) => {
            const response = await invokeLogin({
                identifier: user.email,
                password: "ParentSecurePass123!",
                role: ROLES.WARDEN
            });

            assert.equal(response.statusCode, 401);
        }
    });
});

test("Parent login rejects accounts without an active hostel membership", async () => {
    await withParentMocks({
        password: "ParentSecurePass123!",
        memberships: [],
        operation: async (user) => {
            const response = await invokeLogin({
                identifier: user.email,
                password: "ParentSecurePass123!",
                role: ROLES.PARENT
            });

            assert.equal(response.statusCode, 401);
            assert.equal(response.body.message, "Invalid credentials");
        }
    });
});
