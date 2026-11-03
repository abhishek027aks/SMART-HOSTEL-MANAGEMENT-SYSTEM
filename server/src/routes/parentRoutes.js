const express = require("express");
const requireAuth = require("../middleware/authMiddleware");
const requireRoles = require("../middleware/roleMiddleware");
const { requireTenant, tenantMiddleware } = require("../middleware/tenantMiddleware");
const ROLES = require("../constants/roles");
const controller = require("../controllers/parentController");

const router = express.Router();

router.get("/me", requireAuth, requireRoles(ROLES.PARENT), tenantMiddleware, requireTenant, controller.getMine);
router.use(
    requireAuth,
    requireRoles(ROLES.OWNER, ROLES.SYSTEM_ADMIN),
    tenantMiddleware,
    requireTenant
);

router.get("/", controller.list);
router.post("/", controller.create);
router.get("/:id", controller.get);
router.patch("/:id", controller.update);
router.delete("/:id", controller.archive);

module.exports = router;
