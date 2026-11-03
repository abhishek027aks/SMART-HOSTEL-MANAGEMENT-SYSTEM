const mongoose = require("mongoose");

const hostelSchema = new mongoose.Schema(
    {
        hostelCode: { type: String, required: true, unique: true, trim: true },
        accessCode: { type: String, required: true, unique: true, trim: true },
        name: { type: String, required: true, trim: true },
        photoUrl: { type: String, trim: true, default: "" },
        galleryImages: { type: [String], default: [] },
        address: { type: String, trim: true, default: "" },
        city: { type: String, trim: true, default: "" },
        state: { type: String, trim: true, default: "" },
        pincode: { type: String, trim: true, default: "" },
        contact: { type: String, trim: true, default: "" },
        email: { type: String, trim: true, lowercase: true, default: "" },
        roomSetup: {
            totalRooms: { type: Number, default: 0 },
            totalBeds: { type: Number, default: 0 },
            bedsPerRoom: { type: Number, default: 0 },
            roomTypes: { type: [String], default: [] }
        },
        pricing: {
            singleSharing: { type: Number, min: 1, max: 10000000, default: null },
            doubleSharing: { type: Number, min: 1, max: 10000000, default: null },
            tripleSharing: { type: Number, min: 1, max: 10000000, default: null },
            fourSharing: { type: Number, min: 1, max: 10000000, default: null },
            securityDeposit: { type: Number, min: 0, max: 10000000, default: null },
            messCharges: { type: Number, min: 0, max: 10000000, default: null },
            messIncluded: { type: Boolean, default: null }
        },
        paymentSettings: {
            upiId: { type: String, trim: true, default: "" },
            payeeName: { type: String, trim: true, default: "" }
        },
        ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE", index: true },
        isDeleted: { type: Boolean, default: false, index: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Hostel", hostelSchema);
