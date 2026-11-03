const mongoose = require("mongoose");
const noticeSchema = new mongoose.Schema({
    hostelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    target: { type: String, enum: ["ALL", "ALL_STUDENTS", "ALL_PARENTS", "BLOCK", "FLOOR", "STUDENT"], default: "ALL", index: true },
    targetBlockId: { type: mongoose.Schema.Types.ObjectId, ref: "Block", default: null },
    targetFloorId: { type: mongoose.Schema.Types.ObjectId, ref: "Floor", default: null },
    targetStudentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", default: null },
    priority: { type: String, enum: ["GENERAL", "IMPORTANT", "URGENT"], default: "GENERAL" },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    isDeleted: { type: Boolean, default: false, index: true }
}, { timestamps: true });
noticeSchema.index({ hostelId: 1, target: 1, createdAt: -1 });
module.exports = mongoose.model("Notice", noticeSchema);
