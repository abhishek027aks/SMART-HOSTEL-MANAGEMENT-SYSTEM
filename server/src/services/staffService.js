const mongoose = require("mongoose");
const User = require("../models/User");
const HostelMembership = require("../models/HostelMembership");
const StaffAudit = require("../models/StaffAudit");
const ROLES = require("../constants/roles");
const { hashPassword } = require("../utils/password");
const hostelScope = require("../utils/hostelScope");

const STAFF_ROLES = [ROLES.WARDEN, ROLES.GUARD];
const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const validId = mongoose.isValidObjectId;
const PHOTO_PATH = /^\/api\/uploads\/photos\/[a-f\d-]{36}\.(?:jpg|png|webp)$/i;

const validate = (body, partial = false) => {
    if (!body || typeof body !== "object" || Array.isArray(body)) throw httpError(400, "A JSON object is required.");
    const allowed = partial ? ["name", "email", "mobile", "photoUrl"] : ["name", "email", "mobile", "password", "role", "photoUrl", "status"];
    const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
    if (unknown.length) throw httpError(400, `Unsupported field: ${unknown[0]}.`);
    const data = {};
    for (const key of allowed) {
        if (!Object.hasOwn(body, key)) continue;
        const value = body[key];
        if (["name", "email", "mobile"].includes(key) && typeof value !== "string") throw httpError(400, `${key} must be a string.`);
        if (key === "name" && (!value.trim() || value.trim().length > 128)) throw httpError(400, "name must contain 1 to 128 characters.");
        if (key === "email" && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) || value.trim().length > 254)) throw httpError(400, "email must be a valid address.");
        if (key === "mobile" && value.trim().length > 32) throw httpError(400, "mobile must be at most 32 characters.");
        if (key === "password" && (typeof value !== "string" || value.length < 8 || value.length > 1024)) throw httpError(400, "password must contain 8 to 1024 characters.");
        if (key === "role" && !STAFF_ROLES.includes(value)) throw httpError(400, "Staff role must be WARDEN or GUARD.");
        if (key === "status" && !["ACTIVE", "INACTIVE"].includes(value)) throw httpError(400, "status must be ACTIVE or INACTIVE.");
        if (key === "photoUrl" && (typeof value !== "string" || value.length > 2048 || (value && !PHOTO_PATH.test(value)))) throw httpError(400, "photoUrl must reference an uploaded staff photo.");
        data[key] = typeof value === "string" && key !== "password" ? value.trim() : value;
    }
    if (!partial) {
        for (const key of ["name", "email", "role", "password"]) {
            if (!data[key]) throw httpError(400, `${key} is required.`);
        }
    } else if (!Object.keys(data).length) {
        throw httpError(400, "Provide at least one supported staff field to update.");
    }
    return data;
};

const audit = async (req, targetUserId, action, changes = {}, session = null) => {
    const record = new StaffAudit({
        hostelId: req.tenant.hostelId,
        actorId: req.auth.id,
        actorRole: req.auth.role,
        targetUserId,
        action,
        changes
    });
    await record.save(session ? { session } : undefined);
};

const list = async (req) => {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 25);
    const search = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100 || search.length > 100) {
        throw httpError(400, "Invalid pagination or search parameters.");
    }
    if (req.query.role && !STAFF_ROLES.includes(req.query.role)) throw httpError(400, "role must be WARDEN or GUARD.");
    if (req.query.status && !["ACTIVE", "INACTIVE"].includes(req.query.status)) throw httpError(400, "status must be ACTIVE or INACTIVE.");
    const filter = hostelScope(req, { role: { $in: req.query.role ? [req.query.role] : STAFF_ROLES }, isDeleted: { $ne: true } });
    if (req.query.status) filter.status = req.query.status;
    const pipeline = [
        { $match: filter },
        { $lookup: { from: User.collection.name, localField: "userId", foreignField: "_id", as: "user" } },
        { $unwind: "$user" },
        { $match: { "user.isDeleted": { $ne: true }, ...(search ? { $or: ["name", "email", "mobile"].map((field) => ({ [`user.${field}`]: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } })) } : {}) } },
        { $sort: { createdAt: -1, _id: 1 } },
        {
            $facet: {
                items: [
                    { $skip: (page - 1) * limit },
                    { $limit: limit },
                    { $project: {
                        _id: "$user._id",
                        membershipId: "$_id",
                        name: "$user.name",
                        email: { $ifNull: ["$user.email", ""] },
                        mobile: { $ifNull: ["$user.mobile", ""] },
                        photoUrl: { $ifNull: ["$user.photoUrl", ""] },
                        role: "$role",
                        status: "$status"
                    } }
                ],
                metadata: [{ $count: "total" }]
            }
        }
    ];
    const [result = { items: [], metadata: [] }] = await HostelMembership.aggregate(pipeline).allowDiskUse(true);
    const total = result.metadata[0]?.total || 0;
    return { items: result.items.map((item) => ({ ...item, _id: String(item._id), membershipId: String(item.membershipId) })), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

const get = async (req) => {
    if (!validId(req.params.id)) throw httpError(400, "Invalid staff identifier.");
    const membership = await HostelMembership.findOne(hostelScope(req, {
        userId: req.params.id,
        role: { $in: STAFF_ROLES },
        isDeleted: { $ne: true }
    })).populate({ path: "userId", select: "name email mobile photoUrl role status isDeleted" }).lean();
    if (!membership?.userId || membership.userId.isDeleted) throw httpError(404, "Staff member not found in this hostel.");
    return {
        _id: String(membership.userId._id),
        membershipId: String(membership._id),
        name: membership.userId.name,
        email: membership.userId.email || "",
        mobile: membership.userId.mobile || "",
        photoUrl: membership.userId.photoUrl || "",
        role: membership.role,
        status: membership.status
    };
};

const create = async (req) => {
    const data = validate(req.body);
    const session = await mongoose.startSession();
    try {
        let result;
        await session.withTransaction(async () => {
            const duplicate = await User.findOne({
                $or: [{ email: data.email.toLowerCase() }, ...(data.mobile ? [{ mobile: data.mobile }] : [])],
                isDeleted: { $ne: true }
            }).session(session);
            if (duplicate) throw httpError(409, "An account with that email or mobile number already exists.");
            const user = new User({
                hostelId: req.tenant.hostelId,
                name: data.name,
                email: data.email.toLowerCase(),
                mobile: data.mobile || "",
                photoUrl: data.photoUrl || "",
                passwordHash: await hashPassword(data.password),
                googleVerificationRequired: true,
                role: data.role,
                status: "ACTIVE",
                isDeleted: false
            });
            await user.save({ session });
            const membership = new HostelMembership({
                userId: user._id,
                hostelId: req.tenant.hostelId,
                role: data.role,
                status: data.status || "ACTIVE",
                assignedBy: req.auth.id,
                isDeleted: false
            });
            await membership.save({ session });
            await audit(req, user._id, "STAFF_CREATED", { role: data.role, status: membership.status }, session);
            result = { _id: String(user._id), membershipId: String(membership._id), name: user.name, email: user.email, mobile: user.mobile, photoUrl: user.photoUrl, role: data.role, status: membership.status };
        });
        return result;
    } catch (error) {
        if (error.statusCode) throw error;
        if (error.code === 11000) throw httpError(409, "An account with that email or mobile number already exists.");
        throw error;
    } finally {
        await session.endSession();
    }
};

const update = async (req) => {
    if (!validId(req.params.id)) throw httpError(400, "Invalid staff identifier.");
    const data = validate(req.body, true);
    const membership = await HostelMembership.findOne(hostelScope(req, {
        userId: req.params.id,
        role: { $in: STAFF_ROLES },
        isDeleted: { $ne: true }
    }));
    if (!membership) throw httpError(404, "Staff member not found in this hostel.");
    const user = await User.findOne({ _id: membership.userId, isDeleted: { $ne: true } });
    if (!user || !STAFF_ROLES.includes(user.role) || user.role !== membership.role) throw httpError(404, "Staff member not found in this hostel.");
    if (data.email || data.mobile) {
        const duplicate = await User.findOne({
            _id: { $ne: user._id },
            $or: [...(data.email ? [{ email: data.email.toLowerCase() }] : []), ...(data.mobile ? [{ mobile: data.mobile }] : [])],
            isDeleted: { $ne: true }
        });
        if (duplicate) throw httpError(409, "An account with that email or mobile number already exists.");
    }
    user.set({ ...data, ...(data.email ? { email: data.email.toLowerCase() } : {}) });
    try {
        await user.save();
    } catch (error) {
        if (error.code === 11000) throw httpError(409, "An account with that email or mobile number already exists.");
        throw error;
    }
    await audit(req, user._id, "STAFF_UPDATED", Object.keys(data).reduce((changes, key) => {
        changes[key] = key === "photoUrl" ? Boolean(data[key]) : data[key];
        return changes;
    }, {}));
    return { _id: String(user._id), membershipId: String(membership._id), name: user.name, email: user.email, mobile: user.mobile, photoUrl: user.photoUrl, role: membership.role, status: membership.status };
};

const setStatus = async (req, status) => {
    if (!validId(req.params.id)) throw httpError(400, "Invalid staff identifier.");
    const membership = await HostelMembership.findOne(hostelScope(req, {
        userId: req.params.id,
        role: { $in: STAFF_ROLES },
        isDeleted: { $ne: true }
    }));
    if (!membership) throw httpError(404, "Staff member not found in this hostel.");
    if (membership.status === status) return get(req);
    membership.status = status;
    await membership.save();
    await audit(req, membership.userId, status === "ACTIVE" ? "STAFF_RESTORED" : "STAFF_DEACTIVATED", { role: membership.role, status });
    return get(req);
};

const deactivate = (req) => setStatus(req, "INACTIVE");
const restore = (req) => setStatus(req, "ACTIVE");

// STAFF_ARCHIVE_V1
const archive = async (req) => {
    if (!validId(req.params.id)) throw httpError(400, "Invalid staff identifier.");
    if (req.auth?.role !== ROLES.OWNER) {
        throw httpError(403, "Only the hostel owner can delete staff accounts.");
    }

    const session = await mongoose.startSession();
    try {
        let result;
        await session.withTransaction(async () => {
            const membership = await HostelMembership.findOne(hostelScope(req, {
                userId: req.params.id,
                role: { $in: STAFF_ROLES },
                isDeleted: { $ne: true }
            })).session(session);

            if (!membership) throw httpError(404, "Staff member not found in this hostel.");

            const user = await User.findOne({
                _id: membership.userId,
                isDeleted: { $ne: true }
            }).session(session);

            if (!user || !STAFF_ROLES.includes(user.role) || user.role !== membership.role) {
                throw httpError(404, "Staff member not found in this hostel.");
            }

            // Archive only this hostel membership. Keep the User and history records.
            membership.status = "INACTIVE";
            membership.isDeleted = true;
            await membership.save({ session });

            await audit(req, user._id, "STAFF_DEACTIVATED", {
                role: membership.role,
                status: "INACTIVE",
                archived: true
            }, session);

            result = {
                _id: String(user._id),
                membershipId: String(membership._id),
                status: "INACTIVE",
                deleted: true
            };
        });
        return result;
    } finally {
        await session.endSession();
    }
};
module.exports = { archive, create, deactivate, get, httpError, list, restore, update, validate };
