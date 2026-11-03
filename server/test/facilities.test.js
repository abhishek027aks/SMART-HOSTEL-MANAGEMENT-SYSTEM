const assert = require("node:assert/strict");
const test = require("node:test");

const Block = require("../src/models/Block");
const Floor = require("../src/models/Floor");
const Room = require("../src/models/Room");
const Bed = require("../src/models/Bed");
const Student = require("../src/models/Student");
const Allocation = require("../src/models/Allocation");
const service = require("../src/services/facilityService");
const auditService = require("../src/services/auditService");

const tenantId = "64b64c1a1e2c3d4e5f607182";
const otherHostelId = "64b64c1a1e2c3d4e5f607183";
const floorId = "64b64c1a1e2c3d4e5f607184";
const blockId = "64b64c1a1e2c3d4e5f607185";
const roomId = "64b64c1a1e2c3d4e5f607186";

const mockLeanResult = (value) => ({ select() { return this; }, lean: async () => value });

test("facility payload validation rejects malformed capacity, status, and unsupported fields", () => {
    assert.throws(() => service.validatePayload("rooms", { floorId, roomNumber: "12", capacity: 0 }), { statusCode: 400 });
    assert.throws(() => service.validatePayload("beds", { roomId, bedNumber: "A", status: "OCCUPIED" }), /allocation workflow/);
    assert.throws(() => service.validatePayload("blocks", { name: "A", ownerId: otherHostelId }), /Unsupported field/);
});

test("facility parent validation scopes floor and block lookups to the verified hostel", async () => {
    const originals = { floor: Floor.findOne, block: Block.findOne };
    const filters = [];
    try {
        Floor.findOne = (filter) => { filters.push(filter); return mockLeanResult({ _id: floorId, blockId }); };
        Block.findOne = (filter) => { filters.push(filter); return mockLeanResult({ _id: blockId }); };
        const values = { floorId, roomNumber: "12", capacity: 2 };
        await service.validateParents("rooms", values, tenantId);
        assert.equal(values.blockId, blockId);
        assert.equal(filters.length, 2);
        assert.ok(filters.every((filter) => filter.hostelId === tenantId));

        await assert.rejects(
            service.validateParents("rooms", { floorId, blockId: otherHostelId }, tenantId),
            { statusCode: 400 }
        );
    } finally {
        Floor.findOne = originals.floor;
        Block.findOne = originals.block;
    }
});

test("facility list pins query filters to tenant and validates pagination", async () => {
    const originalFind = Room.find;
    const originalCount = Room.countDocuments;
    let capturedFilter;
    try {
        Room.find = (filter) => {
            capturedFilter = filter;
            return {
                sort() { return this; },
                skip() { return this; },
                limit() { return this; },
                lean: async () => []
            };
        };
        Room.countDocuments = async (filter) => {
            assert.strictEqual(filter, capturedFilter);
            return 0;
        };
        const result = await service.list("rooms", {
            tenant: { hostelId: tenantId },
            query: { hostelId: otherHostelId, page: "1", limit: "10", q: "room" }
        });
        assert.equal(capturedFilter.hostelId, tenantId);
        assert.notEqual(capturedFilter.hostelId, otherHostelId);
        assert.deepEqual(result.pagination, { page: 1, limit: 10, total: 0, pages: 0 });
        await assert.rejects(
            service.list("rooms", { tenant: { hostelId: tenantId }, query: { page: "0" } }),
            { statusCode: 400 }
        );
    } finally {
        Room.find = originalFind;
        Room.countDocuments = originalCount;
    }
});

test("bed creation respects room capacity and maintenance state", async () => {
    const originalFindOne = Room.findOne;
    const originalCount = Bed.countDocuments;
    let parentFilter;
    let bedFilter;
    try {
        Room.findOne = (filter) => { parentFilter = filter; return mockLeanResult({ _id: roomId, capacity: 2, status: "AVAILABLE" }); };
        Bed.countDocuments = async (filter) => { bedFilter = filter; return 2; };
        await assert.rejects(
            service.validateParents("beds", { roomId }, tenantId),
            /Room capacity is already reached/
        );
        assert.equal(parentFilter.hostelId, tenantId);
        assert.equal(bedFilter.hostelId, tenantId);
        assert.equal(String(bedFilter.roomId), roomId);

        Room.findOne = (filter) => { parentFilter = filter; return mockLeanResult({ _id: roomId, capacity: 2, status: "MAINTENANCE" }); };
        await assert.rejects(
            service.validateParents("beds", { roomId }, tenantId),
            /maintenance room/
        );
    } finally {
        Room.findOne = originalFindOne;
        Bed.countDocuments = originalCount;
    }
});
test("room archive is blocked while active beds remain", async () => {
    const originalFind = Room.findOne;
    const originalExists = Bed.exists;
    let childFilter;
    const record = { _id: roomId, set() {}, save: async () => {} };
    try {
        Room.findOne = () => record;
        Bed.exists = async (filter) => { childFilter = filter; return { _id: "bed" }; };
        await assert.rejects(
            service.archive("rooms", {
                tenant: { hostelId: tenantId },
                params: { id: roomId }
            }),
            /active child resources/
        );
        assert.equal(childFilter.hostelId, tenantId);
        assert.equal(String(childFilter.roomId), roomId);
    } finally {
        Room.findOne = originalFind;
        Bed.exists = originalExists;
    }
});

test("room archive rejects active student/allocation dependencies and keeps tenant scope", async () => {
    const originals = { room: Room.findOne, bedExists: Bed.exists, studentExists: Student.exists, allocationExists: Allocation.exists };
    const room = { _id: roomId, status: "AVAILABLE", save: async () => {} };
    let allocationFilter;
    try {
        Room.findOne = () => room;
        Bed.exists = async () => null;
        Student.exists = async () => null;
        Allocation.exists = async (filter) => { allocationFilter = filter; return { _id: "allocation" }; };
        await assert.rejects(
            service.archive("rooms", { tenant: { hostelId: tenantId }, params: { id: roomId } }),
            { statusCode: 409 }
        );
        assert.equal(allocationFilter.hostelId, tenantId);
        assert.equal(String(allocationFilter.roomId), roomId);
    } finally {
        Room.findOne = originals.room;
        Bed.exists = originals.bedExists;
        Student.exists = originals.studentExists;
        Allocation.exists = originals.allocationExists;
    }
});

test("block, floor, and room archive are rejected while child resources exist", async () => {
    const scenarios = [
        { type: "blocks", parent: Block, child: Floor, id: blockId, field: "blockId" },
        { type: "floors", parent: Floor, child: Room, id: floorId, field: "floorId" },
        { type: "rooms", parent: Room, child: Bed, id: roomId, field: "roomId" }
    ];
    const originals = scenarios.map(({ parent, child }) => ({
        parent, child, findOne: parent.findOne, exists: child.exists
    }));
    try {
        for (const { type, parent, child, id, field } of scenarios) {
            const record = { _id: id, status: "AVAILABLE", save: async () => {} };
            parent.findOne = async () => record;
            child.exists = async (filter) => {
                assert.equal(filter.hostelId, tenantId);
                assert.equal(String(filter[field]), id);
                return { _id: "dependent" };
            };
            await assert.rejects(
                service.archive(type, { tenant: { hostelId: tenantId }, params: { id } }),
                { statusCode: 409 }
            );
        }
    } finally {
        for (const original of originals) {
            original.parent.findOne = original.findOne;
            original.child.exists = original.exists;
        }
    }
});

test("safe room archival soft-deletes without removing its record", async () => {
    const originals = { room: Room.findOne, bedExists: Bed.exists, studentExists: Student.exists, allocationExists: Allocation.exists, auditWrite: auditService.write };
    const room = { _id: roomId, status: "AVAILABLE", isDeleted: false, save: async () => {} };
    try {
        Room.findOne = async () => room;
        Bed.exists = async () => null;
        Student.exists = async () => null;
        Allocation.exists = async () => null;
        let auditEvent;
        auditService.write = async (req, event) => { auditEvent = event; };
        const result = await service.archive("rooms", { tenant: { hostelId: tenantId }, auth: { id: "64b64c1a1e2c3d4e5f607181", role: "OWNER" }, params: { id: roomId } });
        assert.equal(result.isDeleted, true);
        assert.equal(result.status, "MAINTENANCE");
        assert.equal(auditEvent.action, "ROOM_ARCHIVED");
        assert.equal(String(auditEvent.entityId), roomId);
    } finally {
        Room.findOne = originals.room;
        Bed.exists = originals.bedExists;
        Student.exists = originals.studentExists;
        Allocation.exists = originals.allocationExists;
        auditService.write = originals.auditWrite;
    }
});

test("occupied beds cannot be archived even if allocation records are inconsistent", async () => {
    const originalFind = Bed.findOne;
    try {
        Bed.findOne = async () => ({ _id: "64b64c1a1e2c3d4e5f607199", status: "OCCUPIED", save: async () => {} });
        await assert.rejects(
            service.archive("beds", { tenant: { hostelId: tenantId }, params: { id: "64b64c1a1e2c3d4e5f607199" } }),
            { statusCode: 409 }
        );
    } finally {
        Bed.findOne = originalFind;
    }
});
