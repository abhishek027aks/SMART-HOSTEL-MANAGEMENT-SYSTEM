const { test } = require("node:test");
const assert = require("node:assert/strict");

const mongoose = require("mongoose");
const User = require("../src/models/User");
const Student = require("../src/models/Student");
const HostelMembership = require("../src/models/HostelMembership");
const ROLES = require("../src/constants/roles");
const { verifyPassword } = require("../src/utils/password");
const studentService = require("../src/services/studentService");

const hostelId = "64b64c1a1e2c3d4e5f607181";
const actorId = "64b64c1a1e2c3d4e5f607182";
const initialPassword = "LongPassPhrase123!";

function replaceMethod(target, name, replacement, restoreList) {
    const descriptor = Object.getOwnPropertyDescriptor(target, name);

    Object.defineProperty(target, name, {
        configurable: true,
        enumerable: descriptor?.enumerable ?? false,
        writable: true,
        value: replacement
    });

    restoreList.push(() => {
        if (descriptor) {
            Object.defineProperty(target, name, descriptor);
        } else {
            delete target[name];
        }
    });
}

function createHarness({ existingUser = null } = {}) {
    const restoreList = [];
    const state = {
        users: [],
        students: [],
        memberships: [],
        transactionCount: 0,
        ended: false,
        queryFilter: null,
        querySession: null,
        selectedFields: null,
        session: null
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

    replaceMethod(mongoose, "startSession", async () => session, restoreList);

    replaceMethod(User, "findOne", (filter) => {
        state.queryFilter = filter;

        return {
            session(passedSession) {
                state.querySession = passedSession;
                return this;
            },
            select(fields) {
                state.selectedFields = fields;
                return Promise.resolve(existingUser);
            }
        };
    }, restoreList);

    replaceMethod(User.prototype, "save", async function (options = {}) {
        state.users.push(this);
        this.__testSaveSession = options.session || null;
        return this;
    }, restoreList);

    replaceMethod(Student.prototype, "save", async function (options = {}) {
        state.students.push(this);
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

function request(body, role = ROLES.OWNER) {
    return {
        body,
        tenant: { hostelId },
        auth: { id: actorId, role }
    };
}

function studentBody(extra = {}) {
    return {
        name: "Test Resident",
        studentId: "STU-TEST-100",
        mobile: "9876501234",
        email: "student.test100@example.com",
        password: initialPassword,
        status: "ACTIVE",
        ...extra
    };
}

test("student login account creation saves user, student and membership in one transaction", async () => {
    const harness = createHarness();

    try {
        const result = await studentService.create(request(studentBody()));
        const { state } = harness;

        assert.equal(state.transactionCount, 1);
        assert.equal(state.users.length, 1);
        assert.equal(state.students.length, 1);
        assert.equal(state.memberships.length, 1);
        assert.equal(state.ended, true);

        const user = state.users[0];
        const student = state.students[0];
        const membership = state.memberships[0];

        assert.equal(user.role, ROLES.STUDENT);
        assert.equal(String(user.hostelId), hostelId);
        assert.equal(student.studentId, "STU-TEST-100");
        assert.equal(String(student.userId), String(user._id));
        assert.equal(String(membership.userId), String(user._id));
        assert.equal(String(membership.hostelId), hostelId);
        assert.equal(membership.role, ROLES.STUDENT);

        assert.equal(user.passwordHash === initialPassword, false);
        assert.equal(await verifyPassword(initialPassword, user.passwordHash), true);

        assert.equal(result.loginAccountCreated, true);
        assert.equal(result.loginId, "STU-TEST-100");
        assert.equal(Object.hasOwn(result, "passwordHash"), false);
        assert.equal(Object.hasOwn(result, "password"), false);

        for (const record of [user, student, membership]) {
            assert.equal(record.__testSaveSession, state.session);
        }

        assert.equal(state.querySession, state.session);
        assert.equal(state.selectedFields, "_id");
    } finally {
        harness.restore();
    }
});

test("student password validation rejects short passwords and prevents passwords on updates", () => {
    assert.throws(
        () => studentService.validate(studentBody({ password: "short" })),
        /password must contain 8 to 1024 characters/
    );

    assert.throws(
        () => studentService.validate({
            name: "Test Resident",
            password: initialPassword
        }, true),
        /Unsupported field: password/
    );
});

test("Warden cannot create a student login by supplying a password", async () => {
    const harness = createHarness();

    try {
        await assert.rejects(
            studentService.create(request(studentBody(), ROLES.WARDEN)),
            (error) => error.statusCode === 403
        );

        assert.equal(harness.state.transactionCount, 0);
        assert.equal(harness.state.users.length, 0);
        assert.equal(harness.state.students.length, 0);
        assert.equal(harness.state.memberships.length, 0);
    } finally {
        harness.restore();
    }
});

test("duplicate email or mobile account is rejected before creating records", async () => {
    const harness = createHarness({ existingUser: { _id: "existing-user" } });

    try {
        await assert.rejects(
            studentService.create(request(studentBody())),
            (error) => error.statusCode === 409
        );

        assert.equal(harness.state.transactionCount, 1);
        assert.equal(harness.state.users.length, 0);
        assert.equal(harness.state.students.length, 0);
        assert.equal(harness.state.memberships.length, 0);
        assert.equal(harness.state.ended, true);
    } finally {
        harness.restore();
    }
});

test("profile-only student creation remains compatible without login credentials", async () => {
    const harness = createHarness();

    try {
        const result = await studentService.create(
            request({
                name: "Profile Only Resident",
                studentId: "STU-PROFILE-100"
            }, ROLES.WARDEN)
        );

        assert.equal(harness.state.transactionCount, 0);
        assert.equal(harness.state.users.length, 0);
        assert.equal(harness.state.students.length, 1);
        assert.equal(harness.state.memberships.length, 0);
        assert.equal(result.studentId, "STU-PROFILE-100");
    } finally {
        harness.restore();
    }
});
