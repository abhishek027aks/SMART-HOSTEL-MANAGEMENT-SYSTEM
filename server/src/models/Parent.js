const mongoose = require("mongoose");

const parentSchema = new mongoose.Schema(
    {
        hostelId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Hostel",
            required: true,
            index: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        parentId: {
            type: String,
            required: true,
            trim: true,
            maxlength: 64
        },
        relationship: {
            type: String,
            enum: ["FATHER", "MOTHER", "GUARDIAN", "OTHER"],
            required: true
        },
        studentIds: {
            type: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: "Student"
            }],
            validate: {
                validator: (value) =>
                    Array.isArray(value) &&
                    value.length > 0 &&
                    new Set(value.map(String)).size === value.length,
                message: "Link at least one unique student to this parent."
            }
        },
        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE"],
            default: "ACTIVE",
            index: true
        },
        isDeleted: {
            type: Boolean,
            default: false,
            index: true
        }
    },
    { timestamps: true }
);

parentSchema.index(
    { hostelId: 1, parentId: 1 },
    { unique: true }
);

parentSchema.index(
    { hostelId: 1, userId: 1 },
    {
        unique: true,
        partialFilterExpression: { isDeleted: false }
    }
);

parentSchema.index({ hostelId: 1, studentIds: 1, isDeleted: 1 });

module.exports = mongoose.model("Parent", parentSchema);
