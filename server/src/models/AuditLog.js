const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
    hostelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true, maxlength: 80, index: true },
    entityType: { type: String, required: true, maxlength: 40, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

auditLogSchema.index({ hostelId: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
