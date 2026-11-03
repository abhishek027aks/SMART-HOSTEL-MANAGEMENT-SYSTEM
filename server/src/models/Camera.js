const mongoose = require("mongoose");
const cameraSchema = new mongoose.Schema({
    hostelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    location: { type: String, required: true, trim: true, maxlength: 180 },
    type: { type: String, enum: ["IP", "CCTV", "WEB"], default: "IP" },
    streamUrl: { type: String, trim: true, maxlength: 2048, default: "" },
    status: { type: String, enum: ["ACTIVE", "INACTIVE", "MAINTENANCE"], default: "ACTIVE" },
    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });
cameraSchema.index({ hostelId: 1, name: 1 }, { unique: true });
module.exports = mongoose.model("Camera", cameraSchema);
