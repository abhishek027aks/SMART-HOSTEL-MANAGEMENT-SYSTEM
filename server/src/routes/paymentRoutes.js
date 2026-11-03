const express = require("express");
const controller = require("../controllers/paymentController");
const requireAuth = require("../middleware/authMiddleware");
const requireRoles = require("../middleware/roleMiddleware");
const { requireTenant, tenantMiddleware } = require("../middleware/tenantMiddleware");
const { receivePaymentProof } = require("../middleware/paymentProofUpload");
const ROLES = require("../constants/roles");

const router = express.Router();
const scoped = [requireAuth, tenantMiddleware, requireTenant];

router.get(
    "/mine",
    ...scoped,
    requireRoles(ROLES.STUDENT, ROLES.PARENT),
    controller.mine
);

router.get(
    "/:id/proof",
    ...scoped,
    requireRoles(ROLES.SYSTEM_ADMIN, ROLES.OWNER, ROLES.WARDEN, ROLES.STUDENT, ROLES.PARENT),
    controller.proof
);

router.get(
    "/",
    ...scoped,
    requireRoles(ROLES.SYSTEM_ADMIN, ROLES.OWNER, ROLES.WARDEN),
    controller.list
);

router.post(
    "/",
    ...scoped,
    requireRoles(ROLES.SYSTEM_ADMIN, ROLES.OWNER, ROLES.WARDEN),
    controller.create
);

router.post(
    "/:id/submit",
    ...scoped,
    requireRoles(ROLES.STUDENT, ROLES.PARENT),
    receivePaymentProof,
    controller.submit
);

router.patch(
    "/:id/review",
    ...scoped,
    requireRoles(ROLES.SYSTEM_ADMIN, ROLES.OWNER, ROLES.WARDEN),
    controller.review
);

module.exports = router;