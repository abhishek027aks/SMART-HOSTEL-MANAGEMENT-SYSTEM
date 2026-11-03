const express = require("express");
const controller = require("../controllers/notificationController");
const requireAuth = require("../middleware/authMiddleware");
const { requireTenant, tenantMiddleware } = require("../middleware/tenantMiddleware");

const router = express.Router();

router.use(requireAuth, tenantMiddleware, requireTenant);

router.get("/", controller.list);
router.patch("/read-all", controller.markAllRead);
router.patch("/:id/read", controller.markRead);

module.exports = router;