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

const EntryExit = require("../src/models/EntryExit");
const dashboardService = require("../src/services/dashboardService");

const dateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

test("dashboard returns 7-day and 30-day tenant-scoped gate trends", async () => {
    const tenantId = "64b64c1a1e2c3d4e5f607182";
    const countFilters = [];
    const aggregatePipelines = [];
    const originals = models.map((model) => ({
        model,
        countDocuments: model.countDocuments,
        find: model.find
    }));
    const originalAggregate = EntryExit.aggregate;

    try {
        const yesterday = new Date();
        yesterday.setHours(0, 0, 0, 0);
        yesterday.setDate(yesterday.getDate() - 1);

        for (const model of models) {
            model.countDocuments = async (filter) => {
                countFilters.push({ model: model.modelName, filter });
                return 0;
            };

            model.find = () => ({
                select() { return this; },
                populate() { return this; },
                sort() { return this; },
                limit() { return this; },
                lean: async () => []
            });
        }

        EntryExit.aggregate = async (pipeline) => {
            aggregatePipelines.push(pipeline);
            return [{
                _id: dateKey(yesterday),
                entries: 3,
                exits: 2
            }];
        };

        for (const rangeDays of [7, 30]) {
            const result = await dashboardService.getDashboardSummary(
                { hostelId: tenantId },
                { rangeDays }
            );

            assert.equal(result.analytics.rangeDays, rangeDays);

            const daily = result.analytics.dailyGateActivity;
            assert.equal(daily.length, rangeDays);
            assert.deepEqual(daily[rangeDays - 2], {
                date: dateKey(yesterday),
                entries: 3,
                exits: 2
            });

            for (const item of daily) {
                assert.match(item.date, /^\d{4}-\d{2}-\d{2}$/);
                assert.ok(Number.isInteger(item.entries));
                assert.ok(Number.isInteger(item.exits));
            }
        }

        assert.equal(aggregatePipelines.length, 2);

        for (const pipeline of aggregatePipelines) {
            const match = pipeline[0].$match;
            assert.equal(String(match.hostelId), tenantId);
            assert.equal(match.isDeleted, false);
            assert.ok(match.recordedAt.$gte instanceof Date);
            assert.ok(match.recordedAt.$lt instanceof Date);
            assert.ok(match.recordedAt.$gte < match.recordedAt.$lt);
            assert.ok(pipeline.some((stage) => stage.$group));
            assert.ok(pipeline.some((stage) => stage.$sort));
        }

        for (const { model, filter } of countFilters) {
            if (model !== "Hostel") {
                assert.equal(String(filter.hostelId), tenantId);
            }
        }
    } finally {
        EntryExit.aggregate = originalAggregate;

        for (const original of originals) {
            original.model.countDocuments = original.countDocuments;
            original.model.find = original.find;
        }
    }
});