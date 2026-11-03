const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const test = require("node:test");

process.env.JWT_SECRET = process.env.JWT_SECRET || randomBytes(48).toString("hex");

const User = require("../src/models/User");
const Hostel = require("../src/models/Hostel");
const HostelMembership = require("../src/models/HostelMembership");
const ROLES = require("../src/constants/roles");
const config = require("../src/config");
const requireAuth = require("../src/middleware/authMiddleware");
const { signAccessToken } = require("../src/utils/token");

const createResponse = () => ({
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
});

const selectLean = (value) => ({ select: () => ({ lean: async () => value }) });

test("authentication attaches only active hostel memberships and rejects a token for another hostel", async () => {
    const userId = "64b64c1a1e2c3d4e5f607183";
    const hostelId = "64b64c1a1e2c3d4e5f607184";
    const user = {
        _id: userId,
        name: "Tenant Warden",
        email: "warden@example.invalid",
        mobile: "",
        role: ROLES.WARDEN,
        status: "ACTIVE",
        isDeleted: false
    };
    const originalUserFindById = User.findById;
    const originalMembershipFind = HostelMembership.find;
    const originalHostelFind = Hostel.find;

    try {
        User.findById = () => selectLean(user);
        HostelMembership.find = () => selectLean([{ hostelId }]);
        Hostel.find = () => selectLean([{ _id: hostelId }]);

        const token = signAccessToken({ id: userId, role: ROLES.WARDEN, hostelId }, config.jwtSecret);
        const req = { get: (name) => name.toLowerCase() === "authorization" ? `Bearer ${token}` : undefined };
        const response = createResponse();
        let nextCalled = false;
        await requireAuth(req, response, () => { nextCalled = true; });

        assert.equal(nextCalled, true);
        assert.equal(req.auth.hostelId, hostelId);
        assert.deepEqual(req.auth.memberships, [hostelId]);

        const otherHostelToken = signAccessToken({
            id: userId,
            role: ROLES.WARDEN,
            hostelId: "64b64c1a1e2c3d4e5f607185"
        }, config.jwtSecret);
        const otherRequest = { get: (name) => name.toLowerCase() === "authorization" ? `Bearer ${otherHostelToken}` : undefined };
        const deniedResponse = createResponse();
        await requireAuth(otherRequest, deniedResponse, () => {});
        assert.equal(deniedResponse.statusCode, 401);
    } finally {
        User.findById = originalUserFindById;
        HostelMembership.find = originalMembershipFind;
        Hostel.find = originalHostelFind;
    }
});
