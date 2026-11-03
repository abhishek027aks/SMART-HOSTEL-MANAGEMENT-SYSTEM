const mongoose = require("mongoose");
const Student = require("../models/Student");
const Block = require("../models/Block");
const Floor = require("../models/Floor");
const Room = require("../models/Room");
const Bed = require("../models/Bed");
const Allocation = require("../models/Allocation");
const hostelScope = require("../utils/hostelScope");
const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const validId = mongoose.isValidObjectId;

const allocationDate = (value) => {
    if (value === undefined || value === "") return new Date();
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || date.getTime() > Date.now()) throw httpError(400, "allocationDate must be a valid date that is not in the future.");
    return date;
};
const identifier = (value, field) => {
    if (typeof value !== "string" || !validId(value)) throw httpError(400, `${field} must be a valid identifier.`);
    return value;
};
const activeRecord = { isDeleted: { $ne: true } };

const syncRoomStatus = async (session, hostelId, roomId) => {
    const [room, occupied] = await Promise.all([
        Room.findOne({ _id: roomId, hostelId, ...activeRecord }).session(session),
        Allocation.countDocuments({ hostelId, roomId, status: "ACTIVE" }).session(session)
    ]);
    if (room && !["MAINTENANCE", "RESERVED"].includes(room.status)) {
        room.status = occupied > 0 ? "OCCUPIED" : "AVAILABLE";
        await room.save({ session });
    }
};

const options = async (req) => {
    const hostelId = req.tenant.hostelId;
    const [blocks, floors, rooms, beds] = await Promise.all([
        Block.find({ hostelId, ...activeRecord, status: "ACTIVE" }).select("name").sort({ name: 1 }).lean(),
        Floor.find({ hostelId, ...activeRecord, status: "ACTIVE" }).select("name number blockId").sort({ number: 1 }).lean(),
        Room.find({ hostelId, ...activeRecord }).select("roomNumber roomType capacity status blockId floorId").sort({ roomNumber: 1 }).lean(),
        Bed.find({ hostelId, ...activeRecord, status: "AVAILABLE" }).select("bedNumber roomId status").sort({ bedNumber: 1 }).lean()
    ]);
    return { blocks, floors, rooms, availableBeds: beds };
};

const list = async (req) => {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 25);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw httpError(400, "Invalid pagination parameters.");
    const filter = hostelScope(req, { ...activeRecord, status: "ACTIVE" });
    const [items, total] = await Promise.all([
        Allocation.find(filter).populate("studentId", "name studentId mobile").populate({ path: "bedId", select: "bedNumber roomId", populate: { path: "roomId", select: "roomNumber roomType" } }).sort({ allocationDate: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        Allocation.countDocuments(filter)
    ]);
    return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

const listAvailableBeds = async (req) => {
    const roomId = identifier(req.query.roomId, "roomId");
    const room = await Room.findOne(hostelScope(req, { _id: roomId, ...activeRecord })).select("_id capacity status").lean();
    if (!room) throw httpError(404, "Room not found in this hostel.");
    if (["MAINTENANCE", "RESERVED"].includes(room.status)) throw httpError(409, "This room is not available for allocation.");
    return Bed.find(hostelScope(req, { roomId, status: "AVAILABLE", ...activeRecord })).select("bedNumber roomId status").sort({ bedNumber: 1 }).lean();
};

const verifyHierarchy = async (hostelId, bed, requestedRoomId, session) => {
    const room = await Room.findOne({ _id: requestedRoomId, hostelId, ...activeRecord }).session(session).lean();
    if (!room || String(bed.roomId) !== String(room._id)) throw httpError(404, "Bed does not belong to the selected room in this hostel.");
    if (["MAINTENANCE", "RESERVED"].includes(room.status)) throw httpError(409, "Cannot allocate a bed in a room that is under maintenance or reserved.");
    const [block, floor] = await Promise.all([
        Block.findOne({ _id: room.blockId, hostelId, ...activeRecord, status: "ACTIVE" }).session(session).select("_id").lean(),
        Floor.findOne({ _id: room.floorId, hostelId, ...activeRecord, status: "ACTIVE" }).session(session).select("_id blockId").lean()
    ]);
    if (!block || !floor || String(floor.blockId) !== String(room.blockId)) throw httpError(409, "Room hierarchy is inactive or inconsistent.");
    const bedCount = await Bed.countDocuments({ hostelId, roomId: room._id, ...activeRecord }).session(session);
    if (bedCount > room.capacity) throw httpError(409, "The room exceeds its configured bed capacity. Correct the room inventory before allocation.");
    return room;
};

const withTransaction = async (operation) => {
    const session = await mongoose.startSession();
    try { return await session.withTransaction(() => operation(session)); }
    catch (error) {
        if (error.statusCode) throw error;
        if (error.code === 11000 || error.code === 112 || error.codeName === "WriteConflict") throw httpError(409, "The student or bed was changed by another request. Refresh and try again.");
        throw error;
    } finally { await session.endSession(); }
};

const assign = async (req) => {
    const studentId = identifier(req.body?.studentId, "studentId");
    const bedId = identifier(req.body?.bedId, "bedId");
    const roomId = identifier(req.body?.roomId, "roomId");
    if (req.body?.hostelId && String(req.body.hostelId) !== req.tenant.hostelId) throw httpError(403, "The requested hostel does not match your verified hostel context.");
    const allocatedOn = allocationDate(req.body?.allocationDate);
    return withTransaction(async (session) => {
        const hostelId = req.tenant.hostelId;
        const student = await Student.findOne({ _id: studentId, hostelId, status: "ACTIVE", bedId: null, ...activeRecord }).session(session);
        if (!student) throw httpError(409, "Student is unavailable in this hostel or already has an active bed.");
        const bed = await Bed.findOne({ _id: bedId, hostelId, roomId, status: "AVAILABLE", ...activeRecord }).session(session);
        if (!bed) throw httpError(409, "Bed is unavailable or does not belong to the selected room and hostel.");
        const room = await verifyHierarchy(hostelId, bed, roomId, session);
        const occupancy = await Allocation.countDocuments({ hostelId, roomId, status: "ACTIVE" }).session(session);
        if (occupancy >= room.capacity) throw httpError(409, "Room capacity has been reached.");
        const changedBed = await Bed.updateOne({ _id: bed._id, hostelId, status: "AVAILABLE", ...activeRecord }, { $set: { status: "OCCUPIED" } }, { session });
        if (changedBed.modifiedCount !== 1) throw httpError(409, "Bed is no longer available. Refresh and try again.");
        student.blockId = room.blockId;
        student.floorId = room.floorId;
        student.roomId = room._id;
        student.bedId = bed._id;
        await student.save({ session });
        const allocation = new Allocation({ hostelId, studentId: student._id, bedId: bed._id, roomId: room._id, allocatedBy: req.auth.id, allocationDate: allocatedOn, status: "ACTIVE" });
        await allocation.save({ session });
        await syncRoomStatus(session, hostelId, room._id);
        return { allocation: allocation.toObject(), student: { id: String(student._id), name: student.name, studentId: student.studentId }, room: { id: String(room._id), roomNumber: room.roomNumber }, bed: { id: String(bed._id), bedNumber: bed.bedNumber } };
    });
};

const findActiveAllocation = async (id, req, session) => {
    if (!validId(id)) throw httpError(400, "Invalid allocation identifier.");
    const allocation = await Allocation.findOne(hostelScope(req, { _id: id, status: "ACTIVE" })).session(session);
    if (!allocation) throw httpError(404, "Active allocation not found.");
    return allocation;
};

const release = async (req) => withTransaction(async (session) => {
    const allocation = await findActiveAllocation(req.params.id, req, session);
    const now = new Date();
    const student = await Student.findOne({ _id: allocation.studentId, hostelId: req.tenant.hostelId, bedId: allocation.bedId, ...activeRecord }).session(session);
    const bed = await Bed.findOne({ _id: allocation.bedId, hostelId: req.tenant.hostelId, status: "OCCUPIED", ...activeRecord }).session(session);
    if (!student || !bed) throw httpError(409, "Student and bed allocation state is inconsistent; no records were changed.");
    student.blockId = null; student.floorId = null; student.roomId = null; student.bedId = null;
    bed.status = "AVAILABLE";
    allocation.status = "RELEASED"; allocation.releasedAt = now; allocation.releasedBy = req.auth.id;
    await Promise.all([student.save({ session }), bed.save({ session }), allocation.save({ session })]);
    await syncRoomStatus(session, req.tenant.hostelId, allocation.roomId);
    return { released: true, studentId: String(student._id), bedId: String(bed._id), releasedAt: now };
});

const transfer = async (req) => {
    const bedId = identifier(req.body?.bedId, "bedId");
    const roomId = identifier(req.body?.roomId, "roomId");
    return withTransaction(async (session) => {
        const previous = await findActiveAllocation(req.params.id, req, session);
        if (String(previous.bedId) === bedId) throw httpError(400, "Select a different destination bed.");
        const student = await Student.findOne({ _id: previous.studentId, hostelId: req.tenant.hostelId, bedId: previous.bedId, status: "ACTIVE", ...activeRecord }).session(session);
        const oldBed = await Bed.findOne({ _id: previous.bedId, hostelId: req.tenant.hostelId, status: "OCCUPIED", ...activeRecord }).session(session);
        const newBed = await Bed.findOne({ _id: bedId, roomId, hostelId: req.tenant.hostelId, status: "AVAILABLE", ...activeRecord }).session(session);
        if (!student || !oldBed) throw httpError(409, "Current student and bed allocation state is inconsistent.");
        if (!newBed) throw httpError(409, "Destination bed is unavailable or outside this hostel.");
        const room = await verifyHierarchy(req.tenant.hostelId, newBed, roomId, session);
        const occupancy = await Allocation.countDocuments({ hostelId: req.tenant.hostelId, roomId, status: "ACTIVE" }).session(session);
        if (String(previous.roomId) !== roomId && occupancy >= room.capacity) throw httpError(409, "Destination room capacity has been reached.");
        const now = new Date();
        oldBed.status = "AVAILABLE"; newBed.status = "OCCUPIED";
        previous.status = "RELEASED"; previous.releasedAt = now; previous.releasedBy = req.auth.id;
        student.blockId = room.blockId; student.floorId = room.floorId; student.roomId = room._id; student.bedId = newBed._id;
        const nextAllocation = new Allocation({ hostelId: req.tenant.hostelId, studentId: student._id, bedId: newBed._id, roomId: room._id, allocatedBy: req.auth.id, allocationDate: now, status: "ACTIVE", transferFrom: previous._id });
        await Promise.all([oldBed.save({ session }), newBed.save({ session }), previous.save({ session }), student.save({ session }), nextAllocation.save({ session })]);
        await syncRoomStatus(session, req.tenant.hostelId, previous.roomId);
        await syncRoomStatus(session, req.tenant.hostelId, room._id);
        return { allocation: nextAllocation.toObject(), student: { id: String(student._id), name: student.name, studentId: student.studentId }, room: { id: String(room._id), roomNumber: room.roomNumber }, bed: { id: String(newBed._id), bedNumber: newBed.bedNumber } };
    });
};

module.exports = { assign, httpError, list, listAvailableBeds, options, release, transfer, allocationDate, verifyHierarchy };



