const mongoose = require("mongoose");

const historySchema = new mongoose.Schema({
    action: { type: String, required: true, trim: true },
    fromStatus: { type: String, required: true, trim: true },
    toStatus: { type: String, required: true, trim: true },
    note: { type: String, trim: true, default: "", maxlength: 1000 },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actorRole: { type: String, required: true, trim: true },
    at: { type: Date, default: Date.now, required: true }
}, { _id: false });

const complaintSchema = new mongoose.Schema(
    {
        hostelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true, index: true },
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", default: null, index: true },
        title: { type: String, required: true, trim: true },
        description: { type: String, required: true, trim: true, maxlength: 2000 },
        category: {
            type: String,
            enum: ["FAN", "WATER", "ELECTRICITY", "ROOM", "FOOD", "CLEANLINESS", "SECURITY", "OTHER"],
            default: "OTHER"
        },
        priority: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "MEDIUM" },
        status: { type: String, enum: ["PENDING", "IN_PROGRESS", "RESOLVED"], default: "PENDING", index: true },
        statusNote: { type: String, trim: true, default: "", maxlength: 1000 },
        resolvedAt: { type: Date, default: null },
        history: { type: [historySchema], default: [] },
        isDeleted: { type: Boolean, default: false, index: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Complaint", complaintSchema);
