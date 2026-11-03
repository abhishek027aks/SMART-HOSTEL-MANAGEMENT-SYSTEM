const assert = require("node:assert/strict");
const test = require("node:test");

const Hostel = require("../src/models/Hostel");
const controller = require("../src/controllers/hostelController");
const hostelRouter = require("../src/routes/hostelRoutes");

const makeResponse = () => ({
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
});

test("public hostel directory returns active records with an explicit safe projection", async () => {
    const originalFind = Hostel.find;
    const originalCount = Hostel.countDocuments;

    const items = [{
        _id: "64b64c1a1e2c3d4e5f607180",
        name: "North Hostel",
        photoUrl: "",
        galleryImages: [],
        city: "Kanpur",
        state: "Uttar Pradesh",
        roomSetup: { totalRooms: 20, totalBeds: 60, bedsPerRoom: 3 }
    }];

    let observedFilter;
    let observedProjection;

    Hostel.find = (filter) => {
        observedFilter = filter;
        const query = {
            select(fields) { observedProjection = fields; return query; },
            sort() { return query; },
            skip() { return query; },
            limit() { return query; },
            lean: async () => items
        };
        return query;
    };

    Hostel.countDocuments = async (filter) => {
        assert.deepEqual(filter, observedFilter);
        return items.length;
    };

    try {
        const res = makeResponse();
        await controller.listPublic(
            { query: { page: "1", limit: "9", q: "North" } },
            res,
            (error) => { throw error; }
        );

        assert.equal(res.statusCode, 200);
        assert.equal(res.payload.status, "success");
        assert.equal(res.payload.data.items.length, 1);
        assert.equal(res.payload.data.items[0].name, "North Hostel");
        assert.equal(observedFilter.status, "ACTIVE");
        assert.deepEqual(observedFilter.isDeleted, { $ne: true });
        assert.match(observedFilter.$or[0].name.$regex, /North/);
        assert.match(observedProjection, /photoUrl/);
        assert.match(observedProjection, /roomSetup/);
        assert.doesNotMatch(observedProjection, /accessCode|ownerId/);
        assert.equal(res.payload.data.pagination.total, 1);
    } finally {
        Hostel.find = originalFind;
        Hostel.countDocuments = originalCount;
    }
});

test("public hostel directory rejects invalid pagination", async () => {
    const res = makeResponse();

    await controller.listPublic(
        { query: { page: "0", limit: "9" } },
        res,
        (error) => { throw error; }
    );

    assert.equal(res.statusCode, 400);
    assert.match(res.payload.message, /pagination/i);
});

test("public hostel route is registered before the generic hostel ID route", () => {
    const paths = hostelRouter.stack
        .filter((layer) => layer.route)
        .map((layer) => layer.route.path);

    assert.ok(paths.includes("/public"));
    assert.ok(paths.includes("/:id"));
    assert.ok(paths.indexOf("/public") < paths.indexOf("/:id"));
});