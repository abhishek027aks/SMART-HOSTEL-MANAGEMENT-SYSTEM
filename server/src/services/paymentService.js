const mongoose = require("mongoose");
const path = require("node:path");
const { mkdir, writeFile } = require("node:fs/promises");
const { randomUUID, randomBytes } = require("node:crypto");

const FeePayment = require("../models/FeePayment");
const Student = require("../models/Student");
const Parent = require("../models/Parent");
const Hostel = require("../models/Hostel");
const { UPLOAD_ROOT, validPhoto } = require("../middleware/photoUpload");
const ROLES = require("../constants/roles");

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const active = { isDeleted: { $ne: true }, status: "ACTIVE" };

const safeRecord = (record) => {
    const item = { ...record, proofAvailable: Boolean(record.proofFilename) };
    delete item.proofFilename;
    return item;
};

const canAccessStudent = async (req, studentId) => {
    const hostelId = req.tenant.hostelId;

    if (req.auth.role === ROLES.STUDENT) {
        return Boolean(await Student.exists({
            _id: studentId,
            userId: req.auth.id,
            hostelId,
            ...active
        }));
    }

    if (req.auth.role === ROLES.PARENT) {
        return Boolean(await Parent.exists({
            userId: req.auth.id,
            hostelId,
            studentIds: studentId,
            ...active
        }));
    }

    return [ROLES.OWNER, ROLES.WARDEN, ROLES.SYSTEM_ADMIN].includes(req.auth.role);
};

const findPayment = async (req) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        throw httpError(400, "Invalid fee payment identifier.");
    }

    const payment = await FeePayment.findOne({
        _id: req.params.id,
        hostelId: req.tenant.hostelId
    });

    if (!payment) throw httpError(404, "Fee record not found.");

    if (![ROLES.OWNER, ROLES.WARDEN, ROLES.SYSTEM_ADMIN].includes(req.auth.role)) {
        const allowed = await canAccessStudent(req, payment.studentId);
        if (!allowed) throw httpError(404, "Fee record not found for this account.");
    }

    return payment;
};

const listMine = async (req) => {
    let studentIds = [];

    if (req.auth.role === ROLES.STUDENT) {
        const student = await Student.findOne({
            userId: req.auth.id,
            hostelId: req.tenant.hostelId,
            ...active
        }).select("_id").lean();

        if (!student) throw httpError(404, "Active student profile not found.");
        studentIds = [student._id];
    } else if (req.auth.role === ROLES.PARENT) {
        const parent = await Parent.findOne({
            userId: req.auth.id,
            hostelId: req.tenant.hostelId,
            ...active
        }).select("studentIds").lean();

        if (!parent) throw httpError(404, "Active parent profile not found.");
        studentIds = parent.studentIds || [];
    } else {
        throw httpError(403, "This portal is only available to students and parents.");
    }

    const [payments, hostel] = await Promise.all([
        FeePayment.find({
            hostelId: req.tenant.hostelId,
            studentId: { $in: studentIds }
        })
            .populate("studentId", "name studentId")
            .sort({ createdAt: -1 })
            .limit(200)
            .lean(),
        Hostel.findOne({
            _id: req.tenant.hostelId,
            isDeleted: { $ne: true }
        }).select("name paymentSettings").lean()
    ]);

    return {
        items: payments.map(safeRecord),
        hostelName: hostel?.name || "Hostel",
        paymentSettings: {
            upiId: hostel?.paymentSettings?.upiId || "",
            payeeName: hostel?.paymentSettings?.payeeName || hostel?.name || ""
        }
    };
};

const listAll = async (req) => {
    const payments = await FeePayment.find({ hostelId: req.tenant.hostelId })
        .populate("studentId", "name studentId")
        .sort({ createdAt: -1 })
        .limit(500)
        .lean();

    return { items: payments.map(safeRecord) };
};

const createInvoice = async (req) => {
    const body = req.body || {};

    if (!mongoose.isValidObjectId(body.studentId)) {
        throw httpError(400, "Select a valid student.");
    }

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const amount = Number(body.amount);

    if (!title || title.length > 120) throw httpError(400, "Fee title is required and must be at most 120 characters.");
    if (description.length > 500) throw httpError(400, "Description must be at most 500 characters.");
    if (!Number.isFinite(amount) || amount < 0.01 || amount > 10000000) {
        throw httpError(400, "Enter a valid fee amount in INR.");
    }

    let dueDate = null;
    if (body.dueDate) {
        dueDate = new Date(body.dueDate);
        if (!Number.isFinite(dueDate.getTime())) throw httpError(400, "Enter a valid due date.");
    }

    const student = await Student.findOne({
        _id: body.studentId,
        hostelId: req.tenant.hostelId,
        ...active
    }).select("_id").lean();

    if (!student) throw httpError(404, "Active student not found in this hostel.");

    const record = await FeePayment.create({
        hostelId: req.tenant.hostelId,
        studentId: student._id,
        title,
        description,
        amount,
        currency: "INR",
        dueDate,
        createdBy: req.auth.id
    });

    return safeRecord((await FeePayment.findById(record._id)
        .populate("studentId", "name studentId").lean()));
};

const submitPayment = async (req) => {
    const payment = await findPayment(req);

    if (!["DUE", "REJECTED"].includes(payment.status)) {
        throw httpError(409, "This fee is already submitted or paid.");
    }

    const method = typeof req.body.paymentMethod === "string"
        ? req.body.paymentMethod.trim().toUpperCase()
        : "";
    if (!["UPI", "BANK_TRANSFER", "CASH"].includes(method)) {
        throw httpError(400, "Select UPI, bank transfer, or cash.");
    }

    const reference = typeof req.body.transactionReference === "string"
        ? req.body.transactionReference.trim()
        : "";

    if (reference.length > 100) throw httpError(400, "Transaction reference must be at most 100 characters.");
    if (["UPI", "BANK_TRANSFER"].includes(method) && !reference) {
        throw httpError(400, "Enter the UTR or transaction reference.");
    }

    if (req.file && !validPhoto(req.file.mimetype, req.file.buffer)) {
        throw httpError(400, "The uploaded proof is not a valid JPEG, PNG, or WEBP image.");
    }
    if (["UPI", "BANK_TRANSFER"].includes(method) && !req.file) {
        throw httpError(400, "Upload the payment screenshot for verification.");
    }

    if (reference) {
        const duplicate = await FeePayment.exists({
            hostelId: req.tenant.hostelId,
            transactionReference: reference,
            _id: { $ne: payment._id },
            status: { $in: ["PENDING_VERIFICATION", "PAID"] }
        });
        if (duplicate) throw httpError(409, "This transaction reference is already used by another fee record.");
    }

    if (req.file) {
        const extensions = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp"
        };
        const directory = path.join(UPLOAD_ROOT, "payment-proofs");
        await mkdir(directory, { recursive: true });

        const filename = `${randomUUID()}.${extensions[req.file.mimetype]}`;
        await writeFile(path.join(directory, filename), req.file.buffer, {
            flag: "wx",
            mode: 0o640
        });
        payment.proofFilename = filename;
    }

    payment.paymentMethod = method;
    payment.transactionReference = reference;
    payment.submittedBy = req.auth.id;
    payment.submittedAt = new Date();
    payment.status = "PENDING_VERIFICATION";
    payment.rejectionReason = "";
    payment.reviewedBy = null;
    payment.reviewedAt = null;
    payment.receiptNumber = "";
    payment.paidAt = null;

    await payment.save();
    return safeRecord((await FeePayment.findById(payment._id)
        .populate("studentId", "name studentId").lean()));
};

const reviewPayment = async (req) => {
    const payment = await findPayment(req);
    const decision = req.body?.decision;

    if (payment.status !== "PENDING_VERIFICATION") {
        throw httpError(409, "Only pending payment submissions can be reviewed.");
    }

    if (decision === "APPROVE") {
        payment.status = "PAID";
        payment.paidAt = new Date();
        payment.receiptNumber = `SHMS-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;
        payment.rejectionReason = "";
    } else if (decision === "REJECT") {
        const reason = typeof req.body.rejectionReason === "string"
            ? req.body.rejectionReason.trim()
            : "";
        if (!reason || reason.length > 500) {
            throw httpError(400, "Enter a rejection reason of up to 500 characters.");
        }

        payment.status = "REJECTED";
        payment.rejectionReason = reason;
        payment.paidAt = null;
        payment.receiptNumber = "";
    } else {
        throw httpError(400, "Decision must be APPROVE or REJECT.");
    }

    payment.reviewedBy = req.auth.id;
    payment.reviewedAt = new Date();
    await payment.save();

    return safeRecord((await FeePayment.findById(payment._id)
        .populate("studentId", "name studentId").lean()));
};

const getProof = async (req) => {
    const payment = await findPayment(req);
    if (!payment.proofFilename) throw httpError(404, "No payment screenshot is attached.");

    if (!/^[a-f\d-]{36}\.(?:jpg|png|webp)$/i.test(payment.proofFilename)) {
        throw httpError(404, "Payment screenshot not found.");
    }

    const extension = path.extname(payment.proofFilename).toLowerCase();
    return {
        filePath: path.join(UPLOAD_ROOT, "payment-proofs", payment.proofFilename),
        contentType: extension === ".jpg" ? "image/jpeg" : extension === ".png" ? "image/png" : "image/webp"
    };
};

module.exports = { createInvoice, getProof, listAll, listMine, reviewPayment, submitPayment, httpError };