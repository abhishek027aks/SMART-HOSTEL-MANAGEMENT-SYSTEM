const mongoose = require("mongoose");
const ROLES = require("../constants/roles");

const hostelMembershipSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        hostelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true, index: true },
        role: { type: String, enum: Object.values(ROLES), required: true, index: true },
        status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE", index: true },
        assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        isDeleted: { type: Boolean, default: false, index: true }
    },
    { timestamps: true }
);

hostelMembershipSchema.index({ userId: 1, hostelId: 1 }, {
    unique: true,
    partialFilterExpression: { isDeleted: false }
});
hostelMembershipSchema.index({ hostelId: 1, role: 1, status: 1 });

module.exports = mongoose.model("HostelMembership", hostelMembershipSchema);
