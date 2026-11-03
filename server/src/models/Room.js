const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
    {
        hostelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true, index: true },
        blockId: { type: mongoose.Schema.Types.ObjectId, ref: "Block", required: true, index: true },
        floorId: { type: mongoose.Schema.Types.ObjectId, ref: "Floor", required: true, index: true },
        roomNumber: { type: String, required: true, trim: true },
        roomType: { type: String, trim: true, default: "Standard", maxlength: 64 },
        airConditioning: {
            type: String,
            enum: ["AC", "NON_AC"],
            default: "NON_AC"
        },
        customRoomDescription: { type: String, trim: true, maxlength: 300, default: "" },
        capacity: { type: Number, required: true, min: 1, max: 500, default: 1 },
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

roomSchema.index({ hostelId: 1, floorId: 1, roomNumber: 1 }, { unique: true });

module.exports = mongoose.model("Room", roomSchema);
