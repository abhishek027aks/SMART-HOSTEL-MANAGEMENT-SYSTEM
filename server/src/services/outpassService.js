const mongoose = require("mongoose");
const Outpass = require("../models/Outpass");
const Student = require("../models/Student");
const Parent = require("../models/Parent");
const ROLES = require("../constants/roles");

const REQUEST_TYPES = ["OUTPASS", "LEAVE"];
const STATUSES = [
    "PENDING", "PENDING_PARENT", "PENDING_FINAL",
    "APPROVED", "REJECTED", "EXPIRED", "COMPLETED"
];

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

const ensureTenant = (req) => {
    if (!req.tenant?.hostelId) {
        throw httpError(403, "A verified hostel context is required.");
    }
    return String(req.tenant.hostelId);
};

const readText = (value, label, { required = false, max = 1000, min = 0 } = {}) => {
    if (value == null && !required) return "";
    if (typeof value !== "string") throw httpError(400, `${label} must be text.`);
    const result = value.trim();
    if (required && !result) throw httpError(400, `${label} is required.`);
    if (result.length > max) throw httpError(400, `${label} is too long.`);
    if (result.length < min) throw httpError(400, `${label} is too short.`);
    return result;
};

const readDate = (value, label) => {
    if (typeof value !== "string" && !(value instanceof Date)) {
        throw httpError(400, `${label} must be a valid date and time.`);
    }
    const result = new Date(value);
    if (!Number.isFinite(result.getTime())) {
        throw httpError(400, `${label} must be a valid date and time.`);
    }
    return result;
};

const validateCreatePayload = (body, now = Date.now()) => {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw httpError(400, "A request body is required.");
    }

    const requestType = String(body.requestType || "OUTPASS").trim().toUpperCase();
    if (!REQUEST_TYPES.includes(requestType)) {
        throw httpError(400, "Request type must be OUTPASS or LEAVE.");
    }

    const reason = readText(body.reason, "Reason", { required: true, min: 5, max: 1000 });
    const destination = readText(body.destination, "Destination", {
        required: true, min: 2, max: 300
    });
    const startAt = readDate(body.startAt, "Start time");
    const expectedReturnAt = readDate(body.expectedReturnAt, "Expected return time");
    const nowMs = now instanceof Date ? now.getTime() : Number(now);

    if (startAt.getTime() <= nowMs) {
        throw httpError(400, "Start time must be in the future.");
    }
    if (expectedReturnAt.getTime() <= startAt.getTime()) {
        throw httpError(400, "Expected return time must be after the start time.");
    }
    if (expectedReturnAt.getTime() - startAt.getTime() > 366 * 24 * 60 * 60 * 1000) {
        throw httpError(400, "The requested duration cannot exceed 366 days.");
    }

    return { requestType, reason, destination, startAt, expectedReturnAt };
};

const normalizeNote = (value, required = false) => {
    const note = readText(value, "Review note", { required, max: 1000 });
    if (required && !note) throw httpError(400, "A reason is required when rejecting a request.");
    return note;
};

const appendHistory = (record, req, action, fromStatus, toStatus, note = "") => {
    if (!Array.isArray(record.history)) record.history = [];
    record.history.push({
        action,
        fromStatus,
        toStatus,
        note,
        actorId: req.auth.id,
        actorRole: req.auth.role,
        at: new Date()
    });
};

const saveSafely = async (record) => {
    try {
        await record.save();
        return record;
    } catch (error) {
        if (error?.name === "VersionError") {
            throw httpError(409, "This request was updated by another user. Refresh and try again.");
        }
        throw error;
    }
};

const findOutpass = async (req) => {
    const hostelId = ensureTenant(req);
    const id = req.params?.id;
    if (!mongoose.isValidObjectId(id)) throw httpError(400, "Invalid outpass identifier.");

    const record = await Outpass.findOne({
        _id: id,
        hostelId,
        isDeleted: { $ne: true }
    });
    if (!record) throw httpError(404, "Outpass request was not found in this hostel.");
    return record;
};

const create = async (req) => {
    const hostelId = ensureTenant(req);
    if (req.auth?.role !== ROLES.STUDENT) {
        throw httpError(403, "Only students can submit outpass or leave requests.");
    }

    const data = validateCreatePayload(req.body);
    const student = await Student.findOne({
        userId: req.auth.id,
        hostelId,
        status: "ACTIVE",
        isDeleted: { $ne: true }
    });

    if (!student) throw httpError(404, "Your active student record was not found.");

    const activeParent = await Parent.findOne({
        hostelId,
        studentIds: student._id,
        status: "ACTIVE",
        isDeleted: { $ne: true }
    });

    if (!activeParent) {
        throw httpError(409, "An active Parent account must be linked to this student before applying.");
    }

    const record = new Outpass({
        ...data,
        hostelId,
        studentId: student._id,
        status: "PENDING_PARENT",
        parentReviewStatus: "PENDING",
        history: [{
            action: "REQUEST_SUBMITTED",
            fromStatus: "NONE",
            toStatus: "PENDING_PARENT",
            note: "",
            actorId: req.auth.id,
            actorRole: req.auth.role,
            at: new Date()
        }]
    });

    return saveSafely(record);
};

const listQuery = (filter, hostelId) => Outpass.find(filter)
    .populate({
        path: "studentId",
        select: "name studentId blockId floorId roomId bedId",
        match: { hostelId }
    })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

const list = async (req) => {
    const hostelId = ensureTenant(req);
    const filter = { hostelId, isDeleted: { $ne: true } };

    if (req.query?.status) {
        const status = String(req.query.status).trim().toUpperCase();
        if (!STATUSES.includes(status)) throw httpError(400, "Invalid outpass status filter.");
        filter.status = status;
    }

    const from = req.query?.from ? readDate(String(req.query.from), "From date") : null;
    const to = req.query?.to ? readDate(String(req.query.to), "To date") : null;
    if (from && to && from.getTime() > to.getTime()) {
        throw httpError(400, "From date must not be after To date.");
    }
    if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = from;
        if (to) filter.createdAt.$lte = to;
    }

    return listQuery(filter, hostelId);
};

const listMine = async (req) => {
    const hostelId = ensureTenant(req);
    let filter = { hostelId, isDeleted: { $ne: true } };

    if (req.auth.role === ROLES.STUDENT) {
        const student = await Student.findOne({
            userId: req.auth.id,
            hostelId,
            status: "ACTIVE",
            isDeleted: { $ne: true }
        });
        if (!student) throw httpError(404, "Your active student record was not found.");
        filter.studentId = student._id;
    } else if (req.auth.role === ROLES.PARENT) {
        const parent = await Parent.findOne({
            userId: req.auth.id,
            hostelId,
            status: "ACTIVE",
            isDeleted: { $ne: true }
        });
        if (!parent) throw httpError(404, "Your active Parent record was not found.");
        filter.studentId = { $in: parent.studentIds || [] };
    } else {
        throw httpError(403, "Only students and linked parents can view their requests.");
    }

    return listQuery(filter, hostelId);
};

const parentReview = async (req) => {
    const hostelId = ensureTenant(req);
    if (req.auth?.role !== ROLES.PARENT) throw httpError(403, "Parent access is required.");

    const decision = String(req.body?.decision || "").trim().toUpperCase();
    if (!["APPROVE", "REJECT"].includes(decision)) {
        throw httpError(400, "Decision must be APPROVE or REJECT.");
    }
    const note = normalizeNote(req.body?.note, decision === "REJECT");
    const record = await findOutpass(req);

    const parent = await Parent.findOne({
        userId: req.auth.id,
        hostelId,
        studentIds: record.studentId,
        status: "ACTIVE",
        isDeleted: { $ne: true }
    });
    if (!parent) throw httpError(403, "You are not linked to this student's outpass.");

    if (record.status !== "PENDING_PARENT" || record.parentReviewStatus !== "PENDING") {
        throw httpError(409, "This request is no longer awaiting Parent review.");
    }

    const previous = record.status;
    const next = decision === "APPROVE" ? "PENDING_FINAL" : "REJECTED";
    record.parentReviewStatus = decision === "APPROVE" ? "APPROVED" : "REJECTED";
    record.parentReviewNote = note;
    record.parentReviewedBy = req.auth.id;
    record.parentReviewedAt = new Date();
    record.status = next;
    appendHistory(record, req, decision === "APPROVE" ? "PARENT_APPROVED" : "PARENT_REJECTED", previous, next, note);
    return saveSafely(record);
};

const finalDecision = async (req) => {
    ensureTenant(req);
    if (![ROLES.SYSTEM_ADMIN, ROLES.OWNER, ROLES.WARDEN].includes(req.auth?.role)) {
        throw httpError(403, "Only the Owner or Warden can make the final decision.");
    }

    const decision = String(req.body?.decision || "").trim().toUpperCase();
    if (!["APPROVE", "REJECT"].includes(decision)) {
        throw httpError(400, "Decision must be APPROVE or REJECT.");
    }
    const note = normalizeNote(req.body?.note, decision === "REJECT");
    const record = await findOutpass(req);

    if (record.status !== "PENDING_FINAL" || record.parentReviewStatus !== "APPROVED") {
        throw httpError(409, "Final decision is allowed only after Parent approval.");
    }

    const previous = record.status;
    const next = decision === "APPROVE" ? "APPROVED" : "REJECTED";
    record.status = next;
    record.finalDecisionNote = note;
    record.finalDecisionBy = req.auth.id;
    record.finalDecisionAt = new Date();
    appendHistory(record, req, decision === "APPROVE" ? "FINAL_APPROVED" : "FINAL_REJECTED", previous, next, note);
    return saveSafely(record);
};

const confirmReturn = async (req) => {
    const hostelId = ensureTenant(req);
    const role = req.auth?.role;
    if (![ROLES.STUDENT, ROLES.GUARD, ROLES.WARDEN, ROLES.OWNER, ROLES.SYSTEM_ADMIN].includes(role)) {
        throw httpError(403, "You cannot confirm an outpass return.");
    }

    const record = await findOutpass(req);

    if (record.status !== "APPROVED") {
        throw httpError(409, "Return can be confirmed only for an approved request that has not yet been completed.");
    }

    if (role === ROLES.STUDENT) {
        const student = await Student.findOne({
            userId: req.auth.id,
            hostelId,
            status: "ACTIVE",
            isDeleted: { $ne: true }
        });
        if (!student || String(student._id) !== String(record.studentId)) {
            throw httpError(403, "You can confirm return only for your own request.");
        }
    }

    const note = normalizeNote(req.body?.note, false);
    const previous = record.status;
    record.status = "COMPLETED";
    record.returnedAt = new Date();
    record.returnedBy = req.auth.id;
    appendHistory(record, req, "RETURN_CONFIRMED", previous, "COMPLETED", note);
    return saveSafely(record);
};

module.exports = {
    STATUSES,
    REQUEST_TYPES,
    create,
    list,
    listMine,
    parentReview,
    finalDecision,
    confirmReturn,
    validateCreatePayload,
    normalizeNote,
    httpError
};