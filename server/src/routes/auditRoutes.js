const express = require("express");
const controller = require("../controllers/auditController");
const requireAuth = require("../middleware/authMiddleware");
const requireRoles = require("../middleware/roleMiddleware");
const { tenantMiddleware, requireTenant } = require("../middleware/tenantMiddleware");
const ROLES = require("../constants/roles");

const router = express.Router();
router.get("/", requireAuth, requireRoles(ROLES.SYSTEM_ADMIN, ROLES.OWNER), tenantMiddleware, requireTenant, controller.list);

module.exports = router;
