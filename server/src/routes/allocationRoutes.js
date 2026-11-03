const express = require("express");
const controller = require("../controllers/allocationController");
const requireAuth = require("../middleware/authMiddleware");
const requireRoles = require("../middleware/roleMiddleware");
const ROLES = require("../constants/roles");
const { requireTenant, tenantMiddleware } = require("../middleware/tenantMiddleware");

const router = express.Router();
router.use(requireAuth, requireRoles(ROLES.SYSTEM_ADMIN, ROLES.OWNER, ROLES.WARDEN), tenantMiddleware, requireTenant);
router.get("/options", controller.options);
router.get("/available-beds", controller.availableBeds);
router.get("/", controller.list);
router.post("/", controller.assign);
router.post("/:id/release", controller.release);
// DELETE safely releases the active bed assignment and preserves allocation history.
router.delete("/:id", controller.release);
router.post("/:id/transfer", controller.transfer);
module.exports = router;
