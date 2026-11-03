const assert = require("node:assert/strict");
const test = require("node:test");
const Student = require("../src/models/Student");
const report = require("../src/services/reportService");

const tenantId = "64b64c1a1e2c3d4e5f607181";
const request = { tenant: { hostelId: tenantId } };

test("reports reject unknown report types", async () => {
    await assert.rejects(() => report.list(request, "database-secrets"), { statusCode: 404 });
});

test("student CSV report is tenant-scoped and safely escapes cells", async () => {
    const originalFind = Student.find;
    let filter;
    const query = {
        select: () => query, sort: () => query, limit: () => query,
        lean: async () => [{ studentId: "STU-1", name: 'A "Quoted" Name', email: "a@example.com", mobile: "9", status: "ACTIVE", createdAt: new Date("2026-01-01T00:00:00Z") }]
    };
    Student.find = (value) => { filter = value; return query; };
    try {
        const result = await report.csv(request, "students");
        assert.equal(String(filter.hostelId), tenantId);
        assert.match(result.content, /"A ""Quoted"" Name"/);
    } finally { Student.find = originalFind; }
});

test("report summary counts records only in the verified hostel", async () => {
    const originals = new Map();
    const models = Object.values(report.TYPES).map((config) => config.model);
    const filters = [];
    for (const model of models) {
        originals.set(model, model.countDocuments);
        model.countDocuments = async (filter) => { filters.push(filter); return 1; };
    }
    try {
        const result = await report.summary(request);
        assert.deepEqual(result, { students: 1, rooms: 1, beds: 1, gate: 1, outpasses: 1, complaints: 1, fees: 1 });
        assert.equal(filters.length, 7);
        assert.ok(filters.every((filter) => String(filter.hostelId) === tenantId && filter.isDeleted.$ne === true));
    } finally { for (const [model, countDocuments] of originals) model.countDocuments = countDocuments; }
});
