const express = require("express");
const controller = require("../controllers/outpassController");
const requireAuth = require("../middleware/authMiddleware");
const requireRoles = require("../middleware/roleMiddleware");
const ROLES = require("../constants/roles");
const { requireTenant, tenantMiddleware } = require("../middleware/tenantMiddleware");

const router = express.Router();

router.use(requireAuth, tenantMiddleware, requireTenant);

router.get("/mine", requireRoles(ROLES.STUDENT, ROLES.PARENT), controller.listMine);
router.get("/", requireRoles(ROLES.SYSTEM_ADMIN, ROLES.OWNER, ROLES.WARDEN), controller.list);
router.post("/", requireRoles(ROLES.STUDENT), controller.create);

router.patch("/:id/parent-review", requireRoles(ROLES.PARENT), controller.parentReview);
router.patch("/:id/decision", requireRoles(ROLES.SYSTEM_ADMIN, ROLES.OWNER, ROLES.WARDEN), controller.finalDecision);
router.post("/:id/return", requireRoles(ROLES.STUDENT, ROLES.GUARD, ROLES.WARDEN, ROLES.OWNER, ROLES.SYSTEM_ADMIN), controller.confirmReturn);

module.exports = router;