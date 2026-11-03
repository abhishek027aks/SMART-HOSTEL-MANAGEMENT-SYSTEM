const assert = require("node:assert/strict");
const test = require("node:test");

const Hostel = require("../src/models/Hostel");
const Block = require("../src/models/Block");
const Floor = require("../src/models/Floor");
const Room = require("../src/models/Room");
const Bed = require("../src/models/Bed");
const Student = require("../src/models/Student");
const Allocation = require("../src/models/Allocation");
const ROLES = require("../src/constants/roles");
const requireRoles = require("../src/middleware/roleMiddleware");
const controller = require("../src/controllers/hostelController");
const auditService = require("../src/services/auditService");

const hostelId = "64b64c1a1e2c3d4e5f607182";
const response = () => ({
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
});

test("hostel archive is restricted to system administrators", () => {
    const middleware = requireRoles(ROLES.SYSTEM_ADMIN);
    const res = response();
    middleware({ auth: { role: ROLES.OWNER } }, res, () => {});
    assert.equal(res.statusCode, 403);
});

test("hostel archive is blocked while active tenant resources exist", async () => {
    const originals = [Hostel, Block, Floor, Room, Bed, Student, Allocation].map((model) => ({
        model, findOne: model.findOne, exists: model.exists
    }));
    const hostel = {
        _id: hostelId, status: "ACTIVE", isDeleted: false, accessCode: "secret", ownerId: "owner",
        toObject() { return { _id: this._id, status: this.status, isDeleted: this.isDeleted, accessCode: this.accessCode, ownerId: this.ownerId }; },
        save: async () => {}
    };
    try {
        Hostel.findOne = async () => hostel;
        for (const model of [Block, Floor, Room, Bed, Student, Allocation]) model.exists = async () => null;
        Room.exists = async (filter) => {
            assert.equal(String(filter.hostelId), hostelId);
            return { _id: "active-room" };
        };
        const res = response();
        await controller.archiveById({ params: { id: hostelId } }, res, (error) => { throw error; });
        assert.equal(res.statusCode, 409);
        assert.match(res.payload.message, /active students, allocations, blocks, floors, rooms, and beds/);
        assert.equal(hostel.isDeleted, false);
    } finally {
        for (const original of originals) {
            original.model.findOne = original.findOne;
            original.model.exists = original.exists;
        }
    }
});

test("hostel with no active resources is soft-archived and can be restored", async () => {
    const originals = [Hostel, Block, Floor, Room, Bed, Student, Allocation].map((model) => ({
        model, findOne: model.findOne, exists: model.exists
    }));
    const hostel = {
        _id: hostelId, status: "ACTIVE", isDeleted: false, accessCode: "secret", ownerId: "owner",
        toObject() { return { _id: this._id, status: this.status, isDeleted: this.isDeleted, accessCode: this.accessCode, ownerId: this.ownerId }; },
        save: async () => {}
    };
    try {
        Hostel.findOne = async (filter) => {
            if (filter.isDeleted === true) return hostel.isDeleted ? hostel : null;
            return hostel.isDeleted ? null : hostel;
        };
        for (const model of [Block, Floor, Room, Bed, Student, Allocation]) model.exists = async () => null;
        const archiveResponse = response();
        await controller.archiveById({ params: { id: hostelId } }, archiveResponse, (error) => { throw error; });
        assert.equal(archiveResponse.statusCode, 200);
        assert.equal(hostel.isDeleted, true);
        assert.equal(hostel.status, "INACTIVE");
        assert.equal("accessCode" in archiveResponse.payload.data, false);
        assert.equal("ownerId" in archiveResponse.payload.data, false);

        const restoreResponse = response();
        await controller.restoreById({ params: { id: hostelId } }, restoreResponse, (error) => { throw error; });
        assert.equal(restoreResponse.statusCode, 200);
        assert.equal(hostel.isDeleted, false);
        assert.equal(hostel.status, "ACTIVE");
        assert.equal("accessCode" in restoreResponse.payload.data, false);
    } finally {
        for (const original of originals) {
            original.model.findOne = original.findOne;
            original.model.exists = original.exists;
        }
    }
});

test("owner access-code rotation is tenant-scoped, generated server-side, and audited", async () => {
    const originalFindOne = Hostel.findOne;
    const originalExists = Hostel.exists;
    const originalWrite = auditService.write;
    let auditEntry;
    const hostel = { _id: hostelId, hostelCode: "HST-001", accessCode: "OLD-CODE", save: async () => {} };
    try {
        Hostel.findOne = (filter) => {
            assert.equal(String(filter.hostelId), hostelId);
            return hostel;
        };
        Hostel.exists = async () => null;
        auditService.write = async (_req, entry) => { auditEntry = entry; };
        const res = response();
        await controller.rotateAccessCode({ tenant: { hostelId }, auth: { id: "owner", role: ROLES.OWNER } }, res, (error) => { throw error; });
        assert.equal(res.statusCode, 200);
        assert.match(res.payload.data.accessCode, /^HAC-[A-F0-9]{10}$/);
        assert.notEqual(res.payload.data.accessCode, "OLD-CODE");
        assert.equal(auditEntry.action, "HOSTEL_ACCESS_CODE_ROTATED");
    } finally {
        Hostel.findOne = originalFindOne;
        Hostel.exists = originalExists;
        auditService.write = originalWrite;
    }
});
