const mongoose = require("mongoose");

const floorSchema = new mongoose.Schema(
    {
        hostelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true, index: true },
        blockId: { type: mongoose.Schema.Types.ObjectId, ref: "Block", required: true, index: true },
        number: { type: Number, required: true },
        name: { type: String, trim: true, default: "" },
        status: { type: String, enum: ["ACTIVE", "INACTIVE", "MAINTENANCE"], default: "ACTIVE" },
        isDeleted: { type: Boolean, default: false, index: true }
    },
    { timestamps: true }
);

floorSchema.index({ hostelId: 1, blockId: 1, number: 1 }, { unique: true });

module.exports = mongoose.model("Floor", floorSchema);
