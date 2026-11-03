const express = require("express");
const requireAuth = require("../middleware/authMiddleware");
const requireRoles = require("../middleware/roleMiddleware");
const { requireTenant, tenantMiddleware } = require("../middleware/tenantMiddleware");
const ROLES = require("../constants/roles");
const { handlePhotoUpload, savePhoto } = require("../middleware/photoUpload");
const path = require("node:path");
const Student = require("../models/Student");
const Hostel = require("../models/Hostel");
const User = require("../models/User");
const HostelMembership = require("../models/HostelMembership");
const { UPLOAD_ROOT } = require("../middleware/photoUpload");

const router = express.Router();

router.get("/public/photos/:filename", async (req, res, next) => {
    try {
        if (!/^[a-f\d-]{36}\.(?:jpg|png|webp)$/i.test(req.params.filename)) {
            return res.status(404).json({ status: "error", message: "Photo not found." });
        }

        const photoUrl = `/api/uploads/public/photos/${req.params.filename}`;
        const hostel = await Hostel.exists({
            galleryImages: photoUrl,
            status: "ACTIVE",
            isDeleted: { $ne: true }
        });

        if (!hostel) return res.status(404).json({ status: "error", message: "Photo not found." });

        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cache-Control", "public, max-age=3600");
        return res.sendFile(path.join(UPLOAD_ROOT, "photos", req.params.filename), (error) => {
            if (error && !res.headersSent) {
                return res.status(404).json({ status: "error", message: "Photo not found." });
            }
        });
    } catch (error) {
        return next(error);
    }
});

router.get(
    "/photos/:filename",
    requireAuth,
    requireRoles(ROLES.OWNER, ROLES.WARDEN),
    tenantMiddleware,
    requireTenant,
    async (req, res, next) => {
        try {
            if (!/^[a-f\d-]{36}\.(?:jpg|png|webp)$/i.test(req.params.filename)) {
                return res.status(404).json({ status: "error", message: "Photo not found." });
            }
            const photoUrl = `/api/uploads/photos/${req.params.filename}`;
            const [student, hostel] = await Promise.all([
                Student.exists({ hostelId: req.tenant.hostelId, photoUrl }),
                Hostel.exists({ _id: req.tenant.hostelId, photoUrl, isDeleted: { $ne: true } })
            ]);
            let staff = await User.exists({ _id: req.auth.id, hostelId: req.tenant.hostelId, photoUrl, isDeleted: { $ne: true } });
            if (!student && !hostel) {
                const account = await User.findOne({
                    hostelId: req.tenant.hostelId,
                    photoUrl,
                    isDeleted: { $ne: true }
                }).select("_id").lean();
                if (account) staff = await HostelMembership.exists({
                    userId: account._id,
                    hostelId: req.tenant.hostelId,
                    role: { $in: [ROLES.WARDEN, ROLES.GUARD] },
                    isDeleted: { $ne: true }
                });
            }
            if (!student && !hostel && !staff) return res.status(404).json({ status: "error", message: "Photo not found." });
            res.setHeader("X-Content-Type-Options", "nosniff");
            res.setHeader("Cache-Control", "private, no-store");
            return res.sendFile(path.join(UPLOAD_ROOT, "photos", req.params.filename), (error) => {
                if (error && !res.headersSent) return res.status(404).json({ status: "error", message: "Photo not found." });
            });
        } catch (error) {
            return next(error);
        }
    }
);
router.post(
    "/photos/:subject",
    requireAuth,
    requireRoles(ROLES.OWNER, ROLES.WARDEN),
    tenantMiddleware,
    requireTenant,
    (req, res, next) => {
        if (!["student", "staff", "hostel", "owner"].includes(req.params.subject)) {
            return res.status(400).json({ status: "error", message: "Unsupported photo subject." });
        }
        if (["hostel", "owner"].includes(req.params.subject) && req.auth.role !== ROLES.OWNER) {
            return res.status(403).json({ status: "error", message: "Only the hostel owner can upload this photo." });
        }
        return next();
    },
    handlePhotoUpload,
    savePhoto
);

module.exports = router;
