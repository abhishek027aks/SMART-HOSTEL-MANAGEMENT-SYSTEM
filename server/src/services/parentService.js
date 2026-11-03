const mongoose = require("mongoose");
const Parent = require("../models/Parent");
const Student = require("../models/Student");
const User = require("../models/User");
const HostelMembership = require("../models/HostelMembership");
const ROLES = require("../constants/roles");
const { hashPassword } = require("../utils/password");

const httpError = (statusCode, message) =>
    Object.assign(new Error(message), { statusCode });

const escapeRegex = (value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PHOTO_PATH = /^\/api\/uploads\/photos\/[a-f\d-]{36}\.(?:jpg|png|webp)$/i;

const validate = (body, partial = false) => {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw httpError(400, "A JSON object is required.");
    }

    const allowed = partial
        ? ["name", "email", "mobile", "photoUrl", "relationship", "studentIds", "status", "password"]
        : ["parentId", "name", "email", "mobile", "photoUrl", "relationship", "studentIds", "status", "password"];

    const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
    if (unknown.length) throw httpError(400, `Unsupported field: ${unknown[0]}.`);

    const data = {};

    for (const key of allowed) {
        if (!Object.hasOwn(body, key)) continue;
        const value = body[key];

        if (["parentId", "name", "email", "mobile", "photoUrl", "relationship", "status"].includes(key) &&
            typeof value !== "string") {
            throw httpError(400, `${key} must be a string.`);
        }

        if (key === "parentId" && (!value.trim() || value.trim().length > 64)) {
            throw httpError(400, "parentId must contain 1 to 64 characters.");
        }
        if (key === "name" && (!value.trim() || value.trim().length > 128)) {
            throw httpError(400, "name must contain 1 to 128 characters.");
        }
        if (key === "email" && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) || value.trim().length > 254)) {
            throw httpError(400, "email must be a valid address.");
        }
        if (key === "mobile" && value.trim().length > 32) {
            throw httpError(400, "mobile must be at most 32 characters.");
        }
        if (key === "photoUrl" && value.length > 2048) {
            throw httpError(400, "photoUrl is too long.");
        }
        if (key === "photoUrl" && value &&
            !PHOTO_PATH.test(value) &&
            !/^https?:\/\/[^\s]+$/i.test(value)) {
            throw httpError(400, "photoUrl must be an uploaded photo reference or valid HTTP(S) URL.");
        }
        if (key === "relationship" &&
            !["FATHER", "MOTHER", "GUARDIAN", "OTHER"].includes(value)) {
            throw httpError(400, "Invalid parent relationship.");
        }
        if (key === "status" && !["ACTIVE", "INACTIVE"].includes(value)) {
            throw httpError(400, "status must be ACTIVE or INACTIVE.");
        }
        if (key === "password" &&
            (typeof value !== "string" || value.length < 8 || value.length > 1024)) {
            throw httpError(400, "password must contain 8 to 1024 characters.");
        }
        if (key === "studentIds") {
            if (!Array.isArray(value) || value.length === 0) {
                throw httpError(400, "Link at least one student to this parent.");
            }
            if (value.some((id) => typeof id !== "string" || !mongoose.isValidObjectId(id))) {
                throw httpError(400, "Every studentIds entry must be a valid student identifier.");
            }
            if (new Set(value.map(String)).size !== value.length) {
                throw httpError(400, "Duplicate student identifiers are not allowed.");
            }
        }

        data[key] = typeof value === "string" && key !== "password"
            ? value.trim()
            : value;
    }

    if (!partial) {
        for (const key of ["parentId", "name", "relationship", "studentIds", "password"]) {
            if (data[key] === undefined || data[key] === "") {
                throw httpError(400, `${key} is required.`);
            }
        }
        if (!data.email && !data.mobile) {
            throw httpError(400, "Provide an email address or mobile number for parent login.");
        }
    } else if (!Object.keys(data).length) {
        throw httpError(400, "Provide at least one supported parent field to update.");
    }

    return data;
};

const findValidStudents = async (req, studentIds, session) => {
    const query = Student.find({
        _id: { $in: studentIds },
        hostelId: req.tenant.hostelId,
        status: "ACTIVE",
        isDeleted: { $ne: true }
    }).select("_id");

    if (session) query.session(session);

    const students = await query;
    if (students.length !== studentIds.length) {
        throw httpError(400, "One or more students are inactive or not found in this hostel.");
    }
    return students;
};

const create = async (req) => {
    const data = validate(req.body);

    if (!data.email) {
        throw httpError(400, "A valid Google account email is required for parent login.");
    }

    if (![ROLES.OWNER, ROLES.SYSTEM_ADMIN].includes(req.auth?.role)) {
        throw httpError(403, "Only an administrator can create parent login accounts.");
    }

    const session = await mongoose.startSession();

    try {
        let result;

        await session.withTransaction(async () => {
            const accountMatches = [];
            if (data.email) accountMatches.push({ email: data.email.toLowerCase() });
            if (data.mobile) accountMatches.push({ mobile: data.mobile });

            const duplicate = await User.findOne({
                $or: accountMatches,
                isDeleted: { $ne: true }
            }).session(session).select("_id");

            if (duplicate) {
                throw httpError(409, "An account with this email or mobile number already exists.");
            }

            await findValidStudents(req, data.studentIds, session);

            const status = data.status || "ACTIVE";
            const user = new User({
                hostelId: req.tenant.hostelId,
                name: data.name,
                ...(data.email ? { email: data.email.toLowerCase() } : {}),
                mobile: data.mobile || "",
                photoUrl: data.photoUrl || "",
                passwordHash: await hashPassword(data.password),
                googleVerificationRequired: true,
                role: ROLES.PARENT,
                status,
                isDeleted: false
            });
            await user.save({ session });

            const parent = new Parent({
                hostelId: req.tenant.hostelId,
                userId: user._id,
                parentId: data.parentId,
                relationship: data.relationship,
                studentIds: data.studentIds,
                status,
                isDeleted: false
            });
            await parent.save({ session });

            const membership = new HostelMembership({
                userId: user._id,
                hostelId: req.tenant.hostelId,
                role: ROLES.PARENT,
                status,
                assignedBy: req.auth.id,
                isDeleted: false
            });
            await membership.save({ session });

            result = {
                _id: String(parent._id),
                parentId: parent.parentId,
                name: user.name,
                email: user.email || "",
                mobile: user.mobile || "",
                photoUrl: user.photoUrl || "",
                relationship: parent.relationship,
                studentIds: parent.studentIds.map(String),
                status: parent.status,
                loginAccountCreated: true
            };
        });

        return result;
    } catch (error) {
        if (error.statusCode) throw error;
        if (error.code === 11000) {
            throw httpError(409, "The parent ID or account email/mobile is already in use.");
        }
        if (error.name === "ValidationError") throw httpError(400, error.message);
        throw error;
    } finally {
        await session.endSession();
    }
};

const list = async (req) => {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 25);
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const status = req.query.status;

    if (!Number.isInteger(page) || page < 1 ||
        !Number.isInteger(limit) || limit < 1 || limit > 100 ||
        q.length > 100) {
        throw httpError(400, "Invalid pagination or search parameters.");
    }
    if (status && !["ACTIVE", "INACTIVE"].includes(status)) {
        throw httpError(400, "status must be ACTIVE or INACTIVE.");
    }

    const filter = {
        hostelId: req.tenant.hostelId,
        isDeleted: { $ne: true },
        ...(status ? { status } : {})
    };

    if (q) {
        const pattern = new RegExp(escapeRegex(q), "i");
        const matchingUsers = await User.find({
            hostelId: req.tenant.hostelId,
            isDeleted: { $ne: true },
            $or: [{ name: pattern }, { email: pattern }, { mobile: pattern }]
        }).select("_id").lean();

        filter.$or = [
            { parentId: pattern },
            { userId: { $in: matchingUsers.map((user) => user._id) } }
        ];
    }

    const [parents, total] = await Promise.all([
        Parent.find(filter)
            .populate({ path: "userId", select: "name email mobile photoUrl status isDeleted" })
            .populate({
                path: "studentIds",
                match: { hostelId: req.tenant.hostelId, isDeleted: { $ne: true } },
                select: "studentId name status"
            })
            .sort({ createdAt: -1, _id: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        Parent.countDocuments(filter)
    ]);

    const items = parents
        .filter((parent) => parent.userId && !parent.userId.isDeleted)
        .map((parent) => ({
            _id: String(parent._id),
            parentId: parent.parentId,
            name: parent.userId.name,
            email: parent.userId.email || "",
            mobile: parent.userId.mobile || "",
            photoUrl: parent.userId.photoUrl || "",
            relationship: parent.relationship,
            studentIds: (parent.studentIds || []).map((student) => ({
                _id: String(student._id),
                studentId: student.studentId,
                name: student.name,
                status: student.status
            })),
            status: parent.status,
            createdAt: parent.createdAt
        }));

    return {
        items,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
};

const get = async (req) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        throw httpError(400, "Invalid parent identifier.");
    }

    const parent = await Parent.findOne({
        _id: req.params.id,
        hostelId: req.tenant.hostelId,
        isDeleted: { $ne: true }
    })
        .populate({ path: "userId", select: "name email mobile photoUrl status isDeleted" })
        .populate({
            path: "studentIds",
            match: { hostelId: req.tenant.hostelId, isDeleted: { $ne: true } },
            select: "studentId name status"
        })
        .lean();

    if (!parent?.userId || parent.userId.isDeleted) {
        throw httpError(404, "Parent not found in this hostel.");
    }

    return {
        _id: String(parent._id),
        parentId: parent.parentId,
        name: parent.userId.name,
        email: parent.userId.email || "",
        mobile: parent.userId.mobile || "",
        photoUrl: parent.userId.photoUrl || "",
        relationship: parent.relationship,
        studentIds: (parent.studentIds || []).map((student) => ({
            _id: String(student._id),
            studentId: student.studentId,
            name: student.name,
            status: student.status
        })),
        status: parent.status
    };
};

const update = async (req) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        throw httpError(400, "Invalid parent identifier.");
    }
    if (![ROLES.OWNER, ROLES.SYSTEM_ADMIN].includes(req.auth?.role)) {
        throw httpError(403, "Only an administrator can update parent accounts.");
    }

    const data = validate(req.body, true);
    const session = await mongoose.startSession();

    try {
        let result;

        await session.withTransaction(async () => {
            const parent = await Parent.findOne({
                _id: req.params.id,
                hostelId: req.tenant.hostelId,
                isDeleted: { $ne: true }
            }).session(session);

            if (!parent) throw httpError(404, "Parent not found in this hostel.");

            const user = await User.findOne({
                _id: parent.userId,
                isDeleted: { $ne: true }
            }).session(session);

            if (!user || user.role !== ROLES.PARENT) {
                throw httpError(404, "Parent login account not found.");
            }

            if (data.studentIds) {
                await findValidStudents(req, data.studentIds, session);
                parent.studentIds = data.studentIds;
            }
            if (data.relationship) parent.relationship = data.relationship;

            const nextEmail = data.email ? data.email.toLowerCase() : user.email;
            const nextMobile = data.mobile !== undefined ? data.mobile : (user.mobile || "");
            if (!nextEmail && !nextMobile) {
                throw httpError(400, "A parent must have an email address or mobile number for login.");
            }

            if (data.email || data.mobile) {
                const accountMatches = [];
                if (data.email) accountMatches.push({ email: data.email.toLowerCase() });
                if (data.mobile) accountMatches.push({ mobile: data.mobile });

                const duplicate = await User.findOne({
                    _id: { $ne: user._id },
                    $or: accountMatches,
                    isDeleted: { $ne: true }
                }).session(session).select("_id");

                if (duplicate) {
                    throw httpError(409, "An account with this email or mobile number already exists.");
                }
            }

            for (const key of ["name", "mobile", "photoUrl"]) {
                if (data[key] !== undefined) user[key] = data[key];
            }
            if (data.email) user.email = data.email.toLowerCase();
            if (data.password) user.passwordHash = await hashPassword(data.password);

            if (data.status) {
                parent.status = data.status;
                user.status = data.status;
                const membership = await HostelMembership.findOne({
                    userId: user._id,
                    hostelId: req.tenant.hostelId,
                    role: ROLES.PARENT,
                    isDeleted: { $ne: true }
                }).session(session);

                if (membership) {
                    membership.status = data.status;
                    await membership.save({ session });
                }
            }

            await parent.save({ session });
            await user.save({ session });

            result = {
                _id: String(parent._id),
                parentId: parent.parentId,
                name: user.name,
                email: user.email || "",
                mobile: user.mobile || "",
                photoUrl: user.photoUrl || "",
                relationship: parent.relationship,
                studentIds: parent.studentIds.map(String),
                status: parent.status,
                passwordUpdated: Boolean(data.password)
            };
        });

        return result;
    } catch (error) {
        if (error.statusCode) throw error;
        if (error.code === 11000) {
            throw httpError(409, "The account email/mobile or parent ID is already in use.");
        }
        if (error.name === "ValidationError") throw httpError(400, error.message);
        throw error;
    } finally {
        await session.endSession();
    }
};

// PARENT_SOFT_DELETE_V1
const archive = async (req) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        throw httpError(400, "Invalid parent identifier.");
    }
    if (![ROLES.OWNER, ROLES.SYSTEM_ADMIN].includes(req.auth?.role)) {
        throw httpError(403, "Only an administrator can delete parent accounts.");
    }

    const session = await mongoose.startSession();
    try {
        let result;
        await session.withTransaction(async () => {
            const parent = await Parent.findOne({
                _id: req.params.id,
                hostelId: req.tenant.hostelId,
                isDeleted: { $ne: true }
            }).session(session);

            if (!parent) throw httpError(404, "Parent not found in this hostel.");

            const user = await User.findOne({
                _id: parent.userId,
                isDeleted: { $ne: true }
            }).session(session);

            if (!user || user.role !== ROLES.PARENT) {
                throw httpError(404, "Parent login account not found.");
            }

            const membership = await HostelMembership.findOne({
                userId: user._id,
                hostelId: req.tenant.hostelId,
                role: ROLES.PARENT,
                isDeleted: { $ne: true }
            }).session(session);

            parent.status = "INACTIVE";
            parent.isDeleted = true;
            await parent.save({ session });

            user.status = "INACTIVE";
            user.isDeleted = true;
            await user.save({ session });

            if (membership) {
                membership.status = "INACTIVE";
                membership.isDeleted = true;
                await membership.save({ session });
            }

            result = {
                _id: String(parent._id),
                parentId: parent.parentId,
                status: "INACTIVE",
                deleted: true
            };
        });
        return result;
    } finally {
        await session.endSession();
    }
};
const getMine = async (req) => {
    const parent = await Parent.findOne({
        userId: req.auth.id,
        hostelId: req.tenant.hostelId,
        status: "ACTIVE",
        isDeleted: { $ne: true }
    })
        .populate({
            path: "studentIds",
            match: {
                hostelId: req.tenant.hostelId,
                status: "ACTIVE",
                isDeleted: { $ne: true }
            },
            select: "studentId name mobile email photoUrl status roomId bedId"
        })
        .lean();

    if (!parent) {
        throw httpError(404, "Parent profile not found in this hostel.");
    }

    return {
        parentId: parent.parentId,
        name: req.auth.name || "",
        email: req.auth.email || "",
        mobile: req.auth.mobile || "",
        relationship: parent.relationship,
        students: (parent.studentIds || [])
            .filter(Boolean)
            .map((student) => ({
                _id: String(student._id),
                studentId: student.studentId,
                name: student.name,
                mobile: student.mobile || "",
                email: student.email || "",
                photoUrl: student.photoUrl || "",
                status: student.status,
                allocationStatus: student.bedId ? "ALLOCATED" : "UNALLOCATED"
            }))
    };
};
module.exports = { archive, create, get, getMine, httpError, list, update, validate };
