const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const app = require("../src/app");

test("parent APIs reject requests without authentication", async () => {
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");

    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    try {
        const checks = [
            { path: "/api/parents", method: "GET" },
            {
                path: "/api/parents",
                method: "POST",
                body: {
                    parentId: "UNAUTH-PARENT",
                    name: "Unauthorised",
                    relationship: "FATHER",
                    studentIds: ["64b64c1a1e2c3d4e5f607183"],
                    password: "SomeSecurePassword123",
                    email: "unauthorised@example.invalid"
                }
            },
            { path: "/api/parents/me", method: "GET" },
            { path: "/api/parents/64b64c1a1e2c3d4e5f607183", method: "GET" },
            {
                path: "/api/parents/64b64c1a1e2c3d4e5f607183",
                method: "PATCH",
                body: { status: "INACTIVE" }
            }
        ];

        for (const check of checks) {
            const response = await fetch(`${baseUrl}${check.path}`, {
                method: check.method,
                headers: check.body ? { "Content-Type": "application/json" } : {},
                ...(check.body ? { body: JSON.stringify(check.body) } : {})
            });

            assert.equal(
                response.status,
                401,
                `${check.method} ${check.path} must reject unauthenticated access`
            );
        }
    } finally {
        await new Promise((resolve, reject) =>
            server.close((error) => error ? reject(error) : resolve())
        );
    }
});
// PARENT_ROUTE_ORDER_REGRESSION_V1
test("Parent self-profile route is registered before administrator-only middleware", () => {
    const parentRoutes = require("../src/routes/parentRoutes");
    const stack = parentRoutes.stack || [];

    const parentMeIndex = stack.findIndex(
        (layer) => layer.route?.path === "/me" && layer.route.methods.get
    );
    const firstUseIndex = stack.findIndex((layer) => !layer.route);

    assert.notEqual(parentMeIndex, -1, "GET /me route must be registered");
    assert.notEqual(firstUseIndex, -1, "Admin middleware must be registered");
    assert.ok(
        parentMeIndex < firstUseIndex,
        "Parent /me must be checked with its own role middleware before admin-only middleware"
    );
});
