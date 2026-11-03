const MessMenu = require("../models/MessMenu");
const MessReview = require("../models/MessReview");
const Student = require("../models/Student");
const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const text = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
const dateOk = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "") && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
const meal = (value) => {
    const name = text(value?.name, 120);
    const items = Array.isArray(value?.items) ? value.items.map((item) => text(item, 100)).filter(Boolean).slice(0, 20) : [];
    return { name, items };
};
const saveMenu = async (req) => {
    const menuDate = text(req.body?.menuDate, 10);
    if (!dateOk(menuDate)) throw httpError(400, "Select a valid menu date.");
    const update = { breakfast: meal(req.body?.breakfast), lunch: meal(req.body?.lunch), dinner: meal(req.body?.dinner), createdBy: req.auth.id, isDeleted: false };
    return MessMenu.findOneAndUpdate({ hostelId: req.tenant.hostelId, menuDate }, { $set: update, $setOnInsert: { hostelId: req.tenant.hostelId, menuDate } }, { new: true, upsert: true, runValidators: true });
};
const list = async (req) => {
    const from = dateOk(req.query.from) ? req.query.from : new Date().toISOString().slice(0, 10);
    const to = dateOk(req.query.to) ? req.query.to : new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);
    if (from > to) throw httpError(400, "The menu date range is invalid.");
    return { items: await MessMenu.find({ hostelId: req.tenant.hostelId, menuDate: { $gte: from, $lte: to }, isDeleted: { $ne: true } }).sort({ menuDate: 1 }).lean() };
};
const review = async (req) => {
    const rating = Number(req.body?.rating); if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw httpError(400, "Rating must be between 1 and 5.");
    const menu = await MessMenu.findOne({ _id: req.params.id, hostelId: req.tenant.hostelId, isDeleted: { $ne: true } }); if (!menu) throw httpError(404, "Menu not found in this hostel.");
    const student = await Student.findOne({ userId: req.auth.id, hostelId: req.tenant.hostelId, status: "ACTIVE", isDeleted: { $ne: true } }).select("_id").lean(); if (!student) throw httpError(404, "Active student profile not found.");
    return MessReview.findOneAndUpdate({ hostelId: req.tenant.hostelId, menuId: menu._id, studentId: student._id }, { $set: { rating, comment: text(req.body?.comment, 500) } }, { new: true, upsert: true, runValidators: true });
};
module.exports = { httpError, list, review, saveMenu };
