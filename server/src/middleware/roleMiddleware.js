const ROLES = require("../constants/roles");

const requireRoles = (...allowedRoles) => {
    if (allowedRoles.length === 0 || allowedRoles.some((role) => !Object.values(ROLES).includes(role))) {
        throw new TypeError("At least one valid application role must be provided.");
    }

    return (req, res, next) => {
        if (!req.auth) {
            return res.status(401).json({
                status: "error",
                message: "Authentication required"
            });
        }

        if (!allowedRoles.includes(req.auth.role)) {
            return res.status(403).json({
                status: "error",
                message: "You do not have permission to access this resource"
            });
        }

        return next();
    };
};

module.exports = requireRoles;
