const mongoose = require("mongoose");

const bedSchema = new mongoose.Schema(
    {
        hostelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true, index: true },
        roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true, index: true },
        bedNumber: { type: String, required: true, trim: true },
        status: {
            type: String,
            enum: ["AVAILABLE", "OCCUPIED", "RESERVED", "MAINTENANCE"],
            default: "AVAILABLE",
            index: true
        },
        isDeleted: { type: Boolean, default: false, index: true }
    },
    { timestamps: true }
);

bedSchema.index({ hostelId: 1, roomId: 1, bedNumber: 1 }, { unique: true });

module.exports = mongoose.model("Bed", bedSchema);
