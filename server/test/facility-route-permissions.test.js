const assert = require("node:assert/strict");
const test = require("node:test");

const router = require("../src/routes/facilityRoutes");
const ROLES = require("../src/constants/roles");

function getResourceRouter(resource) {
    const layer = router.stack.find((candidate) =>
        candidate.name === "router" &&
        Array.isArray(candidate.handle?.stack) &&
        candidate.match(`/${resource}`)
    );
    assert.ok(layer, `Missing /${resource} router`);
    return layer.handle;
}

function getRoute(resource, method, routePath) {
    const childRouter = getResourceRouter(resource);
    const layer = childRouter.stack.find((candidate) =>
        candidate.route?.path === routePath && candidate.route.methods[method]
    );
    assert.ok(layer, `Missing ${method.toUpperCase()} /${resource}${routePath}`);
    return layer.route;
}

function invokeGuard(route, role) {
    assert.equal(route.stack.length, 2, "Mutation route must contain role guard and controller handler");
    const guard = route.stack[0].handle;
    const response = {
        statusCode: null,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
    let nextCalled = false;
    guard({ auth: { role } }, response, () => { nextCalled = true; });
    return { response, nextCalled };
}

const resources = ["blocks", "floors", "rooms", "beds"];

for (const resource of resources) {
    test(`${resource}: only OWNER and SYSTEM_ADMIN can create, edit, or delete`, () => {
        const mutationRoutes = [
            ["post", "/"],
            ["patch", "/:id"],
            ["delete", "/:id"]
        ];

        for (const [method, routePath] of mutationRoutes) {
            const route = getRoute(resource, method, routePath);

            for (const role of [ROLES.OWNER, ROLES.SYSTEM_ADMIN]) {
                const result = invokeGuard(route, role);
                assert.equal(result.nextCalled, true, `${role} should be allowed to ${method} ${resource}`);
                assert.equal(result.response.statusCode, null);
            }

            for (const role of [ROLES.WARDEN, ROLES.GUARD, ROLES.STUDENT, ROLES.PARENT]) {
                const result = invokeGuard(route, role);
                assert.equal(result.nextCalled, false, `${role} must be blocked from ${method} ${resource}`);
                assert.equal(result.response.statusCode, 403);
                assert.equal(result.response.body?.message, "You do not have permission to access this resource");
            }
        }
    });

    test(`${resource}: read routes remain available to the route's standard staff roles`, () => {
        const listRoute = getRoute(resource, "get", "/");
        const detailRoute = getRoute(resource, "get", "/:id");
        assert.equal(listRoute.stack.length, 1, "List GET should not have an owner-only mutation guard");
        assert.equal(detailRoute.stack.length, 1, "Detail GET should not have an owner-only mutation guard");
    });
}