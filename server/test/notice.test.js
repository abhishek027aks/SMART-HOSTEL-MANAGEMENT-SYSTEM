const assert = require("node:assert/strict");
const test = require("node:test");
const Notice = require("../src/models/Notice");
const Block = require("../src/models/Block");
const service = require("../src/services/noticeService");
const notifications = require("../src/services/notificationService");

const hostelId = "64b64c1a1e2c3d4e5f607181";
const userId = "64b64c1a1e2c3d4e5f607182";
const req = (body = {}) => ({
    auth: { id: userId, role: "OWNER" },
    tenant: { hostelId },
    body,
    query: {}
});

async function withStubs(stubs, work) {
    const originals = stubs.map(([object, key]) => [object, key, object[key]]);
    for (const [object, key, replacement] of stubs) object[key] = replacement;

    try {
        return await work();
    } finally {
        for (const [object, key, original] of originals.reverse()) object[key] = original;
    }
}

const query = (result) => ({
    select() { return this; },
    sort() { return this; },
    limit() { return this; },
    lean: async () => result
});

test("notice content validation rejects invalid titles", async () => {
    await assert.rejects(
        service.create(req({ title: "No", body: "bad" })),
        (err) => err.statusCode === 400
    );
});

test("notice creation uses the verified hostel and emits a publish event", async () => {
    let emitted = null;
    const created = await withStubs([
        [Notice, "create", async (record) => ({ ...record, _id: userId })],
        [notifications, "notifyNoticePublished", async (notice) => { emitted = notice; return { created: 1 }; }]
    ], () => service.create(req({
        title: "Water supply",
        body: "Water supply will pause at 11 PM.",
        target: "ALL_STUDENTS",
        priority: "IMPORTANT"
    })));

    assert.equal(created.hostelId, hostelId);
    assert.equal(created.publishedBy, userId);
    assert.equal(emitted, created);
});

test("notice target IDs must resolve to active records in the same hostel", async () => {
    const blockId = "64b64c1a1e2c3d4e5f607199";

    await withStubs([
        [Block, "findOne", (filter) => {
            assert.equal(String(filter.hostelId), hostelId);
            assert.equal(String(filter._id), blockId);
            return query(null);
        }]
    ], async () => {
        await assert.rejects(
            service.create(req({
                title: "Block announcement",
                body: "Important block update.",
                target: "BLOCK",
                targetBlockId: blockId
            })),
            (err) => err.statusCode === 404
        );
    });
});

test("notice list is scoped to the verified hostel", async () => {
    await withStubs([
        [Notice, "find", (filter) => {
            assert.equal(String(filter.hostelId), hostelId);
            return query([]);
        }]
    ], async () => {
        assert.deepEqual(await service.list(req()), { items: [] });
    });
});