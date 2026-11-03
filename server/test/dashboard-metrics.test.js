const assert = require("node:assert/strict");
const test = require("node:test");

const models = [
    require("../src/models/Bed"),
    require("../src/models/Complaint"),
    require("../src/models/EntryExit"),
    require("../src/models/Hostel"),
    require("../src/models/Outpass"),
    require("../src/models/Room"),
    require("../src/models/Student")
];

const dashboardService = require("../src/services/dashboardService");

test("dashboard summary calculates counts and keeps tenant/date filters", async () => {
    const tenantId = "64b64c1a1e2c3d4e5f607182";
    const countFilters = [];
    const findFilters = [];
    const entryExitModel = models.find((model) => model.modelName === "EntryExit");
    const originalAggregate = entryExitModel.aggregate;

    const originals = models.map((model) => ({
        model,
        countDocuments: model.countDocuments,
        find: model.find
    }));

    try {
        entryExitModel.aggregate = async () => [];
        for (const model of models) {
            model.countDocuments = async (filter) => {
                countFilters.push({ model: model.modelName, filter });

                switch (model.modelName) {
                    case "Hostel": return 1;
                    case "Student": return filter.status === "ACTIVE" ? 8 : 10;
                    case "Room": return filter.status === "AVAILABLE" ? 4 : 12;
                    case "Bed":
                        if (filter.status === "OCCUPIED") return 12;
                        if (filter.status === "AVAILABLE") return 5;
                        if (filter.status === "RESERVED") return 2;
                        if (filter.status === "MAINTENANCE") return 1;
                        return 20;
                    case "EntryExit": return filter.type === "ENTRY" ? 10 : 8;
                    case "Outpass": return 3;
                    case "Complaint": return 4;
                    default: throw new Error(`Unexpected model: ${model.modelName}`);
                }
            };

            model.find = (filter) => {
                findFilters.push({ model: model.modelName, filter });

                return {
                    select() { return this; },
                    populate() { return this; },
                    sort() { return this; },
                    limit() { return this; },
                    lean: async () => []
                };
            };
        }

        const result = await dashboardService.getDashboardSummary({ hostelId: tenantId });

        assert.equal(result.analytics.rangeDays, 7);
        assert.equal(result.analytics.dailyGateActivity.length, 7);

        assert.deepEqual(result.counts, {
            totalHostels: 1,
            totalStudents: 10,
            activeStudents: 8,
            inactiveStudents: 2,
            totalRooms: 12,
            vacantRooms: 4,
            totalBeds: 20,
            occupiedBeds: 12,
            vacantBeds: 5,
            reservedBeds: 2,
            maintenanceBeds: 1,
            todayEntry: 10,
            todayExit: 8,
            pendingOutpasses: 3,
            openComplaints: 4
        });

        assert.equal(countFilters.length, 14);
        assert.equal(findFilters.length, 3);

        for (const { model, filter } of countFilters) {
            if (model === "Hostel") {
                assert.equal(String(filter._id), tenantId);
            } else {
                assert.equal(filter.hostelId, tenantId);
            }
        }

        const gateFilters = countFilters.filter(({ model }) => model === "EntryExit");
        assert.equal(gateFilters.length, 2);

        for (const { filter } of gateFilters) {
            assert.ok(filter.recordedAt.$gte instanceof Date);
            assert.ok(filter.recordedAt.$lt instanceof Date);
            assert.ok(filter.recordedAt.$gte < filter.recordedAt.$lt);
        }

        for (const { filter } of findFilters) {
            assert.equal(filter.hostelId, tenantId);
        }

        assert.deepEqual(result.recentStudents, []);
        assert.deepEqual(result.recentEntryExit, []);
        assert.deepEqual(result.recentComplaints, []);
    } finally {
        entryExitModel.aggregate = originalAggregate;
        for (const original of originals) {
            original.model.countDocuments = original.countDocuments;
            original.model.find = original.find;
        }
    }
});