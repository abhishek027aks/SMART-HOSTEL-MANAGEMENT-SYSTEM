const { createHash, randomBytes } = require("node:crypto");
const ROLES = require("../constants/roles");
const Student = require("../models/Student");
const GateQrToken = require("../models/GateQrToken");
const EntryExit = require("../models/EntryExit");

const QR_LIFETIME_MS = 60_000;

const httpError = (statusCode, message) =>
    Object.assign(new Error(message), { statusCode });

const hashToken = (token) =>
    createHash("sha256").update(token, "utf8").digest("hex");

const requireHostel = (req) => {
    if (!req.tenant?.hostelId) {
        throw httpError(403, "A verified hostel context is required.");
    }
    return String(req.tenant.hostelId);
};

const issueForCurrentStudent = async (req, now = new Date()) => {
    if (req.auth?.role !== ROLES.STUDENT) {
        throw httpError(403, "Only a student can request their QR token.");
    }

    const hostelId = requireHostel(req);

    const student = await Student.findOne({
        userId: req.auth.id,
        hostelId,
        status: "ACTIVE",
        isDeleted: { $ne: true }
    }).select("_id studentId").lean();

    if (!student) {
        throw httpError(404, "Active student record not found.");
    }

    // Each refresh invalidates all previously issued, unused QR tokens
    // for this student and hostel.
    await GateQrToken.updateMany(
        {
            hostelId,
            studentRecordId: student._id,
            consumedAt: null,
            revokedAt: null
        },
        { $set: { revokedAt: now } }
    );

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + QR_LIFETIME_MS);

    await GateQrToken.create({
        hostelId,
        studentRecordId: student._id,
        issuedByUserId: req.auth.id,
        tokenHash: hashToken(token),
        expiresAt,
        consumedAt: null,
        revokedAt: null
    });

    // Return the raw token once to the authenticated student.
    // Only its hash is persisted in MongoDB.
    return {
        token,
        expiresAt,
        expiresInSeconds: QR_LIFETIME_MS / 1000
    };
};

const consumeForGate = async (req, body, now = new Date()) => {
    if (![ROLES.GUARD, ROLES.WARDEN].includes(req.auth?.role)) {
        throw httpError(403, "Only authorized gate staff can scan student QR codes.");
    }

    const hostelId = requireHostel(req);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw httpError(400, "A JSON object is required.");
    }

    const unknown = Object.keys(body).filter(
        (key) => !["token", "type"].includes(key)
    );
    if (unknown.length) {
        throw httpError(400, `Unsupported field: ${unknown[0]}.`);
    }

    if (typeof body.token !== "string" ||
        !/^[A-Za-z0-9_-]{43}$/.test(body.token)) {
        throw httpError(400, "A valid QR token is required.");
    }

    if (!["ENTRY", "EXIT"].includes(body.type)) {
        throw httpError(400, "type must be ENTRY or EXIT.");
    }

    const tokenHash = hashToken(body.token);

    // Scope lookup to the guard's verified hostel and require an
    // unexpired, unused, unrevoked token.
    const tokenRecord = await GateQrToken.findOne({
        tokenHash,
        hostelId,
        expiresAt: { $gt: now },
        consumedAt: null,
        revokedAt: null
    }).select("_id hostelId studentRecordId expiresAt").lean();

    if (!tokenRecord) {
        throw httpError(409, "QR token is expired, revoked, already used, or not valid for this hostel.");
    }

    const student = await Student.findOne({
        _id: tokenRecord.studentRecordId,
        hostelId,
        status: "ACTIVE",
        isDeleted: { $ne: true }
    }).select("_id studentId name").lean();

    if (!student) {
        await GateQrToken.updateOne(
            { _id: tokenRecord._id, consumedAt: null, revokedAt: null },
            { $set: { revokedAt: now } }
        );
        throw httpError(409, "This QR token is no longer valid for an active student.");
    }

    // Atomic claim: only one concurrent scan can consume this token.
    const claimed = await GateQrToken.findOneAndUpdate(
        {
            _id: tokenRecord._id,
            hostelId,
            expiresAt: { $gt: now },
            consumedAt: null,
            revokedAt: null
        },
        { $set: { consumedAt: now } },
        { new: true }
    );

    if (!claimed) {
        throw httpError(409, "QR token has already been used or is no longer valid.");
    }

    // Fail closed if writing the event fails: this QR remains consumed.
    const entryExit = await EntryExit.create({
        hostelId,
        studentId: student._id,
        type: body.type,
        gate: "Main Gate",
        recordedAt: now,
        isDeleted: false
    });

    return {
        entryExit: {
            id: String(entryExit._id),
            type: entryExit.type,
            gate: entryExit.gate,
            recordedAt: entryExit.recordedAt
        },
        student: {
            id: String(student._id),
            studentId: student.studentId,
            name: student.name
        }
    };
};

module.exports = {
    QR_LIFETIME_MS,
    consumeForGate,
    hashToken,
    httpError,
    issueForCurrentStudent
};
