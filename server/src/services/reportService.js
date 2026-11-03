const Student = require("../models/Student");
const Room = require("../models/Room");
const Bed = require("../models/Bed");
const EntryExit = require("../models/EntryExit");
const Outpass = require("../models/Outpass");
const Complaint = require("../models/Complaint");
const FeePayment = require("../models/FeePayment");
const hostelScope = require("../utils/hostelScope");

const active = { isDeleted: { $ne: true } };
const TYPES = Object.freeze({
    students: { model: Student, fields: ["studentId", "name", "email", "mobile", "status", "createdAt"] },
    rooms: { model: Room, fields: ["roomNumber", "roomType", "airConditioning", "customRoomDescription", "capacity", "status", "createdAt"] },
    beds: { model: Bed, fields: ["bedNumber", "status", "createdAt"] },
    gate: { model: EntryExit, fields: ["type", "gate", "recordedAt", "createdAt"], populate: { path: "studentId", select: "studentId name" } },
    outpasses: { model: Outpass, fields: ["requestType", "reason", "destination", "startAt", "expectedReturnAt", "status", "createdAt"], populate: { path: "studentId", select: "studentId name" } },
    complaints: { model: Complaint, fields: ["title", "category", "priority", "status", "statusNote", "createdAt"], populate: { path: "studentId", select: "studentId name" } },
    fees: { model: FeePayment, fields: ["title", "amount", "currency", "dueDate", "status", "receiptNumber", "paidAt", "createdAt"], populate: { path: "studentId", select: "studentId name" } }
});

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const formatValue = (value) => value instanceof Date ? value.toISOString() : value && typeof value === "object" ? value.studentId ? `${value.studentId} - ${value.name || ""}` : "" : value;

const list = async (req, type) => {
    const config = TYPES[type];
    if (!config) throw httpError(404, "Report type not found.");
    const query = config.model.find(hostelScope(req, active)).select(config.fields.join(" ")).sort({ createdAt: -1, _id: -1 }).limit(10000);
    if (config.populate) query.populate(config.populate);
    const records = await query.lean();
    const headers = config.populate ? ["student", ...config.fields] : config.fields;
    const rows = records.map((record) => headers.map((field) => field === "student" ? formatValue(record.studentId) : formatValue(record[field])));
    return { type, headers, rows, total: rows.length };
};

const summary = async (req) => {
    const base = hostelScope(req, active);
    const [students, rooms, beds, gate, outpasses, complaints, fees] = await Promise.all([
        Student.countDocuments(base), Room.countDocuments(base), Bed.countDocuments(base), EntryExit.countDocuments(base), Outpass.countDocuments(base), Complaint.countDocuments(base), FeePayment.countDocuments(base)
    ]);
    return { students, rooms, beds, gate, outpasses, complaints, fees };
};

const csv = async (req, type) => {
    const report = await list(req, type);
    return { filename: `shms-${type}-${new Date().toISOString().slice(0, 10)}.csv`, content: [report.headers, ...report.rows].map((row) => row.map(csvCell).join(",")).join("\r\n") };
};

module.exports = { csv, httpError, list, summary, TYPES };
