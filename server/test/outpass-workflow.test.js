const assert = require("node:assert/strict");
const test = require("node:test");

const Outpass = require("../src/models/Outpass");
const Student = require("../src/models/Student");
const Parent = require("../src/models/Parent");
const service = require("../src/services/outpassService");
const ROLES = require("../src/constants/roles");

const ids = {
    hostel: "64b64c1a1e2c3d4e5f607181",
    studentUser: "64b64c1a1e2c3d4e5f607182",
    parentUser: "64b64c1a1e2c3d4e5f607183",
    wardenUser: "64b64c1a1e2c3d4e5f607184",
    student: "64b64c1a1e2c3d4e5f607185",
    outpass: "64b64c1a1e2c3d4e5f607186"
};

const request = (role, body = {}, id = ids.outpass) => ({
    auth: { id: role === ROLES.PARENT ? ids.parentUser : role === ROLES.WARDEN ? ids.wardenUser : ids.studentUser, role },
    tenant: { hostelId: ids.hostel },
    params: { id },
    query: {},
    body
});

const futurePayload = () => ({
    requestType: "OUTPASS",
    reason: "Personal work",
    destination: "Varanasi",
    startAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    expectedReturnAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
});

async function withOverrides(patches, work) {
    const restorers = [];
    try {
        for (const [target, key, replacement] of patches) {
            const original = target[key];
            target[key] = replacement;
            restorers.push(() => { target[key] = original; });
        }
        return await work();
    } finally {
        restorers.reverse().forEach((restore) => restore());
    }
}

function makeRecord({ status = "PENDING_PARENT", parentReviewStatus = "PENDING" } = {}) {
    return {
        _id: ids.outpass,
        hostelId: ids.hostel,
        studentId: ids.student,
        status,
        parentReviewStatus,
        history: [],
        save: async function () { return this; }
    };
}

test("outpass payload validates request type, reason, destination and date ordering", () => {
    const result = service.validateCreatePayload(futurePayload());
    assert.equal(result.requestType, "OUTPASS");
    assert.equal(result.destination, "Varanasi");
    assert.ok(result.expectedReturnAt > result.startAt);

    assert.throws(
        () => service.validateCreatePayload({ ...futurePayload(), expectedReturnAt: futurePayload().startAt }),
        (error) => error.statusCode === 400
    );
    assert.throws(
        () => service.validateCreatePayload({ ...futurePayload(), reason: "No" }),
        (error) => error.statusCode === 400
    );
});

test("student request starts in Parent review and records submission history", async () => {
    const student = { _id: ids.student };
    const patches = [
        [Student, "findOne", async () => student],
        [Parent, "findOne", async () => ({ _id: "linked-parent" })],
        [Outpass.prototype, "save", async function () { return this; }]
    ];

    await withOverrides(patches, async () => {
        const result = await service.create(request(ROLES.STUDENT, futurePayload()));
        assert.equal(result.status, "PENDING_PARENT");
        assert.equal(result.parentReviewStatus, "PENDING");
        assert.equal(String(result.studentId), ids.student);
        assert.equal(result.history[0].action, "REQUEST_SUBMITTED");
    });
});

test("student cannot submit a request if no active linked Parent account exists", async () => {
    const patches = [
        [Student, "findOne", async () => ({ _id: ids.student })],
        [Parent, "findOne", async () => null]
    ];

    await withOverrides(patches, async () => {
        await assert.rejects(
            service.create(request(ROLES.STUDENT, futurePayload())),
            (error) => error.statusCode === 409
        );
    });
});

test("linked Parent approval moves the request to final review", async () => {
    const record = makeRecord();
    await withOverrides([
        [Outpass, "findOne", async () => record],
        [Parent, "findOne", async () => ({ _id: "linked-parent" })]
    ], async () => {
        const result = await service.parentReview(
            { ...request(ROLES.PARENT, { decision: "APPROVE" }), params: { id: ids.outpass } }
        );
        assert.equal(result.status, "PENDING_FINAL");
        assert.equal(result.parentReviewStatus, "APPROVED");
        assert.equal(result.history[0].action, "PARENT_APPROVED");
    });
});

test("Parent rejection requires a reason and stops the request", async () => {
    const record = makeRecord();
    await withOverrides([
        [Outpass, "findOne", async () => record],
        [Parent, "findOne", async () => ({ _id: "linked-parent" })]
    ], async () => {
        await assert.rejects(
            service.parentReview(request(ROLES.PARENT, { decision: "REJECT" })),
            (error) => error.statusCode === 400
        );

        const result = await service.parentReview(
            request(ROLES.PARENT, { decision: "REJECT", note: "Please discuss this with us." })
        );
        assert.equal(result.status, "REJECTED");
        assert.equal(result.parentReviewStatus, "REJECTED");
        assert.equal(result.history[0].action, "PARENT_REJECTED");
    });
});

test("Warden final approval requires prior Parent approval", async () => {
    const record = makeRecord({ status: "PENDING_FINAL", parentReviewStatus: "APPROVED" });
    await withOverrides([[Outpass, "findOne", async () => record]], async () => {
        const result = await service.finalDecision(
            request(ROLES.WARDEN, { decision: "APPROVE" })
        );
        assert.equal(result.status, "APPROVED");
        assert.equal(result.history[0].action, "FINAL_APPROVED");
    });

    const notReviewed = makeRecord();
    await withOverrides([[Outpass, "findOne", async () => notReviewed]], async () => {
        await assert.rejects(
            service.finalDecision(request(ROLES.WARDEN, { decision: "APPROVE" })),
            (error) => error.statusCode === 409
        );
    });
});

test("Student can confirm return only for their own approved request", async () => {
    const record = makeRecord({ status: "APPROVED", parentReviewStatus: "APPROVED" });
    await withOverrides([
        [Outpass, "findOne", async () => record],
        [Student, "findOne", async () => ({ _id: ids.student })]
    ], async () => {
        const result = await service.confirmReturn(request(ROLES.STUDENT, { note: "Returned to hostel." }));
        assert.equal(result.status, "COMPLETED");
        assert.ok(result.returnedAt instanceof Date);
        assert.equal(String(result.returnedBy), ids.studentUser);
        assert.equal(result.history[0].action, "RETURN_CONFIRMED");
    });
});

test("return cannot be confirmed before final approval", async () => {
    const record = makeRecord({ status: "PENDING_FINAL", parentReviewStatus: "APPROVED" });
    await withOverrides([[Outpass, "findOne", async () => record]], async () => {
        await assert.rejects(
            service.confirmReturn(request(ROLES.STUDENT)),
            (error) => error.statusCode === 409
        );
    });
});