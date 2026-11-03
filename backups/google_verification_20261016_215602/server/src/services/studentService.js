const mongoose = require("mongoose");
const Student = require("../models/Student");
const Allocation = require("../models/Allocation");
const User = require("../models/User");
const HostelMembership = require("../models/HostelMembership");
const ROLES = require("../constants/roles");
const { hashPassword } = require("../utils/password");
const hostelScope = require("../utils/hostelScope");
const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const list = async (req) => {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 25);
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100 || q.length > 100) throw httpError(400, "Invalid pagination or search parameters.");
    const archived = req.query.archived === "true";
    const filter = hostelScope(req, { isDeleted: archived ? true : { $ne: true } });
    if (req.query.status !== undefined) {
        if (!["ACTIVE", "INACTIVE"].includes(req.query.status)) throw httpError(400, "Invalid student status filter.");
        filter.status = req.query.status;
    }
    if (q) filter.$or = ["name", "studentId", "mobile", "email"].map((field) => ({ [field]: { $regex: escapeRegex(q), $options: "i" } }));
    const [items, total] = await Promise.all([
        Student.find(filter).select("name studentId mobile email photoUrl status roomId bedId blockId floorId createdAt updatedAt").populate("roomId", "roomNumber roomType").populate("bedId", "bedNumber status").sort({ createdAt: -1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
        Student.countDocuments(filter)
    ]);
    return { items: items.map((item) => ({ ...item, allocationStatus: item.bedId ? "ALLOCATED" : "UNALLOCATED", qrStatus: "NOT_CONFIGURED" })), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

const validate = (body, partial = false) => {
    if (!body || typeof body !== "object" || Array.isArray(body)) throw httpError(400, "A JSON object is required.");
    const allowed = partial ? ["name", "studentId", "mobile", "email", "photoUrl", "status"] : ["name", "studentId", "mobile", "email", "photoUrl", "status", "password"];
    const unknown = Object.keys(body).filter((field) => !allowed.includes(field) && field !== "hostelId");
    if (unknown.length) throw httpError(400, `Unsupported field: ${unknown[0]}.`);
    const data = {};
    for (const key of allowed) {
        if (!Object.hasOwn(body, key)) continue;
        const value = body[key];
        if (["name", "studentId"].includes(key) && (typeof value !== "string" || !value.trim() || value.trim().length > 128)) throw httpError(400, `${key} must be a non-empty string of at most 128 characters.`);
        if (key === "mobile" && (typeof value !== "string" || value.length > 32)) throw httpError(400, "mobile must be a string of at most 32 characters.");
        if (key === "email" && (typeof value !== "string" || (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())))) throw httpError(400, "email must be a valid email address.");
        if (key === "photoUrl" && (typeof value !== "string" || value.length > 2048 || (value && !(/^\/api\/uploads\/photos\/[a-f\d-]{36}\.(?:jpg|png|webp)$/i.test(value) || /^https?:\/\//i.test(value))))) throw httpError(400, "photoUrl must be an uploaded photo reference or valid HTTP(S) URL.");
        if (key === "password" && (typeof value !== "string" || value.length < 8 || value.length > 1024)) throw httpError(400, "password must contain 8 to 1024 characters.");
        if (key === "status" && !["ACTIVE", "INACTIVE"].includes(value)) throw httpError(400, "status must be ACTIVE or INACTIVE.");
        data[key] = typeof value === "string" && key !== "password" ? value.trim() : value;
    }
    if (!partial) {
        for (const required of ["name", "studentId"]) if (!data[required]) throw httpError(400, `${required} is required.`);
    } else if (!Object.keys(data).length) throw httpError(400, "Provide at least one supported field to update.");
    if (data.status === "INACTIVE" && body.bedId) throw httpError(400, "Release the student allocation before deactivating the student.");
    return data;
};

// STUDENT_ACCOUNT_TRANSACTION_V1
const create = async (req) => {
    if (req.body?.hostelId && String(req.body.hostelId) !== String(req.tenant.hostelId)) {
        throw httpError(403, "The requested hostel does not match your verified hostel context.");
    }

    const data = validate(req.body);
    const password = data.password;
    delete data.password;

    // Keep the existing profile-only create flow compatible with older clients.
    if (password === undefined) {
        const student = new Student(hostelScope(req, data));
        try {
            await student.save();
        } catch (error) {
            if (error.code === 11000) throw httpError(409, "That student ID is already in use in this hostel.");
            if (error.name === "ValidationError") throw httpError(400, error.message);
            throw error;
        }
        return student;
    }

    // Creating login credentials is restricted to hostel/platform administrators.
    if (![ROLES.OWNER, ROLES.SYSTEM_ADMIN].includes(req.auth?.role)) {
        throw httpError(403, "Only an administrator can create student login credentials.");
    }

    const status = data.status || "ACTIVE";
    const session = await mongoose.startSession();

    try {
        let result;

        await session.withTransaction(async () => {
            const accountMatches = [];
            if (data.email) accountMatches.push({ email: data.email.toLowerCase() });
            if (data.mobile) accountMatches.push({ mobile: data.mobile });

            if (accountMatches.length) {
                const existingUser = await User.findOne({
                    $or: accountMatches,
                    isDeleted: { $ne: true }
                }).session(session).select("_id");

                if (existingUser) {
                    throw httpError(409, "An account with this email or mobile number already exists.");
                }
            }

            const user = new User({
                hostelId: req.tenant.hostelId,
                name: data.name,
                ...(data.email ? { email: data.email.toLowerCase() } : {}),
                mobile: data.mobile || "",
                passwordHash: await hashPassword(password),
                role: ROLES.STUDENT,
                status,
                isDeleted: false
            });

            await user.save({ session });

            const student = new Student(hostelScope(req, {
                ...data,
                userId: user._id
            }));

            await student.save({ session });

            const membership = new HostelMembership({
                userId: user._id,
                hostelId: req.tenant.hostelId,
                role: ROLES.STUDENT,
                status,
                assignedBy: req.auth.id,
                isDeleted: false
            });

            await membership.save({ session });

            result = {
                ...student.toObject(),
                loginAccountCreated: true,
                loginId: student.studentId
            };
        });

        return result;
    } catch (error) {
        if (error.statusCode) throw error;
        if (error.code === 11000) {
            throw httpError(409, "The student ID or account email/mobile is already in use.");
        }
        if (error.name === "ValidationError") throw httpError(400, error.message);
        throw error;
    } finally {
        await session.endSession();
    }
};

const get = async (req) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw httpError(400, "Invalid student identifier.");
    const student = await Student.findOne(hostelScope(req, { _id: req.params.id, isDeleted: { $ne: true } })).populate("roomId", "roomNumber roomType").populate("bedId", "bedNumber status").lean();
    if (!student) throw httpError(404, "Student not found.");
    return { ...student, allocationStatus: student.bedId ? "ALLOCATED" : "UNALLOCATED", qrStatus: "NOT_CONFIGURED" };
};

const update = async (req) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw httpError(400, "Invalid student identifier.");
    if (req.body?.hostelId && String(req.body.hostelId) !== String(req.tenant.hostelId)) throw httpError(403, "The requested hostel does not match your verified hostel context.");
    const data = validate(req.body, true);
    const student = await Student.findOne(hostelScope(req, { _id: req.params.id, isDeleted: { $ne: true } }));
    if (!student) throw httpError(404, "Student not found.");
    if (data.status === "INACTIVE" && student.bedId) throw httpError(409, "Release the student's bed before deactivating the student.");
    student.set(data);
    try { await student.save(); }
    catch (error) { if (error.code === 11000) throw httpError(409, "That student ID is already in use in this hostel."); if (error.name === "ValidationError") throw httpError(400, error.message); throw error; }
    return student;
};

const setArchived = async (req, isDeleted) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw httpError(400, "Invalid student identifier.");
    const student = await Student.findOne(hostelScope(req, {
        _id: req.params.id,
        isDeleted: isDeleted ? { $ne: true } : true
    }));
    if (!student) throw httpError(404, isDeleted ? "Archived student not found." : "Student not found.");
    if (isDeleted) {
        const activeAllocation = student.bedId || await Allocation.exists(hostelScope(req, {
            studentId: student._id,
            status: "ACTIVE"
        }));
        if (activeAllocation) throw httpError(409, "Release or transfer the student's active bed before archiving this student.");
        student.status = "INACTIVE";
    }
    student.isDeleted = isDeleted;
    await student.save();
    return student;
};

const archive = (req) => setArchived(req, true);
const restore = (req) => setArchived(req, false);

module.exports = { archive, create, get, httpError, list, restore, update, validate };
