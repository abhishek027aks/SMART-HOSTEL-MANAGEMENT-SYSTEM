const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");
const Student = require("../src/models/Student");
const Allocation = require("../src/models/Allocation");
const Block = require("../src/models/Block");
const Floor = require("../src/models/Floor");
const Room = require("../src/models/Room");
const Bed = require("../src/models/Bed");
const studentService = require("../src/services/studentService");
const allocationService = require("../src/services/allocationService");
const ROLES = require("../src/constants/roles");
const requireRoles = require("../src/middleware/roleMiddleware");

const hostelA = "64b64c1a1e2c3d4e5f607182";
const hostelB = "64b64c1a1e2c3d4e5f607183";
const studentId = "64b64c1a1e2c3d4e5f607184";
const roomId = "64b64c1a1e2c3d4e5f607185";
const bedId = "64b64c1a1e2c3d4e5f607186";

const query = (value) => ({ session() { return this; }, select() { return this; }, lean: async () => value, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });

test("student create validation requires a real identity and rejects unsafe fields", () => {
    assert.throws(() => studentService.validate({ name: "Resident" }), /studentId is required/);
    assert.throws(() => studentService.validate({ name: "Resident", studentId: "R-1", email: "bad" }), /valid email/);
    assert.throws(() => studentService.validate({ name: "Resident", studentId: "R-1", role: "OWNER" }), /Unsupported field/);
    assert.deepEqual(studentService.validate({ name: " Resident ", studentId: " R-1 ", email: "resident@example.com" }), { name: "Resident", studentId: "R-1", email: "resident@example.com" });
});

test("student update rejects a client-supplied foreign tenant", async () => {
    await assert.rejects(
        studentService.update({ tenant: { hostelId: hostelA }, params: { id: studentId }, body: { hostelId: hostelB, name: "Changed" } }),
        { statusCode: 403 }
    );
});

test("student archive is tenant-scoped and refuses active allocations", async () => {
    const originalStudentFind = Student.findOne;
    const originalAllocationExists = Allocation.exists;
    const student = { _id: studentId, bedId: null, status: "ACTIVE", isDeleted: false, save: async () => {} };
    let capturedFilter;
    try {
        Student.findOne = (filter) => { capturedFilter = filter; return query(student); };
        Allocation.exists = async (filter) => {
            assert.equal(filter.hostelId, hostelA);
            return null;
        };
        const archived = await studentService.archive({
            tenant: { hostelId: hostelA }, params: { id: studentId }
        });
        assert.equal(capturedFilter.hostelId, hostelA);
        assert.equal(archived.isDeleted, true);
        assert.equal(archived.status, "INACTIVE");

        student.isDeleted = false;
        student.status = "ACTIVE";
        Allocation.exists = async () => ({ _id: "active-allocation" });
        await assert.rejects(
            studentService.archive({ tenant: { hostelId: hostelA }, params: { id: studentId } }),
            { statusCode: 409 }
        );

        Student.findOne = (filter) => {
            assert.equal(filter.hostelId, hostelB);
            return query(null);
        };
        await assert.rejects(
            studentService.archive({ tenant: { hostelId: hostelB }, params: { id: studentId } }),
            { statusCode: 404 }
        );
    } finally {
        Student.findOne = originalStudentFind;
        Allocation.exists = originalAllocationExists;
    }
});

test("student restore only finds an archived record in the verified hostel", async () => {
    const originalFind = Student.findOne;
    const student = { _id: studentId, isDeleted: true, status: "INACTIVE", save: async () => {} };
    try {
        Student.findOne = (filter) => {
            assert.equal(filter.hostelId, hostelA);
            assert.equal(filter.isDeleted, true);
            return query(student);
        };
        const restored = await studentService.restore({
            tenant: { hostelId: hostelA }, params: { id: studentId }
        });
        assert.equal(restored.isDeleted, false);
    } finally {
        Student.findOne = originalFind;
    }
});

test("allocation validates IDs and disallows future allocation dates", async () => {
    assert.throws(() => allocationService.allocationDate("not-a-date"), { statusCode: 400 });
    assert.throws(() => allocationService.allocationDate(new Date(Date.now() + 86400000).toISOString()), { statusCode: 400 });
    await assert.rejects(allocationService.assign({ tenant: { hostelId: hostelA }, body: { studentId: "bad", roomId, bedId } }), { statusCode: 400 });
});

test("allocation ignores forged tenant context and derives scope from verified tenant", async () => {
    const originals = { student: Student.findOne, bed: Bed.findOne, sessions: mongoose.startSession };
    let studentFilter;
    let bedFilter;
    mongoose.startSession = async () => { throw new Error("A transaction must not start for a forged tenant request."); };
    try {
        await assert.rejects(
            allocationService.assign({ tenant: { hostelId: hostelA }, auth: { id: studentId }, body: { hostelId: hostelB, studentId, roomId, bedId } }),
            { statusCode: 403 }
        );
        Student.findOne = (filter) => { studentFilter = filter; return query(null); };
        Bed.findOne = (filter) => { bedFilter = filter; return query(null); };
        mongoose.startSession = async () => ({ withTransaction: async (callback) => callback({}), endSession: async () => {} });
        await assert.rejects(
            allocationService.assign({ tenant: { hostelId: hostelA }, auth: { id: studentId }, body: { studentId, roomId, bedId } }),
            { statusCode: 409 }
        );
        assert.equal(studentFilter.hostelId, hostelA);
        assert.equal(bedFilter, undefined);
    } finally {
        Student.findOne = originals.student;
        Bed.findOne = originals.bed;
        mongoose.startSession = originals.sessions;
    }
});

test("assignment updates the selected resident and bed in a tenant-scoped transaction", async () => {
    const blockId = "64b64c1a1e2c3d4e5f607187";
    const floorId = "64b64c1a1e2c3d4e5f607188";
    const student = { _id: studentId, name: "Resident", studentId: "R-1", save: async () => {} };
    const bed = { _id: bedId, roomId, bedNumber: "B-1", status: "AVAILABLE" };
    const room = { _id: roomId, blockId, floorId, roomNumber: "101", capacity: 2, status: "AVAILABLE", save: async () => {} };
    const allocationSaves = [];
    const filters = {};
    const originals = {
        studentFind: Student.findOne, bedFind: Bed.findOne, roomFind: Room.findOne,
        blockFind: Block.findOne, floorFind: Floor.findOne, bedCount: Bed.countDocuments,
        allocationCount: Allocation.countDocuments, bedUpdate: Bed.updateOne,
        allocationSave: Allocation.prototype.save, startSession: mongoose.startSession
    };
    let transactionEnded = false;
    let allocationCountCalls = 0;
    try {
        Student.findOne = (filter) => { filters.student = filter; return query(student); };
        Bed.findOne = (filter) => { filters.bed = filter; return query(bed); };
        Room.findOne = (filter) => { filters.room = filter; return query(room); };
        Block.findOne = (filter) => { filters.block = filter; return query({ _id: blockId }); };
        Floor.findOne = (filter) => { filters.floor = filter; return query({ _id: floorId, blockId }); };
        Bed.countDocuments = () => query(2);
        Allocation.countDocuments = () => query(allocationCountCalls++ === 0 ? 0 : 1);
        Bed.updateOne = async (filter, update) => {
            filters.bedUpdate = filter;
            assert.equal(update.$set.status, "OCCUPIED");
            return { modifiedCount: 1 };
        };
        Allocation.prototype.save = async function () { allocationSaves.push(this); };
        mongoose.startSession = async () => ({
            withTransaction: async (operation) => operation({}),
            endSession: async () => { transactionEnded = true; }
        });

        const result = await allocationService.assign({
            tenant: { hostelId: hostelA },
            auth: { id: "64b64c1a1e2c3d4e5f607189" },
            body: { studentId, roomId, bedId }
        });

        assert.equal(filters.student.hostelId, hostelA);
        assert.equal(filters.bed.hostelId, hostelA);
        assert.equal(filters.room.hostelId, hostelA);
        assert.equal(filters.block.hostelId, hostelA);
        assert.equal(filters.floor.hostelId, hostelA);
        assert.equal(filters.bedUpdate.hostelId, hostelA);
        assert.equal(student.bedId.toString(), bedId);
        assert.equal(student.roomId.toString(), roomId);
        assert.equal(allocationSaves.length, 1);
        assert.equal(allocationSaves[0].status, "ACTIVE");
        assert.equal(allocationSaves[0].hostelId.toString(), hostelA);
        assert.equal(result.bed.bedNumber, "B-1");
        assert.equal(room.status, "OCCUPIED");
        assert.equal(transactionEnded, true);
    } finally {
        Student.findOne = originals.studentFind;
        Bed.findOne = originals.bedFind;
        Room.findOne = originals.roomFind;
        Block.findOne = originals.blockFind;
        Floor.findOne = originals.floorFind;
        Bed.countDocuments = originals.bedCount;
        Allocation.countDocuments = originals.allocationCount;
        Bed.updateOne = originals.bedUpdate;
        Allocation.prototype.save = originals.allocationSave;
        mongoose.startSession = originals.startSession;
    }
});

test("release clears the resident, frees the bed, and retains released allocation history", async () => {
    const student = { _id: studentId, bedId, roomId, blockId: "64b64c1a1e2c3d4e5f607187", floorId: "64b64c1a1e2c3d4e5f607188", save: async () => {} };
    const bed = { _id: bedId, status: "OCCUPIED", save: async () => {} };
    const room = { _id: roomId, status: "OCCUPIED", save: async () => {} };
    const allocation = { _id: "64b64c1a1e2c3d4e5f607190", hostelId: hostelA, studentId, bedId, roomId, status: "ACTIVE", save: async () => {} };
    const originals = {
        allocationFind: Allocation.findOne, studentFind: Student.findOne, bedFind: Bed.findOne,
        roomFind: Room.findOne, allocationCount: Allocation.countDocuments, startSession: mongoose.startSession
    };
    let transactionEnded = false;
    try {
        Allocation.findOne = (filter) => {
            assert.equal(filter.hostelId, hostelA);
            assert.equal(filter.status, "ACTIVE");
            return query(allocation);
        };
        Student.findOne = (filter) => { assert.equal(filter.hostelId, hostelA); return query(student); };
        Bed.findOne = (filter) => { assert.equal(filter.hostelId, hostelA); return query(bed); };
        Room.findOne = (filter) => { assert.equal(filter.hostelId, hostelA); return query(room); };
        Allocation.countDocuments = () => query(0);
        mongoose.startSession = async () => ({
            withTransaction: async (operation) => operation({}),
            endSession: async () => { transactionEnded = true; }
        });

        const result = await allocationService.release({
            tenant: { hostelId: hostelA },
            auth: { id: "64b64c1a1e2c3d4e5f607189" },
            params: { id: allocation._id }
        });

        assert.equal(student.bedId, null);
        assert.equal(student.roomId, null);
        assert.equal(bed.status, "AVAILABLE");
        assert.equal(allocation.status, "RELEASED");
        assert.ok(allocation.releasedAt instanceof Date);
        assert.equal(allocation.releasedBy, "64b64c1a1e2c3d4e5f607189");
        assert.equal(result.released, true);
        assert.equal(room.status, "AVAILABLE");
        assert.equal(transactionEnded, true);
    } finally {
        Allocation.findOne = originals.allocationFind;
        Student.findOne = originals.studentFind;
        Bed.findOne = originals.bedFind;
        Room.findOne = originals.roomFind;
        Allocation.countDocuments = originals.allocationCount;
        mongoose.startSession = originals.startSession;
    }
});

test("transfer preserves the prior allocation and creates a linked active allocation", async () => {
    const newRoomId = "64b64c1a1e2c3d4e5f607191";
    const newBedId = "64b64c1a1e2c3d4e5f607192";
    const blockId = "64b64c1a1e2c3d4e5f607187";
    const floorId = "64b64c1a1e2c3d4e5f607188";
    const student = { _id: studentId, name: "Resident", studentId: "R-1", bedId, save: async () => {} };
    const oldBed = { _id: bedId, roomId, bedNumber: "B-1", status: "OCCUPIED", save: async () => {} };
    const newBed = { _id: newBedId, roomId: newRoomId, bedNumber: "B-2", status: "AVAILABLE", save: async () => {} };
    const oldRoom = { _id: roomId, status: "OCCUPIED", save: async () => {} };
    const newRoom = { _id: newRoomId, blockId, floorId, roomNumber: "102", capacity: 2, status: "AVAILABLE", save: async () => {} };
    const previous = { _id: "64b64c1a1e2c3d4e5f607190", hostelId: hostelA, studentId, bedId, roomId, status: "ACTIVE", save: async () => {} };
    const allocationSaves = [];
    const originals = {
        allocationFind: Allocation.findOne, studentFind: Student.findOne, bedFind: Bed.findOne,
        roomFind: Room.findOne, blockFind: Block.findOne, floorFind: Floor.findOne,
        bedCount: Bed.countDocuments, allocationCount: Allocation.countDocuments,
        allocationSave: Allocation.prototype.save, startSession: mongoose.startSession
    };
    let allocationCountCalls = 0;
    try {
        Allocation.findOne = (filter) => { assert.equal(filter.hostelId, hostelA); return query(previous); };
        Student.findOne = (filter) => { assert.equal(filter.hostelId, hostelA); return query(student); };
        Bed.findOne = (filter) => query(String(filter._id) === bedId ? oldBed : newBed);
        Room.findOne = (filter) => query(String(filter._id) === roomId ? oldRoom : newRoom);
        Block.findOne = (filter) => { assert.equal(filter.hostelId, hostelA); return query({ _id: blockId }); };
        Floor.findOne = (filter) => { assert.equal(filter.hostelId, hostelA); return query({ _id: floorId, blockId }); };
        Bed.countDocuments = () => query(1);
        Allocation.countDocuments = () => query([0, 0, 1][allocationCountCalls++] || 0);
        Allocation.prototype.save = async function () { allocationSaves.push(this); };
        mongoose.startSession = async () => ({ withTransaction: async (operation) => operation({}), endSession: async () => {} });

        const result = await allocationService.transfer({
            tenant: { hostelId: hostelA },
            auth: { id: "64b64c1a1e2c3d4e5f607189" },
            params: { id: previous._id },
            body: { roomId: newRoomId, bedId: newBedId }
        });

        assert.equal(previous.status, "RELEASED");
        assert.equal(oldBed.status, "AVAILABLE");
        assert.equal(newBed.status, "OCCUPIED");
        assert.equal(student.bedId.toString(), newBedId);
        assert.equal(allocationSaves.length, 1);
        assert.equal(allocationSaves[0].status, "ACTIVE");
        assert.equal(allocationSaves[0].transferFrom.toString(), previous._id);
        assert.equal(result.room.roomNumber, "102");
        assert.equal(oldRoom.status, "AVAILABLE");
        assert.equal(newRoom.status, "OCCUPIED");
    } finally {
        Allocation.findOne = originals.allocationFind;
        Student.findOne = originals.studentFind;
        Bed.findOne = originals.bedFind;
        Room.findOne = originals.roomFind;
        Block.findOne = originals.blockFind;
        Floor.findOne = originals.floorFind;
        Bed.countDocuments = originals.bedCount;
        Allocation.countDocuments = originals.allocationCount;
        Allocation.prototype.save = originals.allocationSave;
        mongoose.startSession = originals.startSession;
    }
});

test("allocation hierarchy rejects foreign beds and pins room/block/floor to tenant", async () => {
    const originals = { room: Room.findOne, block: Block.findOne, floor: Floor.findOne, count: Bed.countDocuments };
    const filters = [];
    try {
        Room.findOne = (filter) => { filters.push(filter); return query(null); };
        await assert.rejects(allocationService.verifyHierarchy(hostelA, { roomId }, roomId, {}), { statusCode: 404 });
        assert.equal(filters[0].hostelId, hostelA);
        assert.notEqual(filters[0].hostelId, hostelB);
    } finally {
        Room.findOne = originals.room;
        Block.findOne = originals.block;
        Floor.findOne = originals.floor;
        Bed.countDocuments = originals.count;
    }
});

test("reserved or maintenance rooms cannot be used for allocation", async () => {
    const originals = { room: Room.findOne, bed: Bed.find };
    try {
        for (const status of ["RESERVED", "MAINTENANCE"]) {
            Room.findOne = () => query({ _id: roomId, capacity: 4, status });
            await assert.rejects(
                allocationService.verifyHierarchy(hostelA, { roomId }, roomId, {}),
                { statusCode: 409 }
            );
            await assert.rejects(
                allocationService.listAvailableBeds({ tenant: { hostelId: hostelA }, query: { roomId } }),
                { statusCode: 409 }
            );
        }
    } finally {
        Room.findOne = originals.room;
        Bed.find = originals.bed;
    }
});

test("allocation history is tenant-owned and prevents multiple active student or bed assignments", () => {
    assert.equal(Allocation.schema.path("hostelId").isRequired, true);
    assert.equal(Allocation.schema.path("studentId").isRequired, true);
    assert.equal(Allocation.schema.path("bedId").isRequired, true);
    assert.equal(Allocation.schema.path("allocationDate").isRequired, true);
    assert.equal(Allocation.schema.path("status").enumValues.includes("RELEASED"), true);
    const indexes = Allocation.schema.indexes();
    assert.ok(indexes.some(([keys, options]) => keys.studentId === 1 && options.unique && options.partialFilterExpression.status === "ACTIVE"));
    assert.ok(indexes.some(([keys, options]) => keys.bedId === 1 && options.unique && options.partialFilterExpression.status === "ACTIVE"));
});

test("allocation roles exclude guards, students, and parents", () => {
    const middleware = requireRoles(ROLES.SYSTEM_ADMIN, ROLES.OWNER, ROLES.WARDEN);
    for (const role of [ROLES.GUARD, ROLES.STUDENT, ROLES.PARENT]) {
        const res = { statusCode: null, status(code) { this.statusCode = code; return this; }, json() { return this; } };
        middleware({ auth: { role } }, res, () => {});
        assert.equal(res.statusCode, 403, `${role} must not allocate beds`);
    }
});
