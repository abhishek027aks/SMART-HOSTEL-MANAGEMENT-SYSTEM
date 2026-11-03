const mongoose = require("mongoose");

const Block = require("../models/Block");
const Floor = require("../models/Floor");
const Room = require("../models/Room");
const Bed = require("../models/Bed");
const Student = require("../models/Student");
const Allocation = require("../models/Allocation");
const hostelScope = require("../utils/hostelScope");
const auditService = require("./auditService");

const ACTIVE = { isDeleted: { $ne: true } };
const CONFIG = Object.freeze({
    blocks: { model: Block, fields: ["name"], search: ["name"], status: ["ACTIVE", "INACTIVE", "MAINTENANCE"] },
    floors: { model: Floor, fields: ["blockId", "number", "name"], search: ["name"], status: ["ACTIVE", "INACTIVE", "MAINTENANCE"] },
    rooms: { model: Room, fields: ["blockId", "floorId", "roomNumber", "roomType", "airConditioning", "customRoomDescription", "capacity", "status"], search: ["roomNumber", "roomType", "customRoomDescription"], status: ["AVAILABLE", "OCCUPIED", "RESERVED", "MAINTENANCE"] },
    beds: { model: Bed, fields: ["roomId", "bedNumber", "status"], search: ["bedNumber"], status: ["AVAILABLE", "OCCUPIED", "RESERVED", "MAINTENANCE"] }
});

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const validId = (value) => mongoose.isValidObjectId(value);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getConfig = (type) => {
    const config = CONFIG[type];
    if (!config) throw httpError(404, "Facility resource not found.");
    return config;
};

const validatePayload = (type, body, { partial = false } = {}) => {
    const config = getConfig(type);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw httpError(400, "A JSON object is required.");
    }
    const unknown = Object.keys(body).filter((key) => key !== "hostelId" && !config.fields.includes(key));
    if (unknown.length) throw httpError(400, `Unsupported field: ${unknown[0]}.`);
    const result = {};
    const required = type === "blocks" ? ["name"] : type === "floors" ? ["blockId", "number"] : type === "rooms" ? ["floorId", "roomNumber", "capacity"] : ["roomId", "bedNumber"];

    for (const field of config.fields) {
        if (!Object.hasOwn(body, field)) continue;
        const value = body[field];
        if (["blockId", "floorId", "roomId"].includes(field)) {
            if (typeof value !== "string" || !validId(value)) throw httpError(400, `${field} must be a valid identifier.`);
            result[field] = value;
        } else if (["name", "roomNumber", "bedNumber", "roomType", "customRoomDescription"].includes(field)) {
            const max = field === "roomType" ? 64 : field === "customRoomDescription" ? 300 : 128;
            if (typeof value !== "string" || (field !== "customRoomDescription" && !value.trim()) || value.trim().length > max) {
                throw httpError(400, `${field} must be a non-empty string of at most ${max} characters.`);
            }
            result[field] = value.trim();
        } else if (field === "airConditioning") {
            if (!["AC", "NON_AC"].includes(value)) throw httpError(400, "airConditioning must be AC or NON_AC.");
            result[field] = value;
        } else if (field === "number") {
            if (!Number.isInteger(value) || value < -10 || value > 1000) throw httpError(400, "number must be an integer between -10 and 1000.");
            result[field] = value;
        } else if (field === "capacity") {
            if (!Number.isInteger(value) || value < 1 || value > 500) throw httpError(400, "capacity must be an integer between 1 and 500.");
            result[field] = value;
        } else if (field === "status") {
            if (!config.status.includes(value)) throw httpError(400, `status must be one of: ${config.status.join(", ")}.`);
            if (value === "OCCUPIED") throw httpError(400, "Occupancy can only be changed by the allocation workflow.");
            result[field] = value;
        }
    }
    if (!partial) {
        const missing = required.find((field) => !Object.hasOwn(result, field));
        if (missing) throw httpError(400, `${missing} is required.`);
    } else if (!Object.keys(result).length) {
        throw httpError(400, "Provide at least one supported field to update.");
    }
    if (type === "rooms" && result.roomType === "Other" && !result.customRoomDescription && !partial) {
        throw httpError(400, "Describe the custom room when roomType is Other.");
    }
    return result;
};

const findParent = async (Model, id, hostelId, label) => {
    const filter = { _id: id, hostelId, ...ACTIVE };
    if (Model === Block || Model === Floor) filter.status = "ACTIVE";
    const parent = await Model.findOne(filter).select("_id blockId floorId capacity status").lean();
    if (!parent) throw httpError(404, `${label} was not found in this hostel.`);
    return parent;
};

const validateParents = async (type, values, hostelId, existing = {}) => {
    if (type === "floors" && values.blockId) {
        await findParent(Block, values.blockId, hostelId, "Block");
    }
    if (type === "rooms") {
        const floorId = values.floorId || existing.floorId;
        let blockId = values.blockId || existing.blockId;
        if (floorId) {
            const floor = await findParent(Floor, floorId, hostelId, "Floor");
            blockId = blockId || String(floor.blockId);
            if (String(floor.blockId) !== String(blockId)) throw httpError(400, "The selected floor does not belong to the selected block.");
        }
        if (blockId) await findParent(Block, blockId, hostelId, "Block");
        if (values.capacity !== undefined && existing._id) {
            const bedCount = await Bed.countDocuments({ hostelId, roomId: existing._id, ...ACTIVE });
            if (bedCount > values.capacity) throw httpError(409, "Room capacity cannot be lower than its existing bed count.");
        }
        if (existing._id && ["MAINTENANCE", "RESERVED"].includes(values.status) && values.status !== existing.status) {
            const [activeAllocation, occupiedBed] = await Promise.all([
                Allocation.exists({ hostelId, roomId: existing._id, status: "ACTIVE" }),
                Bed.exists({ hostelId, roomId: existing._id, status: "OCCUPIED", ...ACTIVE })
            ]);
            if (activeAllocation || occupiedBed) throw httpError(409, "Release all active bed allocations before reserving or placing this room under maintenance.");
        }
        if (values.floorId || values.blockId) {
            values.floorId = floorId;
            values.blockId = blockId;
        }
    }
    if (type === "beds") {
        const roomId = values.roomId || existing.roomId;
        if (roomId) {
            const room = await findParent(Room, roomId, hostelId, "Room");
            if (room.status === "MAINTENANCE") throw httpError(409, "Beds cannot be managed in a maintenance room.");
            const currentRoomId = existing.roomId ? String(existing.roomId) : null;
            if (existing._id && (values.status !== undefined && values.status !== existing.status || values.roomId !== undefined && currentRoomId !== String(values.roomId))) {
                const activeAllocation = await Allocation.exists({ hostelId, bedId: existing._id, status: "ACTIVE" });
                if (activeAllocation) throw httpError(409, "Release this bed before changing its room or status.");
            }
            if (!currentRoomId || currentRoomId !== String(roomId)) {
                const bedCount = await Bed.countDocuments({ hostelId, roomId, ...ACTIVE });
                if (bedCount >= room.capacity) throw httpError(409, "Room capacity is already reached.");
            }
        }
    }
};

const list = async (type, req) => {
    const config = getConfig(type);
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 25);
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100 || q.length > 100) {
        throw httpError(400, "Invalid pagination or search parameters.");
    }
    const filter = hostelScope(req, { ...ACTIVE });
    if (req.query.status !== undefined) {
        if (!config.status.includes(req.query.status)) throw httpError(400, "Invalid status filter.");
        filter.status = req.query.status;
    }
    if (q) filter.$or = config.search.map((field) => ({ [field]: { $regex: escapeRegex(q), $options: "i" } }));
    let [items, total] = await Promise.all([
        config.model.find(filter).sort({ createdAt: -1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
        config.model.countDocuments(filter)
    ]);
    if (type === "rooms" && items.length) {
        const roomIds = items.map((room) => room._id);
        const grouped = await Bed.aggregate([
            { $match: { hostelId: req.tenant.hostelId, roomId: { $in: roomIds }, ...ACTIVE } },
            { $group: { _id: { roomId: "$roomId", status: "$status" }, count: { $sum: 1 } } }
        ]);
        const countsByRoom = new Map();
        for (const entry of grouped) {
            const key = String(entry._id.roomId);
            countsByRoom.set(key, { ...(countsByRoom.get(key) || {}), [entry._id.status.toLowerCase()]: entry.count });
        }
        items = items.map((room) => {
            const counts = countsByRoom.get(String(room._id)) || {};
            const occupiedBeds = counts.occupied || 0;
            return {
                ...room,
                occupiedBeds,
                availableBeds: counts.available || 0,
                reservedBeds: counts.reserved || 0,
                maintenanceBeds: counts.maintenance || 0,
                occupancyPercent: room.capacity ? Math.round(occupiedBeds / room.capacity * 100) : 0
            };
        });
    }
    if (type === "beds" && items.length) {
        const bedIds = items.map((bed) => bed._id);
        const allocations = await Allocation.find({ hostelId: req.tenant.hostelId, bedId: { $in: bedIds }, status: "ACTIVE" })
            .select("bedId studentId allocationDate")
            .populate("studentId", "name studentId")
            .lean();
        const allocationsByBed = new Map(allocations.map((allocation) => [String(allocation.bedId), allocation]));
        const roomsById = new Map((await Room.find({ hostelId: req.tenant.hostelId, _id: { $in: [...new Set(items.map((bed) => String(bed.roomId)))] } }).select("roomNumber").lean()).map((room) => [String(room._id), room]));
        items = items.map((bed) => {
            const allocation = allocationsByBed.get(String(bed._id));
            return { ...bed, room: roomsById.get(String(bed.roomId)) || null, student: allocation?.studentId || null, allocationDate: allocation?.allocationDate || null, allocationId: allocation?._id || null };
        });
    }
    return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

const get = async (type, req) => {
    const config = getConfig(type);
    if (!validId(req.params.id)) throw httpError(400, "Invalid resource identifier.");
    const item = await config.model.findOne(hostelScope(req, { _id: req.params.id, ...ACTIVE })).lean();
    if (!item) throw httpError(404, "Resource not found.");
    return item;
};

const create = async (type, req) => {
    const config = getConfig(type);
    if (req.body?.hostelId && String(req.body.hostelId) !== req.tenant.hostelId) throw httpError(403, "The requested hostel does not match your verified hostel context.");
    const values = validatePayload(type, req.body);
    await validateParents(type, values, req.tenant.hostelId);
    const record = new config.model(hostelScope(req, values));
    try {
        await record.save();
    } catch (error) {
        if (error.code === 11000) throw httpError(409, "A resource with that name or number already exists in this location.");
        if (error.name === "ValidationError") throw httpError(400, error.message);
        throw error;
    }
    await auditService.write(req, { action: `${type.slice(0, -1).toUpperCase()}_CREATED`, entityType: type, entityId: record._id, details: { label: record.name || record.roomNumber || record.bedNumber || String(record._id) } });
    return record;
};

const update = async (type, req) => {
    const config = getConfig(type);
    if (!validId(req.params.id)) throw httpError(400, "Invalid resource identifier.");
    if (req.body?.hostelId && String(req.body.hostelId) !== req.tenant.hostelId) throw httpError(403, "The requested hostel does not match your verified hostel context.");
    const record = await config.model.findOne(hostelScope(req, { _id: req.params.id, ...ACTIVE }));
    if (!record) throw httpError(404, "Resource not found.");
    const values = validatePayload(type, req.body, { partial: true });
    if (type === "rooms" && (values.roomType || record.roomType) === "Other" && !(values.customRoomDescription ?? record.customRoomDescription)?.trim()) {
        throw httpError(400, "Describe the custom room when roomType is Other.");
    }
    await validateParents(type, values, req.tenant.hostelId, record);
    record.set(values);
    try {
        await record.save();
    } catch (error) {
        if (error.code === 11000) throw httpError(409, "A resource with that name or number already exists in this location.");
        if (error.name === "ValidationError") throw httpError(400, error.message);
        throw error;
    }
    await auditService.write(req, { action: `${type.slice(0, -1).toUpperCase()}_UPDATED`, entityType: type, entityId: record._id, details: { fields: Object.keys(values) } });
    return record;
};

const archive = async (type, req) => {
    const config = getConfig(type);
    if (!validId(req.params.id)) throw httpError(400, "Invalid resource identifier.");
    const record = await config.model.findOne(hostelScope(req, { _id: req.params.id, ...ACTIVE }));
    if (!record) throw httpError(404, "Resource not found.");
    const childMap = {
        blocks: [Floor, { blockId: record._id }],
        floors: [Room, { floorId: record._id }],
        rooms: [Bed, { roomId: record._id }]
    };
    if (childMap[type]) {
        const [Child, filter] = childMap[type];
        if (await Child.exists(hostelScope(req, { ...filter, ...ACTIVE }))) throw httpError(409, "Archive its active child resources first.");
    }
    if (type === "blocks" && (await Room.exists(hostelScope(req, { blockId: record._id, ...ACTIVE })) ||
        await Bed.exists(hostelScope(req, { roomId: { $in: await Room.find(hostelScope(req, { blockId: record._id, ...ACTIVE })).distinct("_id") }, ...ACTIVE })) ||
        await Student.exists(hostelScope(req, { blockId: record._id, status: "ACTIVE", ...ACTIVE })) ||
        await Allocation.exists(hostelScope(req, { roomId: { $in: await Room.find(hostelScope(req, { blockId: record._id, ...ACTIVE })).distinct("_id") }, status: "ACTIVE" })))) {
        throw httpError(409, "This block still has active rooms, beds, students, or allocations.");
    }
    if (type === "floors" && (await Bed.exists(hostelScope(req, { roomId: { $in: await Room.find(hostelScope(req, { floorId: record._id, ...ACTIVE })).distinct("_id") }, ...ACTIVE })) ||
        await Student.exists(hostelScope(req, { floorId: record._id, status: "ACTIVE", ...ACTIVE })) ||
        await Allocation.exists(hostelScope(req, { roomId: { $in: await Room.find(hostelScope(req, { floorId: record._id, ...ACTIVE })).distinct("_id") }, status: "ACTIVE" })))) {
        throw httpError(409, "This floor still has active beds, students, or allocations.");
    }
    if (type === "rooms" && (await Student.exists(hostelScope(req, { roomId: record._id, status: "ACTIVE", ...ACTIVE })) ||
        await Allocation.exists(hostelScope(req, { roomId: record._id, status: "ACTIVE" })))) {
        throw httpError(409, "This room still has active students or allocations.");
    }
    if (type === "beds" && record.status === "OCCUPIED") {
        throw httpError(409, "An occupied bed cannot be archived. Release its allocation first.");
    }
    if (type === "beds" && (await Student.exists(hostelScope(req, { bedId: record._id, status: "ACTIVE", ...ACTIVE })) || await Allocation.exists({ hostelId: req.tenant.hostelId, bedId: record._id, status: "ACTIVE" }))) {
        throw httpError(409, "Release the assigned student before archiving this bed.");
    }
    record.isDeleted = true;
    if (type === "blocks" || type === "floors") record.status = "INACTIVE";
    else record.status = "MAINTENANCE";
    await record.save();
    await auditService.write(req, { action: `${type.slice(0, -1).toUpperCase()}_ARCHIVED`, entityType: type, entityId: record._id, details: { label: record.name || record.roomNumber || record.bedNumber || String(record._id) } });
    return record;
};

module.exports = { CONFIG, archive, create, get, httpError, list, update, validatePayload, validateParents };



