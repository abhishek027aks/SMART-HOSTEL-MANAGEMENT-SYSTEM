const assert = require("node:assert/strict");
const test = require("node:test");

const ROLES = require("../src/constants/roles");
const hostelScope = require("../src/utils/hostelScope");
const { requireTenant, tenantMiddleware } = require("../src/middleware/tenantMiddleware");

const createResponse = () => ({
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
});

const makeRequest = (auth, hostelHeader = undefined) => ({
    auth,
    get(name) { return name.toLowerCase() === "x-hostel-id" ? hostelHeader : undefined; }
});

test("tenant middleware selects the authenticated primary hostel by default", async () => {
    const req = makeRequest({ role: ROLES.WARDEN, hostelId: "hostel-a", memberships: ["hostel-a", "hostel-b"] });
    const response = createResponse();
    let nextCalled = false;

    await tenantMiddleware(req, response, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.deepEqual(req.tenant, { hostelId: "hostel-a" });
});

test("tenant middleware allows switching only to an assigned hostel", async () => {
    const req = makeRequest({ role: ROLES.WARDEN, hostelId: "hostel-a", memberships: ["hostel-a", "hostel-b"] }, "hostel-b");
    const response = createResponse();

    await tenantMiddleware(req, response, () => {});
    assert.deepEqual(req.tenant, { hostelId: "hostel-b" });

    const deniedRequest = makeRequest({ role: ROLES.WARDEN, hostelId: "hostel-a", memberships: ["hostel-a"] }, "hostel-b");
    const deniedResponse = createResponse();
    await tenantMiddleware(deniedRequest, deniedResponse, () => {});
    assert.equal(deniedResponse.statusCode, 403);
    assert.equal(deniedRequest.tenant, undefined);
});

test("tenant middleware rejects a hostel-less account for tenant data", async () => {
    const req = makeRequest({ role: ROLES.SYSTEM_ADMIN, hostelId: null, memberships: [] });
    const response = createResponse();
    await tenantMiddleware(req, response, () => {});
    assert.equal(req.tenant, null);
    assert.equal(requireTenant(req, response, () => {}), response);
    assert.equal(response.statusCode, 403);
});

test("hostelScope always pins query filters to the verified tenant", () => {
    const scoped = hostelScope({ tenant: { hostelId: "hostel-a" } }, {
        status: "ACTIVE",
        hostelId: "hostel-b"
    });
    assert.deepEqual(scoped, { status: "ACTIVE", hostelId: "hostel-a" });
    assert.throws(() => hostelScope({ tenant: null }), /verified hostel tenant context/);
});

test("system administrators can select only an active existing hostel", async () => {
    const Hostel = require("../src/models/Hostel");
    const originalFindOne = Hostel.findOne;
    const hostel = { _id: "64b64c1a1e2c3d4e5f607186" };
    const req = makeRequest({ role: ROLES.SYSTEM_ADMIN, hostelId: null, memberships: [] }, hostel._id);
    const response = createResponse();

    try {
        Hostel.findOne = () => ({ select: () => ({ lean: async () => hostel }) });
        await tenantMiddleware(req, response, () => {});
        assert.deepEqual(req.tenant, { hostelId: hostel._id });

        Hostel.findOne = () => ({ select: () => ({ lean: async () => null }) });
        const missingReq = makeRequest({ role: ROLES.SYSTEM_ADMIN, hostelId: null, memberships: [] }, hostel._id);
        const missingResponse = createResponse();
        await tenantMiddleware(missingReq, missingResponse, () => {});
        assert.equal(missingResponse.statusCode, 403);
    } finally {
        Hostel.findOne = originalFindOne;
    }
});

test("system administrator token hostel selection becomes the default tenant context", async () => {
    const Hostel = require("../src/models/Hostel");
    const originalFindOne = Hostel.findOne;
    const hostelId = "64b64c1a1e2c3d4e5f607187";
    const req = makeRequest({ role: ROLES.SYSTEM_ADMIN, hostelId, memberships: [] });
    const response = createResponse();

    try {
        Hostel.findOne = () => ({ select: () => ({ lean: async () => ({ _id: hostelId }) }) });
        await tenantMiddleware(req, response, () => {});
        assert.deepEqual(req.tenant, { hostelId });
    } finally {
        Hostel.findOne = originalFindOne;
    }
});
