const express = require("express");
const controller = require("../controllers/studentController");
const requireAuth = require("../middleware/authMiddleware");
const requireRoles = require("../middleware/roleMiddleware");
const ROLES = require("../constants/roles");
const { requireTenant, tenantMiddleware } = require("../middleware/tenantMiddleware");

const router = express.Router();
router.use(requireAuth, requireRoles(ROLES.SYSTEM_ADMIN, ROLES.OWNER, ROLES.WARDEN), tenantMiddleware, requireTenant);
router.get("/", controller.list);
router.post("/", controller.create);
router.get("/:id", controller.get);
router.patch("/:id", controller.update);
router.delete("/:id", controller.archive);
router.post("/:id/restore", controller.restore);
module.exports = router;
