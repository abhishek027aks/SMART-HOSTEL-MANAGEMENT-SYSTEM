const assert = require("node:assert/strict");
const test = require("node:test");
const HelpContact = require("../src/models/HelpContact");
const service = require("../src/services/helpContactService");

const hostelId = "64b64c1a1e2c3d4e5f607181";
const id = "64b64c1a1e2c3d4e5f607182";
const req = (body = {}) => ({ auth: { id }, tenant: { hostelId }, body, params: { id }, query: {} });
async function swap(key, replacement, work) { const original = HelpContact[key]; HelpContact[key] = replacement; try { return await work(); } finally { HelpContact[key] = original; } }

test("help contact validation rejects unsafe payloads", async () => {
    await assert.rejects(service.create(req({ category: "INVALID", name: "A", phone: "1" })), (error) => error.statusCode === 400);
    await assert.rejects(service.create(req({ category: "WARDEN", name: "Warden", phone: "123456", email: "bad" })), (error) => error.statusCode === 400);
});

test("help contacts use the verified hostel when created and listed", async () => {
    await swap("create", async (record) => record, async () => {
        const created = await service.create(req({ category: "EMERGENCY", name: "Hostel Emergency", phone: "9876543210" }));
        assert.equal(created.hostelId, hostelId);
        assert.equal(created.createdBy, id);
    });
    await swap("find", (filter) => { assert.equal(filter.hostelId, hostelId); assert.equal(filter.isActive, true); return { sort: () => ({ lean: async () => [] }) }; }, async () => {
        assert.deepEqual(await service.list(req()), { items: [] });
    });
});

test("archiving a help contact remains tenant scoped", async () => {
    const record = { _id: id, isDeleted: false, isActive: true, save: async function () { return this; } };
    await swap("findOne", async (filter) => { assert.equal(filter.hostelId, hostelId); return record; }, async () => {
        const result = await service.archive(req());
        assert.equal(result.id, id);
        assert.equal(record.isDeleted, true);
        assert.equal(record.isActive, false);
    });
});
