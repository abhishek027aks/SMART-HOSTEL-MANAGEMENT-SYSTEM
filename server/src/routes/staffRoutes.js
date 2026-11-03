const express = require("express");
const requireAuth = require("../middleware/authMiddleware");
const requireRoles = require("../middleware/roleMiddleware");
const { requireTenant, tenantMiddleware } = require("../middleware/tenantMiddleware");
const ROLES = require("../constants/roles");
const controller = require("../controllers/staffController");

const router = express.Router();
router.use(requireAuth, requireRoles(ROLES.OWNER), tenantMiddleware, requireTenant);
router.get("/", controller.list);
router.post("/", controller.create);
router.get("/:id", controller.get);
router.patch("/:id", controller.update);
router.delete("/:id", controller.deactivate);
router.delete("/:id/archive", controller.archive);
router.post("/:id/restore", controller.restore);

module.exports = router;
