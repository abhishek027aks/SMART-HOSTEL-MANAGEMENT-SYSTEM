const mongoose = require("mongoose");
const Complaint = require("../models/Complaint");
const Student = require("../models/Student");
const Parent = require("../models/Parent");
const ROLES = require("../constants/roles");

const CATEGORIES = ["FAN", "WATER", "ELECTRICITY", "ROOM", "FOOD", "CLEANLINESS", "SECURITY", "OTHER"];
const STATUSES = ["PENDING", "IN_PROGRESS", "RESOLVED"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"];
const active = { isDeleted: { $ne: true }, status: "ACTIVE" };
const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

const cleanText = (value, maximum = 1000) => typeof value === "string" ? value.trim().slice(0, maximum) : "";

const getStudent = (req) => Student.findOne({ userId: req.auth.id, hostelId: req.tenant.hostelId, ...active }).select("_id").lean();

const create = async (req) => {
    const title = cleanText(req.body?.title, 160);
    const description = cleanText(req.body?.description, 2000);
    const category = cleanText(req.body?.category, 30).toUpperCase() || "OTHER";
    const priority = cleanText(req.body?.priority, 20).toUpperCase() || "MEDIUM";
    if (title.length < 3) throw httpError(400, "Complaint title must be at least 3 characters.");
    if (description.length < 5) throw httpError(400, "Complaint description must be at least 5 characters.");
    if (!CATEGORIES.includes(category)) throw httpError(400, "Select a valid complaint category.");
    if (!PRIORITIES.includes(priority)) throw httpError(400, "Select a valid complaint priority.");
    const student = await getStudent(req);
    if (!student) throw httpError(404, "Active student profile not found in this hostel.");
    const complaint = await Complaint.create({
        hostelId: req.tenant.hostelId,
        studentId: student._id,
        title,
        description,
        category,
        priority,
        status: "PENDING",
        history: [{ action: "CREATED", fromStatus: "NONE", toStatus: "PENDING", actorId: req.auth.id, actorRole: req.auth.role }]
    });
    return Complaint.findById(complaint._id).populate("studentId", "name studentId").lean();
};

const mine = async (req) => {
    let studentIds;
    if (req.auth.role === ROLES.STUDENT) {
        const student = await getStudent(req);
        if (!student) throw httpError(404, "Active student profile not found in this hostel.");
        studentIds = [student._id];
    } else {
        const parent = await Parent.findOne({ userId: req.auth.id, hostelId: req.tenant.hostelId, ...active }).select("studentIds").lean();
        if (!parent) throw httpError(404, "Active parent profile not found in this hostel.");
        studentIds = parent.studentIds || [];
    }
    const items = await Complaint.find({ hostelId: req.tenant.hostelId, studentId: { $in: studentIds }, isDeleted: { $ne: true } })
        .populate("studentId", "name studentId").sort({ createdAt: -1 }).limit(200).lean();
    return { items };
};

const list = async (req) => {
    const filter = { hostelId: req.tenant.hostelId, isDeleted: { $ne: true } };
    const status = cleanText(req.query.status, 20).toUpperCase();
    if (status) {
        if (!STATUSES.includes(status)) throw httpError(400, "Invalid complaint status filter.");
        filter.status = status;
    }
    const items = await Complaint.find(filter).populate("studentId", "name studentId roomId bedId").sort({ createdAt: -1 }).limit(500).lean();
    return { items };
};

const updateStatus = async (req) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw httpError(400, "Invalid complaint identifier.");
    const status = cleanText(req.body?.status, 20).toUpperCase();
    const note = cleanText(req.body?.note, 1000);
    if (!STATUSES.includes(status)) throw httpError(400, "Select PENDING, IN_PROGRESS, or RESOLVED.");
    const complaint = await Complaint.findOne({ _id: req.params.id, hostelId: req.tenant.hostelId, isDeleted: { $ne: true } });
    if (!complaint) throw httpError(404, "Complaint not found in this hostel.");
    if (complaint.status === status && complaint.statusNote === note) throw httpError(409, "This complaint already has the requested status.");
    const fromStatus = complaint.status;
    complaint.status = status;
    complaint.statusNote = note;
    complaint.resolvedAt = status === "RESOLVED" ? new Date() : null;
    complaint.history.push({ action: "STATUS_UPDATED", fromStatus, toStatus: status, note, actorId: req.auth.id, actorRole: req.auth.role });
    await complaint.save();
    return Complaint.findById(complaint._id).populate("studentId", "name studentId").lean();
};

module.exports = { CATEGORIES, PRIORITIES, STATUSES, create, httpError, list, mine, updateStatus };
