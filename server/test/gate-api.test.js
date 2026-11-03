process.env.JWT_SECRET = process.env.JWT_SECRET ||
    "gate-api-test-secret-with-at-least-32-bytes";

const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");

const config = require("../src/config");
const app = require("../src/app");
const ROLES = require("../src/constants/roles");
const { signAccessToken } = require("../src/utils/token");

const User = require("../src/models/User");
const Hostel = require("../src/models/Hostel");
const HostelMembership = require("../src/models/HostelMembership");
const Student = require("../src/models/Student");
const GateQrToken = require("../src/models/GateQrToken");
const EntryExit = require("../src/models/EntryExit");

const hostelA = "64b64c1a1e2c3d4e5f607182";
const hostelB = "64b64c1a1e2c3d4e5f607183";
const studentRecordId = "64b64c1a1e2c3d4e5f607184";

const studentUserId = "gate-api-student";
const guardUserId = "gate-api-guard";
const wardenUserId = "gate-api-warden";

const users = new Map([
    [studentUserId, {
        _id: studentUserId,
        name: "Gate API Student",
        email: "gate-student@example.invalid",
        mobile: "",
        photoUrl: "",
        role: ROLES.STUDENT,
        hostelId: hostelA,
        status: "ACTIVE",
        isDeleted: false
    }],
    [guardUserId, {
        _id: guardUserId,
        name: "Gate API Guard",
        email: "gate-guard@example.invalid",
        mobile: "",
        photoUrl: "",
        role: ROLES.GUARD,
        hostelId: hostelA,
        status: "ACTIVE",
        isDeleted: false
    }],
    [wardenUserId, {
        _id: wardenUserId,
        name: "Gate API Warden",
        email: "gate-warden@example.invalid",
        mobile: "",
        photoUrl: "",
        role: ROLES.WARDEN,
        hostelId: hostelA,
        status: "ACTIVE",
        isDeleted: false
    }]
]);

const studentRecord = {
    _id: studentRecordId,
    hostelId: hostelA,
    userId: studentUserId,
    studentId: "STU-GATE-101",
    name: "Gate Test Student",
    status: "ACTIVE",
    isDeleted: false
};

const memberships = new Map([
    [studentUserId, [hostelA]],
    [guardUserId, [hostelA, hostelB]],
    [wardenUserId, [hostelA]]
]);

const originals = {
    userFindById: User.findById,
    hostelFind: Hostel.find,
    membershipFind: HostelMembership.find,
    studentFindOne: Student.findOne,
    tokenUpdateMany: GateQrToken.updateMany,
    tokenCreate: GateQrToken.create,
    tokenFindOne: GateQrToken.findOne,
    tokenFindOneAndUpdate: GateQrToken.findOneAndUpdate,
    tokenUpdateOne: GateQrToken.updateOne,
    entryCreate: EntryExit.create
};

let tokenRecords = [];
let entryRecords = [];
let activeStudent = true;
let generatedId = 0;

const makeQuery = (resolve) => ({
    select() { return this; },
    lean: async () => typeof resolve === "function" ? resolve() : resolve
});

const same = (left, right) => String(left) === String(right);

const matches = (record, filter) => {
    if (!record) return false;

    for (const [key, expected] of Object.entries(filter)) {
        if (key === "expiresAt") {
            if (!(new Date(record.expiresAt).getTime() >
                  new Date(expected.$gt).getTime())) return false;
        } else if (key === "consumedAt" || key === "revokedAt") {
            if ((record[key] ?? null) !== expected) return false;
        } else if (!same(record[key], expected)) {
            return false;
        }
    }

    return true;
};

const setupMocks = () => {
    tokenRecords = [];
    entryRecords = [];
    activeStudent = true;
    generatedId = 0;

    User.findById = (id) =>
        makeQuery(users.get(String(id)) || null);

    HostelMembership.find = (filter) => {
        const user = users.get(String(filter.userId));
        const ids = user && user.role === filter.role
            ? (memberships.get(String(filter.userId)) || [])
            : [];

        return makeQuery(ids.map((hostelId) => ({ hostelId })));
    };

    Hostel.find = (filter) => {
        const requestedIds = (filter._id?.$in || []).map(String);
        const activeIds = [hostelA, hostelB].filter((id) =>
            requestedIds.includes(id)
        );

        return makeQuery(activeIds.map((_id) => ({ _id })));
    };

    Student.findOne = (filter) => makeQuery(() => {
        if (!activeStudent) return null;

        if (filter.userId) {
            if (same(filter.userId, studentUserId) &&
                same(filter.hostelId, hostelA)) {
                return { ...studentRecord };
            }
            return null;
        }

        if (filter._id &&
            same(filter._id, studentRecordId) &&
            same(filter.hostelId, hostelA)) {
            return { ...studentRecord };
        }

        return null;
    });

    GateQrToken.updateMany = async (filter, update) => {
        let modifiedCount = 0;

        for (const record of tokenRecords) {
            if (matches(record, filter)) {
                Object.assign(record, update.$set);
                modifiedCount++;
            }
        }

        return { modifiedCount };
    };

    GateQrToken.create = async (document) => {
        const record = {
            _id: `gate-token-${++generatedId}`,
            ...document
        };
        tokenRecords.push(record);
        return record;
    };

    GateQrToken.findOne = (filter) => ({
        select() { return this; },
        lean: async () => {
            const record = tokenRecords.find((item) => matches(item, filter));
            return record ? { ...record } : null;
        }
    });

    GateQrToken.findOneAndUpdate = async (filter, update) => {
        const record = tokenRecords.find((item) => matches(item, filter));
        if (!record) return null;

        Object.assign(record, update.$set);
        return { ...record };
    };

    GateQrToken.updateOne = async (filter, update) => {
        const record = tokenRecords.find((item) => matches(item, filter));

        if (record) Object.assign(record, update.$set);

        return { modifiedCount: record ? 1 : 0 };
    };

    EntryExit.create = async (document) => {
        const record = {
            _id: `gate-event-${entryRecords.length + 1}`,
            ...document
        };
        entryRecords.push(record);
        return record;
    };
};

const makeToken = (userId, role, hostelId) => signAccessToken({
    id: userId,
    role,
    hostelId
}, config.jwtSecret);

test("gate QR API enforces authentication, roles, single use, and tenant scope", async () => {
    config.validateAuthConfig();
    setupMocks();

    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");

    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const studentToken = makeToken(studentUserId, ROLES.STUDENT, hostelA);
    const guardToken = makeToken(guardUserId, ROLES.GUARD, hostelA);
    const wardenToken = makeToken(wardenUserId, ROLES.WARDEN, hostelA);

    const post = async (path, {
        token,
        body = {},
        hostelId
    } = {}) => {
        const headers = { "Content-Type": "application/json" };

        if (token) headers.Authorization = `Bearer ${token}`;
        if (hostelId) headers["x-hostel-id"] = hostelId;

        return fetch(`${baseUrl}${path}`, {
            method: "POST",
            headers,
            body: JSON.stringify(body)
        });
    };

    try {
        const anonymous = await post("/api/gate/qr-token");
        assert.equal(anonymous.status, 401);

        const wardenIssue = await post("/api/gate/qr-token", {
            token: wardenToken
        });
        assert.equal(wardenIssue.status, 403);
        console.log("PASS: anonymous and wrong-role QR requests rejected");

        const studentIssue = await post("/api/gate/qr-token", {
            token: studentToken
        });
        assert.equal(studentIssue.status, 201);
        assert.match(studentIssue.headers.get("cache-control") || "", /no-store/i);

        const issuePayload = await studentIssue.json();
        const rawQrToken = issuePayload.data.token;

        assert.match(rawQrToken, /^[A-Za-z0-9_-]{43}$/);
        assert.equal(tokenRecords.length, 1);
        assert.notEqual(tokenRecords[0].tokenHash, rawQrToken);
        console.log("PASS: student receives a short-lived QR token; raw token is not stored");

        const studentScan = await post("/api/gate/scan", {
            token: studentToken,
            body: { token: rawQrToken, type: "ENTRY" }
        });
        assert.equal(studentScan.status, 403);

        const guardEntry = await post("/api/gate/scan", {
            token: guardToken,
            body: { token: rawQrToken, type: "ENTRY" }
        });

        assert.equal(guardEntry.status, 201);
        const entryPayload = await guardEntry.json();
        assert.equal(entryPayload.data.entryExit.type, "ENTRY");
        assert.equal(entryRecords.length, 1);
        assert.equal(String(entryRecords[0].hostelId), hostelA);
        assert.equal(String(entryRecords[0].studentId), studentRecordId);
        assert.ok(tokenRecords[0].consumedAt instanceof Date);
        console.log("PASS: Guard scan creates a hostel-scoped ENTRY event");

        const replay = await post("/api/gate/scan", {
            token: guardToken,
            body: { token: rawQrToken, type: "EXIT" }
        });

        assert.equal(replay.status, 409);
        assert.equal(entryRecords.length, 1);
        console.log("PASS: replayed QR cannot create a second gate event");

        const invalidType = await post("/api/gate/scan", {
            token: guardToken,
            body: { token: "A".repeat(43), type: "UNKNOWN" }
        });
        assert.equal(invalidType.status, 400);

        const extraField = await post("/api/gate/scan", {
            token: guardToken,
            body: {
                token: "A".repeat(43),
                type: "ENTRY",
                hostelId: hostelB
            }
        });
        assert.equal(extraField.status, 400);
        console.log("PASS: unsupported scan fields and invalid event types rejected");

        const refreshCandidate = await post("/api/gate/qr-token", {
            token: studentToken
        });
        assert.equal(refreshCandidate.status, 201);
        const candidateHash = tokenRecords[tokenRecords.length - 1].tokenHash;

        const refresh = await post("/api/gate/qr-token", {
            token: studentToken
        });
        assert.equal(refresh.status, 201);

        const refreshedPayload = await refresh.json();
        const refreshedQr = refreshedPayload.data.token;
        const candidateRecord = tokenRecords.find(
            (item) => item.tokenHash === candidateHash
        );

        assert.ok(candidateRecord?.revokedAt instanceof Date);
        console.log("PASS: refreshing a pending QR revokes the previous QR");

        const wrongHostel = await post("/api/gate/scan", {
            token: guardToken,
            hostelId: hostelB,
            body: { token: refreshedQr, type: "ENTRY" }
        });

        assert.equal(wrongHostel.status, 409);
        assert.equal(entryRecords.length, 1);
        console.log("PASS: QR from another hostel is rejected");

        const validExit = await post("/api/gate/scan", {
            token: guardToken,
            body: { token: refreshedQr, type: "EXIT" }
        });

        assert.equal(validExit.status, 201);
        assert.equal(entryRecords.length, 2);
        assert.equal(entryRecords[1].type, "EXIT");
        console.log("PASS: valid EXIT event is recorded");

        const reuseAfterExit = await post("/api/gate/scan", {
            token: guardToken,
            body: { token: refreshedQr, type: "EXIT" }
        });
        assert.equal(reuseAfterExit.status, 409);
        assert.equal(entryRecords.length, 2);

        activeStudent = false;
        const inactiveIssue = await post("/api/gate/qr-token", {
            token: studentToken
        });
        assert.equal(inactiveIssue.status, 401);
        console.log("PASS: inactive or missing student cannot obtain a QR");

        console.log("GATE API SECURITY TEST: PASS");
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });

        User.findById = originals.userFindById;
        Hostel.find = originals.hostelFind;
        HostelMembership.find = originals.membershipFind;
        Student.findOne = originals.studentFindOne;
        GateQrToken.updateMany = originals.tokenUpdateMany;
        GateQrToken.create = originals.tokenCreate;
        GateQrToken.findOne = originals.tokenFindOne;
        GateQrToken.findOneAndUpdate = originals.tokenFindOneAndUpdate;
        GateQrToken.updateOne = originals.tokenUpdateOne;
        EntryExit.create = originals.entryCreate;
    }
});
