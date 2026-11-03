const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
    {
        hostelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
        studentId: { type: String, required: true, trim: true, index: true },
        name: { type: String, required: true, trim: true },
        photoUrl: { type: String, trim: true, default: "" },
        mobile: { type: String, trim: true, default: "" },
        email: { type: String, trim: true, lowercase: true, default: "" },
        blockId: { type: mongoose.Schema.Types.ObjectId, ref: "Block", default: null },
        floorId: { type: mongoose.Schema.Types.ObjectId, ref: "Floor", default: null },
        roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room", default: null },
        bedId: { type: mongoose.Schema.Types.ObjectId, ref: "Bed", default: null },
        status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE", index: true },
        isDeleted: { type: Boolean, default: false, index: true }
    },
    { timestamps: true }
);

studentSchema.index({ hostelId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model("Student", studentSchema);
