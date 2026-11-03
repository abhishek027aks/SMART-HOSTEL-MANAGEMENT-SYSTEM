const assert = require("node:assert/strict");
const test = require("node:test");
const AuditLog = require("../src/models/AuditLog");
const audit = require("../src/services/auditService");

const tenantId = "64b64c1a1e2c3d4e5f607181";
const actorId = "64b64c1a1e2c3d4e5f607183";
const request = { tenant: { hostelId: tenantId }, auth: { id: actorId, role: "OWNER" }, query: {} };

test("audit writes retain verified tenant and actor context", async () => {
    const originalCreate = AuditLog.create;
    let payload;
    AuditLog.create = async (value) => { payload = value; return value; };
    try {
        await audit.write(request, { action: "CREATED", entityType: "ROOM", entityId: "64b64c1a1e2c3d4e5f607184", details: { roomNumber: "A-101" } });
        assert.equal(payload.hostelId, tenantId);
        assert.equal(payload.actorId, actorId);
        assert.equal(payload.actorRole, "OWNER");
    } finally { AuditLog.create = originalCreate; }
});

test("audit listing scopes by tenant and validates pagination", async () => {
    const originalFind = AuditLog.find;
    const originalCount = AuditLog.countDocuments;
    let filter;
    const query = { sort: () => query, skip: () => query, limit: () => query, populate: () => query, lean: async () => [] };
    AuditLog.find = (value) => { filter = value; return query; };
    AuditLog.countDocuments = async () => 0;
    try {
        const result = await audit.list({ ...request, query: { page: "1", limit: "20", entityType: "ROOM" } });
        assert.equal(String(filter.hostelId), tenantId);
        assert.equal(filter.entityType, "ROOM");
        assert.deepEqual(result.pagination, { page: 1, limit: 20, total: 0, pages: 0 });
        await assert.rejects(() => audit.list({ ...request, query: { page: "0" } }), { statusCode: 400 });
    } finally { AuditLog.find = originalFind; AuditLog.countDocuments = originalCount; }
});
