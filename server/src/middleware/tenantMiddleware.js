const Hostel = require("../models/Hostel");
const ROLES = require("../constants/roles");

const tenantForbidden = (res) => res.status(403).json({
    status: "error",
    message: "You do not have access to this hostel"
});

const tenantMiddleware = async (req, res, next) => {
    if (!req.auth?.role) {
        return res.status(401).json({
            status: "error",
            message: "Authentication required"
        });
    }

    const requestedHostelId = req.get("x-hostel-id");

    // Explicit aggregate context. Ordinary users cannot use this bypass.
    if (
        req.auth.role === ROLES.SYSTEM_ADMIN &&
        requestedHostelId === "__ALL_HOSTELS__"
    ) {
        req.tenant = null;
        return next();
    }

    if (req.auth.role === ROLES.SYSTEM_ADMIN) {
        const selectedHostelId = requestedHostelId || req.auth.hostelId;
        if (!selectedHostelId) {
            req.tenant = null;
            return next();
        }

        try {
            const hostel = await Hostel.findOne({
                _id: selectedHostelId,
                status: "ACTIVE",
                isDeleted: { $ne: true }
            }).select("_id").lean();

            if (!hostel) {
                return tenantForbidden(res);
            }

            req.tenant = { hostelId: String(hostel._id) };
            return next();
        } catch (error) {
            if (error.name === "CastError") {
                return tenantForbidden(res);
            }
            return next(error);
        }
    }

    const memberships = req.auth.memberships || [];
    const selectedHostelId = requestedHostelId || req.auth.hostelId;

    if (!selectedHostelId || !memberships.includes(selectedHostelId)) {
        return tenantForbidden(res);
    }

    req.tenant = { hostelId: selectedHostelId };
    return next();
};

const requireTenant = (req, res, next) => {
    if (!req.tenant?.hostelId) {
        return res.status(403).json({
            status: "error",
            message: "A hostel context is required"
        });
    }

    return next();
};

module.exports = {
    requireTenant,
    tenantMiddleware
};
