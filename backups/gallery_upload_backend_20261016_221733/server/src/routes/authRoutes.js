const express = require("express");
const authController = require("../controllers/authController");
const requireAuth = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", authController.login);
router.post("/google", authController.googleLogin);
router.post("/register", authController.registerOwner);
router.post("/register-owner", authController.registerOwner);
router.get("/hostels", requireAuth, authController.listAccessibleHostels);
router.get("/me", requireAuth, authController.getCurrentUser);
router.patch("/me", requireAuth, authController.updateCurrentOwner);

module.exports = router;
