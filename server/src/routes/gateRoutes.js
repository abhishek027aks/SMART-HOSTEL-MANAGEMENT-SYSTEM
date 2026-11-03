const express = require("express");
const controller = require("../controllers/gateController");
const requireAuth = require("../middleware/authMiddleware");
const requireRoles = require("../middleware/roleMiddleware");
const ROLES = require("../constants/roles");
const {
    requireTenant,
    tenantMiddleware
} = require("../middleware/tenantMiddleware");

const router = express.Router();

router.post(
    "/qr-token",
    requireAuth,
    requireRoles(ROLES.STUDENT),
    tenantMiddleware,
    requireTenant,
    controller.issueQrToken
);

router.post(
    "/scan",
    requireAuth,
    requireRoles(ROLES.GUARD, ROLES.WARDEN),
    tenantMiddleware,
    requireTenant,
    controller.scan
);

module.exports = router;
