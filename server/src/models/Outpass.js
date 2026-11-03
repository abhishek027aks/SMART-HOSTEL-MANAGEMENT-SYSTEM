const mongoose = require("mongoose");

const historyEntrySchema = new mongoose.Schema({
    action: { type: String, required: true, trim: true },
    fromStatus: { type: String, required: true },
    toStatus: { type: String, required: true },
    note: { type: String, trim: true, default: "", maxlength: 1000 },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actorRole: { type: String, required: true },
    at: { type: Date, required: true, default: Date.now }
}, { _id: false });

const outpassSchema = new mongoose.Schema(
    {
        hostelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true, index: true },
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },

        requestType: { type: String, enum: ["OUTPASS", "LEAVE"], default: "OUTPASS", index: true },
        reason: { type: String, required: true, trim: true, maxlength: 1000 },
        destination: { type: String, trim: true, default: "", maxlength: 300 },
        startAt: { type: Date, default: null, index: true },
        expectedReturnAt: { type: Date, default: null },

        status: {
            type: String,
            enum: [
                "PENDING",
                "PENDING_PARENT",
                "PENDING_FINAL",
                "APPROVED",
                "REJECTED",
                "EXPIRED",
                "COMPLETED"
            ],
            default: "PENDING_PARENT",
            index: true
        },

        parentReviewStatus: {
            type: String,
            enum: ["PENDING", "APPROVED", "REJECTED"],
            default: "PENDING",
            index: true
        },
        parentReviewNote: { type: String, trim: true, default: "", maxlength: 1000 },
        parentReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        parentReviewedAt: { type: Date, default: null },

        finalDecisionNote: { type: String, trim: true, default: "", maxlength: 1000 },
        finalDecisionBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        finalDecisionAt: { type: Date, default: null },

        returnedAt: { type: Date, default: null },
        returnedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

        history: { type: [historyEntrySchema], default: [] },
        isDeleted: { type: Boolean, default: false, index: true }
    },
    { timestamps: true, optimisticConcurrency: true }
);

outpassSchema.index({ hostelId: 1, status: 1, createdAt: -1 });
outpassSchema.index({ hostelId: 1, studentId: 1, createdAt: -1 });

module.exports = mongoose.model("Outpass", outpassSchema);