const mongoose = require("mongoose");

const staffAuditSchema = new mongoose.Schema({
    hostelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actorRole: { type: String, required: true },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, enum: ["STAFF_CREATED", "STAFF_UPDATED", "STAFF_DEACTIVATED", "STAFF_RESTORED"], required: true },
    changes: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

module.exports = mongoose.model("StaffAudit", staffAuditSchema);
