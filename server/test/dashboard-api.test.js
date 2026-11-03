process.env.JWT_SECRET = process.env.JWT_SECRET || "dashboard-api-test-secret-with-at-least-32-bytes";

const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");

const config = require("../src/config");
const ROLES = require("../src/constants/roles");
const app = require("../src/app");
const { signAccessToken } = require("../src/utils/token");

const User = require("../src/models/User");
const Hostel = require("../src/models/Hostel");
const HostelMembership = require("../src/models/HostelMembership");
const Bed = require("../src/models/Bed");
const Complaint = require("../src/models/Complaint");
const EntryExit = require("../src/models/EntryExit");
const Outpass = require("../src/models/Outpass");
const Room = require("../src/models/Room");
const Student = require("../src/models/Student");

const tenantId = "64b64c1a1e2c3d4e5f607182";
const wardenId = "api-test-warden";
const guardId = "api-test-guard";

const users = new Map([
    [wardenId, {
        _id: wardenId,
        name: "API Test Warden",
        email: "warden@example.invalid",
        mobile: "",
        photoUrl: "",
        role: ROLES.WARDEN,
        hostelId: tenantId,
        status: "ACTIVE",
        isDeleted: false
    }],
    [guardId, {
        _id: guardId,
        name: "API Test Guard",
        email: "guard@example.invalid",
        mobile: "",
        photoUrl: "",
        role: ROLES.GUARD,
        hostelId: tenantId,
        status: "ACTIVE",
        isDeleted: false
    }]
]);

const dashboardModels = [Bed, Complaint, EntryExit, Hostel, Outpass, Room, Student];

const originals = {
    userFindById: User.findById,
    membershipFind: HostelMembership.find,
    aggregate: EntryExit.aggregate,
    models: dashboardModels.map((model) => ({
        model,
        find: model.find,
        countDocuments: model.countDocuments
    }))
};

const selectCalls = [];
const populateCalls = [];
const dashboardFindCalls = [];
const dashboardCountCalls = [];
const aggregatePipelines = [];

const makeQuery = (modelName, result) => ({
    select(fields) {
        selectCalls.push({ model: modelName, fields });
        return this;
    },
    populate(options) {
        populateCalls.push({ model: modelName, options });
        return this;
    },
    sort() {
        return this;
    },
    limit() {
        return this;
    },
    lean: async () => result
});

const countFor = (modelName, filter) => {
    switch (modelName) {
        case "Hostel":
            return 1;
        case "Student":
            return filter.status === "ACTIVE" ? 2 : 3;
        case "Room":
            return filter.status === "AVAILABLE" ? 1 : 3;
        case "Bed":
            if (filter.status === "OCCUPIED") return 2;
            if (filter.status === "AVAILABLE") return 3;
            if (filter.status === "RESERVED") return 1;
            if (filter.status === "MAINTENANCE") return 0;
            return 6;
        case "EntryExit":
            return filter.type === "ENTRY" ? 4 : 2;
        case "Outpass":
            return 1;
        case "Complaint":
            return 2;
        default:
            throw new Error(`Unexpected dashboard count model: ${modelName}`);
    }
};

test("dashboard API authenticates requests, enforces roles, and returns scoped summary", async () => {
    config.validateAuthConfig();

    try {
        User.findById = (id) => makeQuery("User", users.get(String(id)) || null);

        HostelMembership.find = (filter) => {
            const userId = String(filter.userId);
            const user = users.get(userId);
            const result = user && user.role === filter.role
                ? [{ hostelId: tenantId }]
                : [];
            return makeQuery("HostelMembership", result);
        };

        for (const model of dashboardModels) {
            model.countDocuments = async (filter) => {
                dashboardCountCalls.push({ model: model.modelName, filter });
                return countFor(model.modelName, filter);
            };

            model.find = (filter) => {
                if (model.modelName === "Hostel") {
                    const ids = filter?._id?.$in || [];
                    const result = ids.includes(tenantId) ? [{ _id: tenantId }] : [];
                    return makeQuery("Hostel", result);
                }

                dashboardFindCalls.push({ model: model.modelName, filter });
                return makeQuery(model.modelName, []);
            };
        }

        EntryExit.aggregate = async (pipeline) => {
            aggregatePipelines.push(pipeline);
            return [];
        };

        const server = app.listen(0, "127.0.0.1");
        await once(server, "listening");
        const baseUrl = `http://127.0.0.1:${server.address().port}`;

        try {
            const anonymous = await fetch(`${baseUrl}/api/dashboard/summary`);
            assert.equal(anonymous.status, 401);

            const wardenToken = signAccessToken({
                id: wardenId,
                role: ROLES.WARDEN,
                hostelId: tenantId
            }, config.jwtSecret);

            const wardenResponse = await fetch(`${baseUrl}/api/dashboard/summary`, {
                headers: { Authorization: `Bearer ${wardenToken}` }
            });

            assert.equal(wardenResponse.status, 200);
            const payload = await wardenResponse.json();
            assert.equal(payload.status, "success");
            assert.equal(payload.data.analytics.rangeDays, 7);
            assert.equal(payload.data.analytics.dailyGateActivity.length, 7);

            assert.deepEqual(payload.data.counts, {
                totalHostels: 1,
                totalStudents: 3,
                activeStudents: 2,
                inactiveStudents: 1,
                totalRooms: 3,
                vacantRooms: 1,
                totalBeds: 6,
                occupiedBeds: 2,
                vacantBeds: 3,
                reservedBeds: 1,
                maintenanceBeds: 0,
                todayEntry: 4,
                todayExit: 2,
                pendingOutpasses: 1,
                openComplaints: 2
            });

            assert.deepEqual(payload.data.recentStudents, []);
            assert.deepEqual(payload.data.recentEntryExit, []);
            assert.deepEqual(payload.data.recentComplaints, []);
            assert.ok(wardenResponse.headers.get("x-request-id"));

            assert.equal(dashboardCountCalls.length, 14);
            assert.equal(dashboardFindCalls.length, 3);

            for (const { model, filter } of dashboardCountCalls) {
                if (model === "Hostel") {
                    assert.equal(String(filter._id), tenantId);
                } else {
                    assert.equal(String(filter.hostelId), tenantId);
                }
            }

            for (const { filter } of dashboardFindCalls) {
                assert.equal(String(filter.hostelId), tenantId);
            }

            for (const [model, fields] of Object.entries({
                Student: "_id name studentId roomId status",
                EntryExit: "_id studentId type recordedAt",
                Complaint: "_id title category priority studentId"
            })) {
                assert.ok(
                    selectCalls.some((item) => item.model === model && item.fields === fields),
                    `${model} query must select only required dashboard fields`
                );
            }

            assert.equal(populateCalls.length, 2);
            for (const { options } of populateCalls) {
                assert.equal(options.select, "name studentId");
                assert.equal(options.match.hostelId, tenantId);
            }

            const thirtyDayResponse = await fetch(
                `${baseUrl}/api/dashboard/summary?rangeDays=30`,
                { headers: { Authorization: `Bearer ${wardenToken}` } }
            );

            assert.equal(thirtyDayResponse.status, 200);
            const thirtyDayPayload = await thirtyDayResponse.json();
            assert.equal(thirtyDayPayload.data.analytics.rangeDays, 30);
            assert.equal(thirtyDayPayload.data.analytics.dailyGateActivity.length, 30);

            assert.equal(aggregatePipelines.length, 2);
            for (const pipeline of aggregatePipelines) {
                const match = pipeline[0].$match;
                assert.equal(String(match.hostelId), tenantId);
                assert.equal(match.isDeleted, false);
                assert.ok(match.recordedAt.$gte instanceof Date);
                assert.ok(match.recordedAt.$lt instanceof Date);
                assert.ok(match.recordedAt.$gte < match.recordedAt.$lt);
            }

            const invalidRangeResponse = await fetch(
                `${baseUrl}/api/dashboard/summary?rangeDays=14`,
                { headers: { Authorization: `Bearer ${wardenToken}` } }
            );
            assert.equal(invalidRangeResponse.status, 400);
            const guardToken = signAccessToken({
                id: guardId,
                role: ROLES.GUARD,
                hostelId: tenantId
            }, config.jwtSecret);

            const guardResponse = await fetch(`${baseUrl}/api/dashboard/summary`, {
                headers: { Authorization: `Bearer ${guardToken}` }
            });

            assert.equal(guardResponse.status, 403);
        } finally {
            await new Promise((resolve, reject) => {
                server.close((error) => error ? reject(error) : resolve());
            });
        }
    } finally {
        EntryExit.aggregate = originals.aggregate;
        User.findById = originals.userFindById;
        HostelMembership.find = originals.membershipFind;

        for (const original of originals.models) {
            original.model.find = original.find;
            original.model.countDocuments = original.countDocuments;
        }
    }
});