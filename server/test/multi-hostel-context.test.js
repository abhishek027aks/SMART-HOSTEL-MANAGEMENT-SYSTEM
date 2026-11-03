const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { tenantMiddleware } = require("../src/middleware/tenantMiddleware");

const root = path.resolve(__dirname, "..");

const createResponse = () => ({
    statusCode: null,
    payload: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(payload) {
        this.payload = payload;
        return this;
    }
});

const invokeTenantMiddleware = async (auth, requestedHostelId) => {
    let nextCalled = false;

    const req = {
        auth,
        get(name) {
            return name.toLowerCase() === "x-hostel-id"
                ? requestedHostelId
                : undefined;
        }
    };

    const res = createResponse();

    await tenantMiddleware(req, res, () => {
        nextCalled = true;
    });

    return { req, res, nextCalled };
};

test("System Admin can explicitly select the all-hostels overview", async () => {
    const result = await invokeTenantMiddleware(
        { role: "SYSTEM_ADMIN", hostelId: null, memberships: [] },
        "__ALL_HOSTELS__"
    );

    assert.equal(result.nextCalled, true);
    assert.equal(result.req.tenant, null);
    assert.equal(result.res.statusCode, null);
});

test("Owner cannot use the all-hostels context to bypass membership", async () => {
    const result = await invokeTenantMiddleware(
        { role: "OWNER", hostelId: "hostel-a", memberships: ["hostel-a"] },
        "__ALL_HOSTELS__"
    );

    assert.equal(result.nextCalled, false);
    assert.equal(result.res.statusCode, 403);
});

test("Owner can select another assigned hostel", async () => {
    const result = await invokeTenantMiddleware(
        {
            role: "OWNER",
            hostelId: "hostel-a",
            memberships: ["hostel-a", "hostel-b"]
        },
        "hostel-b"
    );

    assert.equal(result.nextCalled, true);
    assert.equal(result.req.tenant.hostelId, "hostel-b");
});

test("Owner cannot select a hostel outside their membership list", async () => {
    const result = await invokeTenantMiddleware(
        { role: "OWNER", hostelId: "hostel-a", memberships: ["hostel-a"] },
        "hostel-secret"
    );

    assert.equal(result.nextCalled, false);
    assert.equal(result.res.statusCode, 403);
});

test("accessible-hostel endpoint requires authentication and uses the controller", () => {
    const routes = fs.readFileSync(
        path.join(root, "src", "routes", "authRoutes.js"),
        "utf8"
    );
    const controller = fs.readFileSync(
        path.join(root, "src", "controllers", "authController.js"),
        "utf8"
    );

    assert.match(
        routes,
        /router\.get\("\/hostels",\s*requireAuth,\s*authController\.listAccessibleHostels\)/
    );
    assert.match(controller, /const listAccessibleHostels = async/);
    assert.match(controller, /req\.auth\?\.memberships/);
    assert.match(controller, /ROLES\.SYSTEM_ADMIN/);
    assert.match(controller, /\.select\("_id name hostelCode city state"\)/);
});