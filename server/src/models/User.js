const mongoose = require("mongoose");

const ROLES = require("../constants/roles");

const userSchema = new mongoose.Schema(
    {
        hostelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", default: null, index: true },
        name: { type: String, required: true, trim: true },
        photoUrl: { type: String, trim: true, default: "" },
        mobile: { type: String, trim: true, default: "" },
        email: { type: String, trim: true, lowercase: true, sparse: true, index: true },
        passwordHash: { type: String, required: true },
        googleSub: { type: String, default: "" },
        googleVerifiedAt: { type: Date, default: null },
        googleVerificationRequired: { type: Boolean, default: false, index: true },
        role: { type: String, enum: Object.values(ROLES), required: true, index: true },
        status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE", index: true },
        isDeleted: { type: Boolean, default: false, index: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
