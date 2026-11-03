const User = require("../models/User");
const Hostel = require("../models/Hostel");
const HostelMembership = require("../models/HostelMembership");
const Student = require("../models/Student");
const ROLES = require("../constants/roles");
const config = require("../config");
const { TokenValidationError, verifyAccessToken } = require("../utils/token");

const unauthorized = (res) => res.status(401).json({
    status: "error",
    message: "Authentication required"
});

const requireAuth = async (req, res, next) => {
    const authorization = req.get("authorization") || "";
    const match = /^Bearer (\S+)$/i.exec(authorization);
    if (!match) {
        return unauthorized(res);
    }

    let tokenPayload;
    try {
        tokenPayload = verifyAccessToken(match[1], config.jwtSecret);
    } catch (error) {
        if (error instanceof TokenValidationError) {
            return unauthorized(res);
        }
        return next(error);
    }

    try {
        const user = await User.findById(tokenPayload.sub)
            .select("name email mobile photoUrl role hostelId status isDeleted")
            .lean();

        if (!user || user.status !== "ACTIVE" || user.isDeleted || user.role !== tokenPayload.role) {
            return unauthorized(res);
        }

        let memberships = [];
        if (user.role !== ROLES.SYSTEM_ADMIN) {
            const membershipRecords = await HostelMembership.find({
                userId: user._id,
                role: user.role,
                status: "ACTIVE",
                isDeleted: { $ne: true }
            }).select("hostelId").lean();
            const memberHostelIds = [...new Set(membershipRecords.map((membership) => String(membership.hostelId)))];
            const activeHostels = memberHostelIds.length > 0
                ? await Hostel.find({
                    _id: { $in: memberHostelIds },
                    status: "ACTIVE",
                    isDeleted: { $ne: true }
                }).select("_id").lean()
                : [];
            memberships = activeHostels.map((hostel) => String(hostel._id));

            if (!tokenPayload.hostelId || !memberships.includes(tokenPayload.hostelId)) {
                return unauthorized(res);
            }
        } else if (tokenPayload.hostelId !== null) {
            const activeHostel = await Hostel.findOne({
                _id: tokenPayload.hostelId,
                status: "ACTIVE",
                isDeleted: { $ne: true }
            }).select("_id").lean();
            if (!activeHostel) {
                return unauthorized(res);
            }
        }

        let studentId = null;
        if (user.role === ROLES.STUDENT) {
            const student = await Student.findOne({
                userId: user._id,
                hostelId: tokenPayload.hostelId,
                status: "ACTIVE",
                isDeleted: { $ne: true }
            }).select("studentId").lean();

            if (!student) {
                return unauthorized(res);
            }
            studentId = student.studentId;
        }

        req.auth = {
            id: String(user._id),
            name: user.name,
            email: user.email || "",
            mobile: user.mobile || "",
            photoUrl: user.photoUrl || "",
            role: user.role,
            hostelId: tokenPayload.hostelId,
            memberships,
            studentId
        };
        return next();
    } catch (error) {
        if (error.name === "CastError") {
            return unauthorized(res);
        }
        return next(error);
    }
};

module.exports = requireAuth;
