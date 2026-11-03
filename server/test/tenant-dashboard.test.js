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

test("tenant dashboard filters every count and list by the verified hostel", async () => {
    const tenantId = "64b64c1a1e2c3d4e5f607182";
    const countFilters = [];
    const findFilters = [];
    const populateOptions = [];
    const selectOptions = [];
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
                return 0;
            };
            model.find = (filter) => {
                findFilters.push({ model: model.modelName, filter });
                return {
                    select(fields) { selectOptions.push({ model: model.modelName, fields }); return this; },
                    populate(options) { populateOptions.push({ model: model.modelName, options }); return this; },
                    sort() { return this; },
                    limit() { return this; },
                    lean: async () => []
                };
            };
        }

        const result = await dashboardService.getDashboardSummary({ hostelId: tenantId });

        assert.equal(result.analytics.rangeDays, 7);
        assert.equal(result.analytics.dailyGateActivity.length, 7);

        assert.equal(result.counts.totalHostels, 0);
        assert.equal(countFilters.length, 14);
        assert.equal(findFilters.length, 3);
        assert.equal(selectOptions.length, 3, "Recent-data queries must restrict returned fields.");

        const expectedProjections = {
            Student: "_id name studentId roomId status",
            EntryExit: "_id studentId type recordedAt",
            Complaint: "_id title category priority studentId"
        };

        for (const [model, fields] of Object.entries(expectedProjections)) {
            const selected = selectOptions.find((entry) => entry.model === model);
            assert.equal(selected?.fields, fields, `${model} dashboard fields must be restricted.`);
        }

        for (const { model, filter } of countFilters) {
            if (model === "Hostel") {
                assert.equal(String(filter._id), tenantId);
            } else {
                assert.equal(filter.hostelId, tenantId, `${model} count is not tenant-scoped`);
            }
        }
        for (const { model, filter } of findFilters) {
            assert.equal(filter.hostelId, tenantId, `${model} list is not tenant-scoped`);
        }
        assert.equal(populateOptions.length, 2);
        for (const { options } of populateOptions) {
            assert.equal(options.match.hostelId, tenantId);
        }
    } finally {
        entryExitModel.aggregate = originalAggregate;
        for (const original of originals) {
            original.model.countDocuments = original.countDocuments;
            original.model.find = original.find;
        }
    }
});

