const { test } = require("node:test");
const assert = require("node:assert/strict");

const mongoose = require("mongoose");
const User = require("../src/models/User");
const Student = require("../src/models/Student");
const Parent = require("../src/models/Parent");
const HostelMembership = require("../src/models/HostelMembership");
const ROLES = require("../src/constants/roles");
const { verifyPassword } = require("../src/utils/password");
const service = require("../src/services/parentService");

const hostelId = "64b64c1a1e2c3d4e5f607181";
const actorId = "64b64c1a1e2c3d4e5f607182";
const studentId = "64b64c1a1e2c3d4e5f607183";
const password = "ParentTestPass123!";

function replaceMethod(target, name, replacement, restoreList) {
    const descriptor = Object.getOwnPropertyDescriptor(target, name);

    Object.defineProperty(target, name, {
        configurable: true,
        enumerable: descriptor?.enumerable ?? false,
        writable: true,
        value: replacement
    });

    restoreList.push(() => {
        if (descriptor) Object.defineProperty(target, name, descriptor);
        else delete target[name];
    });
}

function createHarness({ existingUser = null, validStudents } = {}) {
    const restoreList = [];
    const state = {
        users: [],
        parents: [],
        memberships: [],
        transactionCount: 0,
        ended: false,
        session: null,
        userFilter: null,
        userQuerySession: null,
        userSelectedFields: null,
        studentFilter: null,
        studentQuerySession: null,
        studentSelectedFields: null
    };

    const session = {
        withTransaction: async (callback) => {
            state.transactionCount += 1;
            return callback();
        },
        endSession: async () => {
            state.ended = true;
        }
    };
    state.session = session;

    const activeStudents = validStudents === undefined
        ? [{ _id: new mongoose.Types.ObjectId(studentId) }]
        : validStudents;

    replaceMethod(mongoose, "startSession", async () => session, restoreList);

    replaceMethod(User, "findOne", (filter) => {
        state.userFilter = filter;
        return {
            session(passedSession) {
                state.userQuerySession = passedSession;
                return this;
            },
            select(fields) {
                state.userSelectedFields = fields;
                return Promise.resolve(existingUser);
            }
        };
    }, restoreList);

    replaceMethod(Student, "find", (filter) => {
        state.studentFilter = filter;
        const query = {
            select(fields) {
                state.studentSelectedFields = fields;
                return this;
            },
            session(passedSession) {
                state.studentQuerySession = passedSession;
                return this;
            },
            then(resolve, reject) {
                return Promise.resolve(activeStudents).then(resolve, reject);
            }
        };
        return query;
    }, restoreList);

    replaceMethod(User.prototype, "save", async function (options = {}) {
        state.users.push(this);
        this.__testSaveSession = options.session || null;
        return this;
    }, restoreList);

    replaceMethod(Parent.prototype, "save", async function (options = {}) {
        state.parents.push(this);
        this.__testSaveSession = options.session || null;
        return this;
    }, restoreList);

    replaceMethod(HostelMembership.prototype, "save", async function (options = {}) {
        state.memberships.push(this);
        this.__testSaveSession = options.session || null;
        return this;
    }, restoreList);

    return {
        state,
        restore() {
            for (const restore of restoreList.reverse()) restore();
        }
    };
}

function parentBody(extra = {}) {
    return {
        parentId: "PARENT-TEST-001",
        name: "Test Parent",
        email: "Parent.Test@example.com",
        mobile: "9876501200",
        relationship: "FATHER",
        studentIds: [studentId],
        password,
        status: "ACTIVE",
        ...extra
    };
}

function request(body, role = ROLES.OWNER) {
    return {
        body,
        tenant: { hostelId },
        auth: { id: actorId, name: "Test Admin", role }
    };
}

test("parent validation rejects short passwords, unsupported fields and duplicate student IDs", () => {
    assert.throws(
        () => service.validate(parentBody({ password: "short" })),
        { statusCode: 400 }
    );

    assert.throws(
        () => service.validate(parentBody({ hostelId: "foreign-hostel" })),
        { statusCode: 400 }
    );

    assert.throws(
        () => service.validate(parentBody({
            studentIds: [studentId, studentId]
        })),
        { statusCode: 400 }
    );

    assert.throws(
        () => service.validate(parentBody({ relationship: "OWNER" })),
        { statusCode: 400 }
    );

    assert.throws(
        () => service.validate(parentBody({ email: "", mobile: "" })),
        { statusCode: 400 }
    );
});

test("parent account creates User, Parent and membership in one transaction with hashed password", async () => {
    const harness = createHarness();

    try {
        const result = await service.create(request(parentBody()));
        const { state } = harness;

        assert.equal(state.transactionCount, 1);
        assert.equal(state.users.length, 1);
        assert.equal(state.parents.length, 1);
        assert.equal(state.memberships.length, 1);
        assert.equal(state.ended, true);

        const user = state.users[0];
        const parent = state.parents[0];
        const membership = state.memberships[0];

        assert.equal(user.role, ROLES.PARENT);
        assert.equal(String(user.hostelId), hostelId);
        assert.equal(user.email, "parent.test@example.com");
        assert.notEqual(user.passwordHash, password);
        assert.equal(await verifyPassword(password, user.passwordHash), true);

        assert.equal(String(parent.userId), String(user._id));
        assert.equal(String(parent.hostelId), hostelId);
        assert.equal(parent.parentId, "PARENT-TEST-001");
        assert.equal(parent.relationship, "FATHER");
        assert.equal(parent.studentIds.length, 1);

        assert.equal(String(membership.userId), String(user._id));
        assert.equal(String(membership.hostelId), hostelId);
        assert.equal(membership.role, ROLES.PARENT);

        for (const record of [user, parent, membership]) {
            assert.equal(record.__testSaveSession, state.session);
        }

        assert.equal(state.userQuerySession, state.session);
        assert.equal(state.userSelectedFields, "_id");
        assert.equal(state.studentQuerySession, state.session);
        assert.deepEqual(state.studentFilter.hostelId, hostelId);
        assert.equal(state.studentFilter.status, "ACTIVE");

        assert.equal(result.loginAccountCreated, true);
        assert.equal(result.parentId, "PARENT-TEST-001");
        assert.equal(Object.hasOwn(result, "password"), false);
        assert.equal(Object.hasOwn(result, "passwordHash"), false);
    } finally {
        harness.restore();
    }
});

test("duplicate email or mobile rejects parent creation without saving records", async () => {
    const harness = createHarness({
        existingUser: { _id: new mongoose.Types.ObjectId() }
    });

    try {
        await assert.rejects(
            service.create(request(parentBody())),
            { statusCode: 409 }
        );

        assert.equal(harness.state.users.length, 0);
        assert.equal(harness.state.parents.length, 0);
        assert.equal(harness.state.memberships.length, 0);
        assert.equal(harness.state.ended, true);
    } finally {
        harness.restore();
    }
});

test("Warden cannot create a parent login account", async () => {
    const harness = createHarness();

    try {
        await assert.rejects(
            service.create(request(parentBody(), ROLES.WARDEN)),
            { statusCode: 403 }
        );

        assert.equal(harness.state.transactionCount, 0);
        assert.equal(harness.state.users.length, 0);
        assert.equal(harness.state.parents.length, 0);
        assert.equal(harness.state.memberships.length, 0);
    } finally {
        harness.restore();
    }
});

test("inactive or foreign-hostel student cannot be linked to parent", async () => {
    const harness = createHarness({ validStudents: [] });

    try {
        await assert.rejects(
            service.create(request(parentBody())),
            { statusCode: 400 }
        );

        assert.equal(harness.state.users.length, 0);
        assert.equal(harness.state.parents.length, 0);
        assert.equal(harness.state.memberships.length, 0);
        assert.equal(harness.state.ended, true);
    } finally {
        harness.restore();
    }
});

test("parent self-profile query is scoped to authenticated user and verified hostel", async () => {
    const restoreList = [];
    const linkedStudent = {
        _id: new mongoose.Types.ObjectId(studentId),
        studentId: "STU-TEST-001",
        name: "Linked Student",
        mobile: "9876501201",
        email: "student@example.com",
        photoUrl: "",
        status: "ACTIVE",
        bedId: null
    };

    let capturedFilter;
    let populateOptions;

    const fakeParent = {
        parentId: "PARENT-TEST-001",
        relationship: "MOTHER",
        studentIds: [linkedStudent]
    };

    replaceMethod(Parent, "findOne", (filter) => {
        capturedFilter = filter;
        return {
            populate(options) {
                populateOptions = options;
                return this;
            },
            lean: async () => fakeParent
        };
    }, restoreList);

    try {
        const result = await service.getMine({
            tenant: { hostelId },
            auth: {
                id: actorId,
                name: "Verified Parent",
                email: "parent@example.com",
                mobile: "9876501200",
                role: ROLES.PARENT
            }
        });

        assert.equal(String(capturedFilter.userId), actorId);
        assert.equal(String(capturedFilter.hostelId), hostelId);
        assert.equal(capturedFilter.status, "ACTIVE");
        assert.equal(populateOptions.match.hostelId, hostelId);
        assert.equal(populateOptions.match.status, "ACTIVE");

        assert.equal(result.parentId, "PARENT-TEST-001");
        assert.equal(result.name, "Verified Parent");
        assert.equal(result.students.length, 1);
        assert.equal(result.students[0].studentId, "STU-TEST-001");
        assert.equal(result.students[0].allocationStatus, "UNALLOCATED");
        assert.equal(Object.hasOwn(result, "passwordHash"), false);
    } finally {
        for (const restore of restoreList.reverse()) restore();
    }
});
