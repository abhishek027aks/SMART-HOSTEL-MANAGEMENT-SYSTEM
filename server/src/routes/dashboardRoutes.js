const express = require("express");

const dashboardController = require("../controllers/dashboardController");
const requireAuth = require("../middleware/authMiddleware");
const requireRoles = require("../middleware/roleMiddleware");
const { tenantMiddleware } = require("../middleware/tenantMiddleware");

const router = express.Router();

router.get(
    "/summary",
    requireAuth,
    requireRoles("SYSTEM_ADMIN", "OWNER", "WARDEN"),
    tenantMiddleware,
    dashboardController.getSummary
);

module.exports = router;
