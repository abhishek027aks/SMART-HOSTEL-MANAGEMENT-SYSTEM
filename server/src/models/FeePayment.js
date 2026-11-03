const mongoose = require("mongoose");

const feePaymentSchema = new mongoose.Schema({
    hostelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    amount: { type: Number, required: true, min: 0.01, max: 10000000 },
    currency: { type: String, enum: ["INR"], default: "INR" },
    dueDate: { type: Date, default: null },
    status: {
        type: String,
        enum: ["DUE", "PENDING_VERIFICATION", "PAID", "REJECTED"],
        default: "DUE",
        index: true
    },
    paymentMethod: { type: String, enum: ["UPI", "BANK_TRANSFER", "CASH"], default: null },
    transactionReference: { type: String, trim: true, maxlength: 100, default: "" },
    proofFilename: { type: String, default: "" },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    submittedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true, maxlength: 500, default: "" },
    receiptNumber: { type: String, trim: true, default: "" },
    paidAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

feePaymentSchema.index({ hostelId: 1, studentId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("FeePayment", feePaymentSchema);