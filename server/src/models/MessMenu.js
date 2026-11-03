const mongoose = require("mongoose");

const mealSchema = new mongoose.Schema({
    name: { type: String, trim: true, maxlength: 120, default: "" },
    items: { type: [String], default: [], validate: (values) => values.length <= 20 }
}, { _id: false });

const messMenuSchema = new mongoose.Schema({
    hostelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true, index: true },
    menuDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true },
    breakfast: { type: mealSchema, default: () => ({}) },
    lunch: { type: mealSchema, default: () => ({}) },
    dinner: { type: mealSchema, default: () => ({}) },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    isDeleted: { type: Boolean, default: false, index: true }
}, { timestamps: true });
messMenuSchema.index({ hostelId: 1, menuDate: 1 }, { unique: true });
module.exports = mongoose.model("MessMenu", messMenuSchema);
