const mongoose = require("mongoose");

const blockSchema = new mongoose.Schema(
    {
        hostelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true, index: true },
        name: { type: String, required: true, trim: true },
        status: { type: String, enum: ["ACTIVE", "INACTIVE", "MAINTENANCE"], default: "ACTIVE" },
        isDeleted: { type: Boolean, default: false, index: true }
    },
    { timestamps: true }
);

blockSchema.index({ hostelId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Block", blockSchema);
