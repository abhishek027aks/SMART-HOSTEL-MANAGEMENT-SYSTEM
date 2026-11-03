const assert = require("node:assert/strict");
const test = require("node:test");
const Notification = require("../src/models/Notification");
const Student = require("../src/models/Student");
const service = require("../src/services/notificationService");

const hostelId = "64b64c1a1e2c3d4e5f607181";
const userId = "64b64c1a1e2c3d4e5f607182";
const otherId = "64b64c1a1e2c3d4e5f607183";
const entityId = "64b64c1a1e2c3d4e5f607184";

const req = (overrides = {}) => ({
    auth: { id: userId, role: "STUDENT" },
    tenant: { hostelId },
    params: { id: entityId },
    ...overrides
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

test("notification list is scoped to the logged-in user and verified hostel", async () => {
    await withStubs([
        [Notification, "find", (filter) => {
            assert.equal(String(filter.hostelId), hostelId);
            assert.equal(String(filter.userId), userId);
            return query([]);
        }],
        [Notification, "countDocuments", async (filter) => {
            assert.equal(String(filter.hostelId), hostelId);
            assert.equal(String(filter.userId), userId);
            assert.equal(filter.readAt, null);
            return 0;
        }]
    ], async () => {
        assert.deepEqual(await service.list(req()), { items: [], unreadCount: 0 });
    });
});

test("markRead only updates a notification owned by this user and hostel", async () => {
    const record = {
        _id: entityId,
        hostelId,
        userId,
        readAt: null,
        save: async function () { return this; }
    };

    await withStubs([
        [Notification, "findOne", async (filter) => {
            assert.equal(String(filter.hostelId), hostelId);
            assert.equal(String(filter.userId), userId);
            assert.equal(String(filter._id), entityId);
            return record;
        }]
    ], async () => {
        const result = await service.markRead(req());
        assert.ok(result.readAt instanceof Date);
    });
});

test("markRead returns not found for notifications belonging to another user", async () => {
    await withStubs([
        [Notification, "findOne", async (filter) => {
            assert.equal(String(filter.userId), userId);
            return null;
        }]
    ], async () => {
        await assert.rejects(service.markRead(req()), (err) => err.statusCode === 404);
    });
});

test("markAllRead is limited to this user's unread notifications", async () => {
    await withStubs([
        [Notification, "updateMany", async (filter, update) => {
            assert.equal(String(filter.hostelId), hostelId);
            assert.equal(String(filter.userId), userId);
            assert.equal(filter.readAt, null);
            assert.ok(update.$set.readAt instanceof Date);
            return { modifiedCount: 3 };
        }]
    ], async () => {
        assert.deepEqual(await service.markAllRead(req()), { modifiedCount: 3 });
    });
});

test("publishing a student notice creates recipient-specific in-app notifications", async () => {
    const studentUserId = "64b64c1a1e2c3d4e5f607185";
    let inserted = [];

    await withStubs([
        [Student, "find", (filter) => {
            assert.equal(String(filter.hostelId), hostelId);
            assert.equal(filter.status, "ACTIVE");
            return query([{ _id: otherId, userId: studentUserId }]);
        }],
        [Notification, "insertMany", async (records) => {
            inserted = records;
            return records;
        }]
    ], async () => {
        const result = await service.notifyNoticePublished({
            _id: entityId,
            hostelId,
            publishedBy: userId,
            title: "Hostel timing",
            body: "The hostel gate closes at 9 PM.",
            target: "ALL_STUDENTS",
            priority: "IMPORTANT"
        });

        assert.deepEqual(result, { created: 1 });
        assert.equal(inserted[0].type, "NOTICE_PUBLISHED");
        assert.equal(String(inserted[0].userId), studentUserId);
        assert.equal(String(inserted[0].hostelId), hostelId);
        assert.equal(String(inserted[0].entityId), entityId);
    });
});