const express = require("express"); const controller = require("../controllers/messController"); const requireAuth = require("../middleware/authMiddleware"); const requireRoles = require("../middleware/roleMiddleware"); const { requireTenant, tenantMiddleware } = require("../middleware/tenantMiddleware"); const ROLES = require("../constants/roles");
const router = express.Router(); router.use(requireAuth, tenantMiddleware, requireTenant);
router.get("/menus", requireRoles(ROLES.OWNER, ROLES.WARDEN, ROLES.STUDENT, ROLES.PARENT), controller.list);
router.put("/menus", requireRoles(ROLES.OWNER, ROLES.WARDEN), controller.saveMenu);
router.put("/menus/:id/review", requireRoles(ROLES.STUDENT), controller.review);
module.exports = router;
