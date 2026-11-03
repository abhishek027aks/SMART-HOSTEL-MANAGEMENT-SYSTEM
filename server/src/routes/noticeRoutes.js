const express = require("express"); const controller = require("../controllers/noticeController"); const requireAuth = require("../middleware/authMiddleware"); const requireRoles = require("../middleware/roleMiddleware"); const { requireTenant, tenantMiddleware } = require("../middleware/tenantMiddleware"); const ROLES = require("../constants/roles");
const router = express.Router(); router.use(requireAuth, tenantMiddleware, requireTenant);
router.get("/mine", requireRoles(ROLES.STUDENT, ROLES.PARENT), controller.mine);
router.get("/", requireRoles(ROLES.SYSTEM_ADMIN, ROLES.OWNER, ROLES.WARDEN), controller.list);
router.post("/", requireRoles(ROLES.SYSTEM_ADMIN, ROLES.OWNER, ROLES.WARDEN), controller.create);
module.exports = router;
