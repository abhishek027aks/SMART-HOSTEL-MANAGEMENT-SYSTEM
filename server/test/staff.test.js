const assert = require("node:assert/strict");
const test = require("node:test");

const mongoose = require("mongoose");
const User = require("../src/models/User");
const HostelMembership = require("../src/models/HostelMembership");
const StaffAudit = require("../src/models/StaffAudit");
const ROLES = require("../src/constants/roles");
const service = require("../src/services/staffService");
const { verifyPassword } = require("../src/utils/password");

const tenantId = "64b64c1a1e2c3d4e5f607182";

test("staff validation allows only Warden and Guard accounts and supported profile fields", () => {
    assert.throws(() => service.validate({
        name: "System admin",
        email: "admin@example.com",
        role: ROLES.SYSTEM_ADMIN,
        password: "a-secure-password"
    }), { statusCode: 400 });
    assert.throws(() => service.validate({
        name: "Warden",
        email: "warden@example.com",
        role: ROLES.WARDEN,
        password: "short"
    }), { statusCode: 400 });
    assert.throws(() => service.validate({
        name: "Guard",
        email: "guard@example.com",
        role: ROLES.GUARD,
        password: "a-secure-password",
        hostelId: "attacker-controlled"
    }), { statusCode: 400 });
    assert.deepEqual(service.validate({
        name: "  Warden One ",
        email: "Warden@example.com",
        role: ROLES.WARDEN,
        password: "a-secure-password"
    }), {
        name: "Warden One",
        email: "Warden@example.com",
        role: ROLES.WARDEN,
        password: "a-secure-password"
    });
});

test("staff list filters and paginates in MongoDB within verified tenant", async () => {
    const originalAggregate = HostelMembership.aggregate;
    let pipeline;
    try {
        HostelMembership.aggregate = (input) => {
            pipeline = input;
            return { allowDiskUse: async () => [{
                items: [{ _id: "64b64c1a1e2c3d4e5f607183", membershipId: "64b64c1a1e2c3d4e5f607184", role: "WARDEN", status: "ACTIVE" }],
                metadata: [{ total: 1 }]
            }] };
        };
        const result = await service.list({
            tenant: { hostelId: tenantId },
            query: { q: ".*", role: "WARDEN", status: "ACTIVE", page: "2", limit: "10" }
        });
        assert.equal(pipeline[0].$match.hostelId, tenantId);
        assert.deepEqual(pipeline[0].$match.role, { $in: ["WARDEN"] });
        assert.equal(pipeline[0].$match.status, "ACTIVE");
        const searchFilters = pipeline[3].$match.$or;
        assert.equal(searchFilters.length, 3);
        assert.deepEqual(searchFilters.map((filter) => Object.keys(filter)[0]), ["user.name", "user.email", "user.mobile"]);
        assert.equal(searchFilters[0]["user.name"].$regex, "\\.\\*");
        assert.deepEqual(result.pagination, { page: 2, limit: 10, total: 1, pages: 1 });
        assert.equal(result.items[0]._id, "64b64c1a1e2c3d4e5f607183");
    } finally {
        HostelMembership.aggregate = originalAggregate;
    }
});

test("staff list rejects invalid role and pagination filters", async () => {
    const req = { tenant: { hostelId: tenantId }, query: { role: "OWNER" } };
    await assert.rejects(service.list(req), { statusCode: 400 });
    await assert.rejects(service.list({ tenant: { hostelId: tenantId }, query: { limit: "101" } }), { statusCode: 400 });
});

test("staff creation scopes tenant, hashes password, and writes a secret-free audit event", async () => {
    const originals = {
        startSession: mongoose.startSession,
        userFindOne: User.findOne,
        userSave: User.prototype.save,
        membershipSave: HostelMembership.prototype.save,
        auditSave: StaffAudit.prototype.save
    };
    let savedUser;
    let auditRecord;
    try {
        mongoose.startSession = async () => ({
            withTransaction: async (operation) => operation(),
            endSession: async () => {}
        });
        User.findOne = () => ({ session: async () => null });
        User.prototype.save = async function save() { savedUser = this; };
        HostelMembership.prototype.save = async function save() {};
        StaffAudit.prototype.save = async function save() { auditRecord = this; };

        const result = await service.create({
            tenant: { hostelId: tenantId },
            auth: { id: "64b64c1a1e2c3d4e5f607183", role: ROLES.OWNER },
            body: {
                name: "Test Warden",
                email: "Test.Warden@example.com",
                mobile: "12345678",
                role: ROLES.WARDEN,
                password: "warden-test-password"
            }
        });

        assert.equal(String(savedUser.hostelId), tenantId);
        assert.equal(savedUser.email, "test.warden@example.com");
        assert.notEqual(savedUser.passwordHash, "warden-test-password");
        assert.equal(await verifyPassword("warden-test-password", savedUser.passwordHash), true);
        assert.equal(result.email, "test.warden@example.com");
        assert.equal(Object.hasOwn(result, "passwordHash"), false);
        assert.equal(auditRecord.action, "STAFF_CREATED");
        assert.deepEqual(auditRecord.changes, { role: ROLES.WARDEN, status: "ACTIVE" });
        assert.equal(JSON.stringify(auditRecord.changes).includes("password"), false);
    } finally {
        mongoose.startSession = originals.startSession;
        User.findOne = originals.userFindOne;
        User.prototype.save = originals.userSave;
        HostelMembership.prototype.save = originals.membershipSave;
        StaffAudit.prototype.save = originals.auditSave;
    }
});
