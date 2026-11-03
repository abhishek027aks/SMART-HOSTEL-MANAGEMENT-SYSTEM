const mongoose = require("mongoose");
const HelpContact = require("../models/HelpContact");

const CATEGORIES = ["WARDEN", "SECURITY", "HOSTEL_OFFICE", "EMERGENCY", "OTHER"];
const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const text = (value, maximum) => typeof value === "string" ? value.trim().slice(0, maximum) : "";

const fields = (body = {}) => {
    const category = text(body.category, 30).toUpperCase();
    const name = text(body.name, 120);
    const phone = text(body.phone, 30);
    const email = text(body.email, 180).toLowerCase();
    const description = text(body.description, 500);
    if (!CATEGORIES.includes(category)) throw httpError(400, "Select a valid contact category.");
    if (name.length < 2) throw httpError(400, "Contact name must be at least 2 characters.");
    if (phone.length < 5) throw httpError(400, "Enter a valid contact phone number.");
    if (email && !/^\S+@\S+\.\S+$/.test(email)) throw httpError(400, "Enter a valid contact email address.");
    return { category, name, phone, email, description };
};

const list = async (req) => ({ items: await HelpContact.find({ hostelId: req.tenant.hostelId, isDeleted: { $ne: true }, isActive: true }).sort({ category: 1, name: 1 }).lean() });
const manageList = async (req) => ({ items: await HelpContact.find({ hostelId: req.tenant.hostelId, isDeleted: { $ne: true } }).sort({ isActive: -1, category: 1, name: 1 }).lean() });
const create = async (req) => HelpContact.create({ hostelId: req.tenant.hostelId, createdBy: req.auth.id, ...fields(req.body) });
const update = async (req) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw httpError(400, "Invalid help contact identifier.");
    const contact = await HelpContact.findOne({ _id: req.params.id, hostelId: req.tenant.hostelId, isDeleted: { $ne: true } });
    if (!contact) throw httpError(404, "Help contact not found in this hostel.");
    Object.assign(contact, fields(req.body));
    if (typeof req.body?.isActive === "boolean") contact.isActive = req.body.isActive;
    return contact.save();
};
const archive = async (req) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw httpError(400, "Invalid help contact identifier.");
    const contact = await HelpContact.findOne({ _id: req.params.id, hostelId: req.tenant.hostelId, isDeleted: { $ne: true } });
    if (!contact) throw httpError(404, "Help contact not found in this hostel.");
    contact.isDeleted = true;
    contact.isActive = false;
    await contact.save();
    return { id: String(contact._id) };
};

module.exports = { CATEGORIES, archive, create, httpError, list, manageList, update };
