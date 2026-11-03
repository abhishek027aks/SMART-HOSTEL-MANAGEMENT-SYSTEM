const mongoose = require("mongoose");
const messReviewSchema = new mongoose.Schema({
    hostelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true, index: true },
    menuId: { type: mongoose.Schema.Types.ObjectId, ref: "MessMenu", required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 500, default: "" }
}, { timestamps: true });
messReviewSchema.index({ hostelId: 1, menuId: 1, studentId: 1 }, { unique: true });
module.exports = mongoose.model("MessReview", messReviewSchema);
