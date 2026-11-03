const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
    hostelId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Hostel",
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: [
            "NOTICE_PUBLISHED",
            "OUTPASS_REQUESTED",
            "OUTPASS_PARENT_REVIEWED",
            "OUTPASS_FINAL_DECISION",
            "OUTPASS_RETURNED",
            "COMPLAINT_SUBMITTED",
            "COMPLAINT_STATUS_UPDATED"
        ],
        required: true,
        trim: true
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 700 },
    priority: {
        type: String,
        enum: ["GENERAL", "IMPORTANT", "URGENT"],
        default: "GENERAL"
    },
    entityType: {
        type: String,
        enum: ["NOTICE", "OUTPASS", "COMPLAINT", "GENERAL"],
        default: "GENERAL"
    },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    readAt: { type: Date, default: null, index: true },
    isDeleted: { type: Boolean, default: false, index: true }
}, { timestamps: true });

notificationSchema.index({ hostelId: 1, userId: 1, createdAt: -1 });
notificationSchema.index({ hostelId: 1, userId: 1, readAt: 1, isDeleted: 1 });

module.exports = mongoose.model("Notification", notificationSchema);