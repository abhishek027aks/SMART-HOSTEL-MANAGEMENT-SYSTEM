const mongoose = require("mongoose");
const securityEventSchema = new mongoose.Schema({
    hostelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true, index: true },
    cameraId: { type: mongoose.Schema.Types.ObjectId, ref: "Camera", default: null },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 1000, default: "" },
    severity: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "MEDIUM" },
    status: { type: String, enum: ["OPEN", "RESOLVED"], default: "OPEN", index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });
module.exports = mongoose.model("SecurityEvent", securityEventSchema);
