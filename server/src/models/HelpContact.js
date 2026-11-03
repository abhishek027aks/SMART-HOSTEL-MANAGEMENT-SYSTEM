const mongoose = require("mongoose");

const helpContactSchema = new mongoose.Schema({
    hostelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true, index: true },
    category: { type: String, enum: ["WARDEN", "SECURITY", "HOSTEL_OFFICE", "EMERGENCY", "OTHER"], required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    email: { type: String, trim: true, lowercase: true, maxlength: 180, default: "" },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

helpContactSchema.index({ hostelId: 1, category: 1, isActive: 1, isDeleted: 1 });

module.exports = mongoose.model("HelpContact", helpContactSchema);
