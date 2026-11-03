const assert = require("node:assert/strict");
const test = require("node:test");
const Complaint = require("../src/models/Complaint");
const Student = require("../src/models/Student");
const Parent = require("../src/models/Parent");
const service = require("../src/services/complaintService");
const ROLES = require("../src/constants/roles");

const ids = { hostel: "64b64c1a1e2c3d4e5f607181", student: "64b64c1a1e2c3d4e5f607182", user: "64b64c1a1e2c3d4e5f607183", complaint: "64b64c1a1e2c3d4e5f607184" };
const request = (role, body = {}) => ({ auth: { id: ids.user, role }, tenant: { hostelId: ids.hostel }, body, query: {}, params: { id: ids.complaint } });
async function swap(target, key, replacement, work) { const original = target[key]; target[key] = replacement; try { return await work(); } finally { target[key] = original; } }

test("student complaint validates required fields and uses verified tenant identity", async () => {
    await assert.rejects(service.create(request(ROLES.STUDENT, { title: "No", description: "short" })), (error) => error.statusCode === 400);
    await swap(Student, "findOne", () => ({ select: () => ({ lean: async () => ({ _id: ids.student }) }) }), async () => {
        await swap(Complaint, "create", async (record) => ({ _id: ids.complaint, ...record }), async () => {
            await swap(Complaint, "findById", () => ({ populate: () => ({ lean: async () => ({ _id: ids.complaint, hostelId: ids.hostel, status: "PENDING" }) }) }), async () => {
                const result = await service.create(request(ROLES.STUDENT, { title: "Water leak", description: "Water is leaking near the room door.", category: "WATER", priority: "HIGH" }));
                assert.equal(result.status, "PENDING");
            });
        });
    });
});

test("staff status update remains tenant scoped and writes history", async () => {
    const record = { _id: ids.complaint, hostelId: ids.hostel, status: "PENDING", statusNote: "", history: [], save: async function () { return this; } };
    await swap(Complaint, "findOne", async (filter) => { assert.equal(filter.hostelId, ids.hostel); return record; }, async () => {
        await swap(Complaint, "findById", () => ({ populate: () => ({ lean: async () => record }) }), async () => {
            const result = await service.updateStatus(request(ROLES.WARDEN, { status: "IN_PROGRESS", note: "Maintenance team assigned." }));
            assert.equal(result.status, "IN_PROGRESS");
            assert.equal(record.history[0].actorRole, ROLES.WARDEN);
        });
    });
});

test("parent complaint view scopes records to linked students", async () => {
    await swap(Parent, "findOne", () => ({ select: () => ({ lean: async () => ({ studentIds: [ids.student] }) }) }), async () => {
        await swap(Complaint, "find", (filter) => { assert.deepEqual(filter.studentId.$in, [ids.student]); return { populate: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) }; }, async () => {
            const result = await service.mine(request(ROLES.PARENT));
            assert.deepEqual(result.items, []);
        });
    });
});
