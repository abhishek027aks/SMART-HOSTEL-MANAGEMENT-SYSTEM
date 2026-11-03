const AuditLog = require("../models/AuditLog");
const hostelScope = require("../utils/hostelScope");

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

const write = async (req, { action, entityType, entityId, details = {} }) => AuditLog.create({
    hostelId: req.tenant.hostelId,
    actorId: req.auth.id,
    actorRole: req.auth.role,
    action,
    entityType,
    entityId,
    details
});

const list = async (req) => {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 25);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw httpError(400, "Invalid pagination.");
    }
    const filter = hostelScope(req);
    if (req.query.entityType) {
        if (typeof req.query.entityType !== "string" || req.query.entityType.length > 40) throw httpError(400, "Invalid entity type.");
        filter.entityType = req.query.entityType;
    }
    const [items, total] = await Promise.all([
        AuditLog.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit)
            .populate("actorId", "name email role").lean(),
        AuditLog.countDocuments(filter)
    ]);
    return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

module.exports = { httpError, list, write };
