const mongoose = require("mongoose");

const entryExitSchema = new mongoose.Schema(
    {
        hostelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true, index: true },
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
        type: { type: String, enum: ["ENTRY", "EXIT"], required: true, index: true },
        gate: { type: String, trim: true, default: "Main Gate" },
        recordedAt: { type: Date, default: Date.now, index: true },
        isDeleted: { type: Boolean, default: false, index: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model("EntryExit", entryExitSchema);
