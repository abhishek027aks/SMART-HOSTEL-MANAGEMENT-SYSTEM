const express = require("express");
const requireAuth = require("../middleware/authMiddleware");
const requireRoles = require("../middleware/roleMiddleware");
const { requireTenant, tenantMiddleware } = require("../middleware/tenantMiddleware");
const controller = require("../controllers/facilityController");
const ROLES = require("../constants/roles");

const router = express.Router();
router.use(requireAuth, requireRoles(ROLES.SYSTEM_ADMIN, ROLES.OWNER, ROLES.WARDEN), tenantMiddleware, requireTenant);

for (const resource of ["blocks", "floors", "rooms", "beds"]) {
    const collection = express.Router();
    collection.get("/", (req, res, next) => { req.params.resource = resource; return controller.list(req, res, next); });
    collection.post("/", (req, res, next) => { req.params.resource = resource; return controller.create(req, res, next); });
    collection.get("/:id", (req, res, next) => { req.params.resource = resource; return controller.get(req, res, next); });
    collection.patch("/:id", (req, res, next) => { req.params.resource = resource; return controller.update(req, res, next); });
    collection.delete("/:id", (req, res, next) => { req.params.resource = resource; return controller.archive(req, res, next); });
    router.use(`/${resource}`, collection);
}

module.exports = router;
