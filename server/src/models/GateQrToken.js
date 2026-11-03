const mongoose = require("mongoose");

const gateQrTokenSchema = new mongoose.Schema(
    {
        hostelId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Hostel",
            required: true,
            index: true
        },
        studentRecordId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Student",
            required: true,
            index: true
        },
        issuedByUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        tokenHash: {
            type: String,
            required: true,
            unique: true,
            select: false
        },
        expiresAt: {
            type: Date,
            required: true,
            index: { expires: 0 }
        },
        consumedAt: {
            type: Date,
            default: null
        },
        revokedAt: {
            type: Date,
            default: null
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("GateQrToken", gateQrTokenSchema);
