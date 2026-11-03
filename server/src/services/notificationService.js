const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const HostelMembership = require("../models/HostelMembership");
const User = require("../models/User");
const Student = require("../models/Student");
const Parent = require("../models/Parent");

const httpError = (statusCode, message) =>
    Object.assign(new Error(message), { statusCode });

const active = { status: "ACTIVE", isDeleted: { $ne: true } };

const context = (req) => {
    if (!req.tenant?.hostelId || !req.auth?.id) {
        throw httpError(403, "A verified hostel and user context is required.");
    }

    return {
        hostelId: String(req.tenant.hostelId),
        userId: String(req.auth.id)
    };
};

const uniqueIds = (values) => [
    ...new Set((values || []).filter(Boolean).map((value) => String(value)))
];

const readRows = async (Model, filter, projection) => {
    let query = Model.find(filter);
    if (projection) query = query.select(projection);
    return query.lean();
};

const noticeRecipients = async (notice) => {
    const hostelId = String(notice.hostelId);

    // "Everyone" means active users with a verified membership in this hostel.
    if (notice.target === "ALL") {
        const memberships = await readRows(
            HostelMembership,
            { hostelId, ...active },
            "userId"
        );

        const memberIds = uniqueIds(memberships.map((item) => item.userId));
        if (!memberIds.length) return [];

        const users = await readRows(User, {
            _id: { $in: memberIds },
            status: "ACTIVE",
            isDeleted: { $ne: true }
        }, "_id");

        return uniqueIds(users.map((item) => item._id));
    }

    if (notice.target === "ALL_PARENTS") {
        const parents = await readRows(Parent, {
            hostelId,
            ...active
        }, "userId");

        return uniqueIds(parents.map((item) => item.userId));
    }

    const filter = { hostelId, ...active };

    if (notice.target === "BLOCK") filter.blockId = notice.targetBlockId;
    else if (notice.target === "FLOOR") filter.floorId = notice.targetFloorId;
    else if (notice.target === "STUDENT") filter._id = notice.targetStudentId;
    else if (notice.target !== "ALL_STUDENTS") return [];

    const students = await readRows(Student, filter, "_id userId");
    const studentIds = uniqueIds(students.map((item) => item._id));

    if (notice.target === "ALL_STUDENTS") {
        return uniqueIds(students.map((item) => item.userId));
    }

    // Block, floor, and individual-student notices are also visible to
    // parents linked to those students, so notify both sides.
    const parents = studentIds.length
        ? await readRows(Parent, {
            hostelId,
            ...active,
            studentIds: { $in: studentIds }
        }, "userId")
        : [];

    return uniqueIds([
        ...students.map((item) => item.userId),
        ...parents.map((item) => item.userId)
    ]);
};

const notifyNoticePublished = async (notice) => {
    try {
        const userIds = await noticeRecipients(notice);
        if (!userIds.length) return { created: 0 };

        const documents = userIds.map((userId) => ({
            hostelId: notice.hostelId,
            userId,
            type: "NOTICE_PUBLISHED",
            title: notice.title,
            message: String(notice.body || "").slice(0, 700),
            priority: notice.priority || "GENERAL",
            entityType: "NOTICE",
            entityId: notice._id,
            actorId: notice.publishedBy,
            metadata: { target: notice.target }
        }));

        const created = await Notification.insertMany(documents, { ordered: false });
        return { created: created.length };
    } catch (error) {
        // Keep the notice itself available if notification delivery has a problem.
        console.error("[notifications] Notice was published but delivery failed:", error.message);
        return { created: 0, failed: true };
    }
};

const list = async (req) => {
    const { hostelId, userId } = context(req);
    const filter = {
        hostelId,
        userId,
        isDeleted: { $ne: true }
    };

    const [items, unreadCount] = await Promise.all([
        Notification.find(filter).sort({ createdAt: -1 }).limit(100).lean(),
        Notification.countDocuments({ ...filter, readAt: null })
    ]);

    return { items, unreadCount };
};

const markRead = async (req) => {
    const { hostelId, userId } = context(req);
    const id = req.params?.id;

    if (!mongoose.isValidObjectId(id)) {
        throw httpError(400, "Invalid notification identifier.");
    }

    const item = await Notification.findOne({
        _id: id,
        hostelId,
        userId,
        isDeleted: { $ne: true }
    });

    if (!item) throw httpError(404, "Notification not found.");

    if (!item.readAt) {
        item.readAt = new Date();
        await item.save();
    }

    return item;
};

const markAllRead = async (req) => {
    const { hostelId, userId } = context(req);
    const result = await Notification.updateMany({
        hostelId,
        userId,
        isDeleted: { $ne: true },
        readAt: null
    }, {
        $set: { readAt: new Date() }
    });

    return {
        modifiedCount: result.modifiedCount ?? result.nModified ?? 0
    };
};

module.exports = {
    httpError,
    list,
    markRead,
    markAllRead,
    notifyNoticePublished
};