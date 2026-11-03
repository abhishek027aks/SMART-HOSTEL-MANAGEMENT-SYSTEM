const assert = require("node:assert/strict");
const test = require("node:test");
const Camera = require("../src/models/Camera");
const SecurityEvent = require("../src/models/SecurityEvent");
const auditService = require("../src/services/auditService");
const security = require("../src/services/securityService");

const tenantId = "64b64c1a1e2c3d4e5f607181";
const otherTenantId = "64b64c1a1e2c3d4e5f607182";
const actorId = "64b64c1a1e2c3d4e5f607183";
const cameraId = "64b64c1a1e2c3d4e5f607184";
const eventId = "64b64c1a1e2c3d4e5f607185";
const request = (body = {}) => ({ tenant: { hostelId: tenantId }, auth: { id: actorId, role: "OWNER" }, body, params: {} });

test("security camera creation validates stream URLs and uses the verified tenant", async () => {
    const originalCreate = Camera.create;
    const originalAuditWrite = auditService.write;
    let created;
    let auditEntry;
    Camera.create = async (payload) => { created = payload; return payload; };
    auditService.write = async (_req, entry) => { auditEntry = entry; };
    try {
        await security.createCamera(request({ name: "Main Gate", location: "Entrance", streamUrl: "https://camera.example/live", type: "IP" }));
        assert.equal(created.hostelId, tenantId);
        assert.equal(created.createdBy, actorId);
        assert.equal(created.status, "ACTIVE");
        assert.equal(auditEntry.action, "CAMERA_CREATED");
        await assert.rejects(() => security.createCamera(request({ name: "Bad", location: "Gate", streamUrl: "rtsp://private" })), { statusCode: 400 });
    } finally { Camera.create = originalCreate; auditService.write = originalAuditWrite; }
});

test("security events reject foreign cameras and persist only a verified-hostel camera", async () => {
    const originalExists = Camera.exists;
    const originalCreate = SecurityEvent.create;
    const originalAuditWrite = auditService.write;
    let event;
    let auditEntry;
    Camera.exists = async (filter) => String(filter.hostelId) === tenantId && String(filter._id) === cameraId;
    SecurityEvent.create = async (payload) => { event = payload; return payload; };
    auditService.write = async (_req, entry) => { auditEntry = entry; };
    try {
        await assert.rejects(() => security.createEvent(request({ title: "Gate alert", cameraId: otherTenantId })), { statusCode: 404 });
        await security.createEvent(request({ title: "Gate alert", severity: "HIGH", cameraId }));
        assert.equal(event.hostelId, tenantId);
        assert.equal(event.cameraId, cameraId);
        assert.equal(event.createdBy, actorId);
        assert.equal(auditEntry.action, "SECURITY_EVENT_CREATED");
    } finally { Camera.exists = originalExists; SecurityEvent.create = originalCreate; auditService.write = originalAuditWrite; }
});

test("security event resolution is tenant-scoped", async () => {
    const originalFindOne = SecurityEvent.findOne;
    const originalAuditWrite = auditService.write;
    let filter;
    let auditEntry;
    const record = { status: "OPEN", save: async () => record };
    SecurityEvent.findOne = async (value) => { filter = value; return record; };
    auditService.write = async (_req, entry) => { auditEntry = entry; };
    try {
        const req = request(); req.params.id = eventId;
        const resolved = await security.resolveEvent(req);
        assert.equal(filter.hostelId, tenantId);
        assert.equal(resolved.status, "RESOLVED");
        assert.equal(auditEntry.action, "SECURITY_EVENT_RESOLVED");
    } finally { SecurityEvent.findOne = originalFindOne; auditService.write = originalAuditWrite; }
});
