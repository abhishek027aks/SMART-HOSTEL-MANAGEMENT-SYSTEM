const mongoose = require("mongoose");

const allocationSchema = new mongoose.Schema({
    hostelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    bedId: { type: mongoose.Schema.Types.ObjectId, ref: "Bed", required: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    allocatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    allocationDate: { type: Date, required: true, default: Date.now },
    releasedAt: { type: Date, default: null },
    releasedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    status: { type: String, enum: ["ACTIVE", "RELEASED"], default: "ACTIVE", index: true },
    transferFrom: { type: mongoose.Schema.Types.ObjectId, ref: "Allocation", default: null }
}, { timestamps: true });

allocationSchema.index({ hostelId: 1, studentId: 1, status: 1 });
allocationSchema.index({ hostelId: 1, bedId: 1, status: 1 });
allocationSchema.index({ studentId: 1 }, { unique: true, partialFilterExpression: { status: "ACTIVE" } });
allocationSchema.index({ bedId: 1 }, { unique: true, partialFilterExpression: { status: "ACTIVE" } });

module.exports = mongoose.model("Allocation", allocationSchema);
