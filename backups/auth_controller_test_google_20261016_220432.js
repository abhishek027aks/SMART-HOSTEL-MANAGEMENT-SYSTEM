const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { randomBytes } = require("node:crypto");
const test = require("node:test");

process.env.JWT_SECRET = process.env.JWT_SECRET || randomBytes(48).toString("hex");

const User = require("../src/models/User");
const Hostel = require("../src/models/Hostel");
const Student = require("../src/models/Student");
const HostelMembership = require("../src/models/HostelMembership");
const ROLES = require("../src/constants/roles");
const { login, registerOwner } = require("../src/controllers/authController");
const { hashPassword } = require("../src/utils/password");
const { verifyAccessToken } = require("../src/utils/token");
const config = require("../src/config");

const membershipQuery = (records) => ({
    select: () => ({ lean: async () => records })
});

const hostelListQuery = (records) => ({
    select: () => ({ lean: async () => records })
});

const invokeLogin = async (body) => {
    const response = {
        statusCode: null,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; }
    };
    let forwardedError;

    await login({ body }, response, (error) => { forwardedError = error; });
    if (forwardedError) {
        throw forwardedError;
    }
    return response;
};

test("staff login requires membership and returns a signed token without a password hash", async () => {
    const passwordHash = await hashPassword("staff password");
    const user = {
        _id: "staff-user-id",
        name: "Staff Account",
        email: "staff@example.invalid",
        mobile: "",
        role: ROLES.WARDEN,
        hostelId: "hostel-id",
        status: "ACTIVE",
        isDeleted: false,
        passwordHash
    };
    const originalUserFind = User.find;
    const originalMembershipFind = HostelMembership.find;
    const originalHostelFind = Hostel.find;

    try {
        User.find = () => ({ limit: async () => [user] });
        HostelMembership.find = () => membershipQuery([{ hostelId: user.hostelId }]);
        Hostel.find = () => hostelListQuery([{ _id: user.hostelId }]);
        const response = await invokeLogin({ identifier: user.email, password: "staff password" });

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.data.user.role, ROLES.WARDEN);
        assert.equal(response.body.data.user.hostelId, user.hostelId);
        assert.equal(Object.hasOwn(response.body.data.user, "passwordHash"), false);
        assert.equal(verifyAccessToken(response.body.data.token, config.jwtSecret).sub, user._id);
    } finally {
        User.find = originalUserFind;
        HostelMembership.find = originalMembershipFind;
        Hostel.find = originalHostelFind;
    }
});

test("staff can choose only an active hostel membership", async () => {
    const user = {
        _id: "multi-hostel-user-id",
        name: "Multi Hostel Warden",
        email: "warden@example.invalid",
        mobile: "",
        role: ROLES.WARDEN,
        hostelId: "hostel-one",
        status: "ACTIVE",
        isDeleted: false,
        passwordHash: await hashPassword("staff password")
    };
    const originalUserFind = User.find;
    const originalMembershipFind = HostelMembership.find;
    const originalHostelFind = Hostel.find;

    try {
        User.find = () => ({ limit: async () => [user] });
        HostelMembership.find = () => membershipQuery([
            { hostelId: "hostel-one" },
            { hostelId: "hostel-two" }
        ]);
        Hostel.find = () => hostelListQuery([
            { _id: "hostel-one" },
            { _id: "hostel-two" }
        ]);

        const selected = await invokeLogin({
            identifier: user.email,
            password: "staff password",
            hostelId: "hostel-two",
            role: ROLES.WARDEN
        });
        assert.equal(selected.statusCode, 200);
        assert.equal(selected.body.data.user.hostelId, "hostel-two");
        assert.equal(selected.body.data.user.role, ROLES.WARDEN);
        assert.equal(verifyAccessToken(selected.body.data.token, config.jwtSecret).hostelId, "hostel-two");

        const wrongRole = await invokeLogin({
            identifier: user.email,
            password: "staff password",
            hostelId: "hostel-two",
            role: ROLES.OWNER
        });
        assert.equal(wrongRole.statusCode, 401);

        const invalidRole = await invokeLogin({
            identifier: user.email,
            password: "staff password",
            role: "SYSTEM_OWNER"
        });
        assert.equal(invalidRole.statusCode, 400);

        const denied = await invokeLogin({
            identifier: user.email,
            password: "staff password",
            hostelId: "unassigned-hostel"
        });
        assert.equal(denied.statusCode, 401);
    } finally {
        User.find = originalUserFind;
        HostelMembership.find = originalMembershipFind;
        Hostel.find = originalHostelFind;
    }
});

test("student login is bound to the active membership matching its hostel access code", async () => {
    const passwordHash = await hashPassword("student password");
    const hostel = { _id: "student-hostel-id" };
    const student = { userId: "student-user-id", studentId: "STU-100" };
    const user = {
        _id: student.userId,
        name: "Student Account",
        email: "",
        mobile: "",
        role: ROLES.STUDENT,
        hostelId: hostel._id,
        status: "ACTIVE",
        isDeleted: false,
        passwordHash
    };
    const originalHostelFindOne = Hostel.findOne;
    const originalHostelFind = Hostel.find;
    const originalStudentFindOne = Student.findOne;
    const originalUserFindOne = User.findOne;
    const originalMembershipFind = HostelMembership.find;

    try {
        Hostel.findOne = () => ({ select: () => ({ lean: async () => hostel }) });
        Hostel.find = () => hostelListQuery([{ _id: hostel._id }]);
        Student.findOne = () => ({ select: () => ({ lean: async () => student }) });
        User.findOne = async (criteria) => criteria.hostelId === hostel._id ? user : null;
        HostelMembership.find = () => membershipQuery([{ hostelId: hostel._id }, { hostelId: "other-hostel-id" }]);

        const mismatchedHostel = await invokeLogin({
            accessCode: "hostel-access-code",
            identifier: student.studentId,
            password: "student password",
            hostelId: "other-hostel-id"
        });
        assert.equal(mismatchedHostel.statusCode, 401);

        const response = await invokeLogin({
            accessCode: "hostel-access-code",
            identifier: student.studentId,
            password: "student password"
        });

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.data.user.studentId, student.studentId);
        assert.equal(response.body.data.user.hostelId, hostel._id);
        assert.equal(verifyAccessToken(response.body.data.token, config.jwtSecret).role, ROLES.STUDENT);
    } finally {
        Hostel.findOne = originalHostelFindOne;
        Hostel.find = originalHostelFind;
        Student.findOne = originalStudentFindOne;
        User.findOne = originalUserFindOne;
        HostelMembership.find = originalMembershipFind;
    }
});

test("duplicate login identifiers are rejected rather than choosing an arbitrary account", async () => {
    const user = { _id: "duplicate-a", role: ROLES.OWNER, passwordHash: await hashPassword("password") };
    const originalFind = User.find;

    try {
        User.find = () => ({ limit: async () => [user, { ...user, _id: "duplicate-b" }] });
        const response = await invokeLogin({ identifier: "shared@example.invalid", password: "password" });
        assert.equal(response.statusCode, 401);
        assert.equal(response.body.message, "Invalid credentials");
    } finally {
        User.find = originalFind;
    }
});

const invokeRegisterOwner = async (body) => {
    const response = {
        statusCode: null,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; }
    };
    let forwardedError;

    await registerOwner({ body }, response, (error) => { forwardedError = error; });
    if (forwardedError) {
        throw forwardedError;
    }
    return response;
};

test("owner registration creates a hostel, user, and membership in one transaction", async () => {
    const originalStartSession = mongoose.startSession;
    const originalUserFindOne = User.findOne;
    const originalHostelFindOne = Hostel.findOne;
    const originalUserSave = User.prototype.save;
    const originalHostelSave = Hostel.prototype.save;
    const originalMembershipSave = HostelMembership.prototype.save;

    try {
        const session = {
            withTransaction: async (callback) => callback(),
            endSession: async () => undefined
        };

        mongoose.startSession = async () => session;
        User.findOne = async () => null;
        Hostel.findOne = async () => null;

        User.prototype.save = async function save() {
            if (!this._id) {
                this._id = this.email === "owner@example.invalid" ? "owner-user-id" : "updated-owner-id";
            }
            return this;
        };

        Hostel.prototype.save = async function save() {
            if (!this._id) {
                this._id = "hostel-123";
            }
            return this;
        };

        HostelMembership.prototype.save = async function save() {
            return this;
        };

        const response = await invokeRegisterOwner({
            name: "Asha Owner",
            email: "owner@example.invalid",
            mobile: "+15551234567",
            password: "secretpass",
            hostelName: "Sunrise Residency",
            hostelCode: "SUNRISE01",
            accessCode: "ACCESS01",
            city: "Bengaluru",
            state: "Karnataka",
            address: "MG Road",
            pincode: "560001",
            contact: "+15557654321",
            hostelEmail: "hello@sunrise.invalid"
        });

        assert.equal(response.statusCode, 201);
        assert.equal(response.body.status, "success");
        assert.equal(response.body.data.user.role, ROLES.OWNER);
        assert.equal(response.body.data.user.hostelId, response.body.data.hostel.id);
        assert.equal(response.body.data.hostel.name, "Sunrise Residency");
        assert.equal(verifyAccessToken(response.body.data.token, config.jwtSecret).sub, response.body.data.user.id);

        const invalidImage = await invokeRegisterOwner({
            name: "Another Owner",
            email: "another-owner@example.invalid",
            mobile: "+15551234568",
            password: "secretpass",
            hostelName: "Another Residency",
            hostelCode: "ANOTHER01",
            accessCode: "ACCESS02",
            photoUrl: "javascript:alert(1)"
        });
        assert.equal(invalidImage.statusCode, 400);

        const invalidContact = await invokeRegisterOwner({
            name: "Another Owner",
            email: "another-owner@example.invalid",
            mobile: "123",
            password: "secretpass",
            hostelName: "Another Residency",
            hostelCode: "ANOTHER01",
            accessCode: "ACCESS02"
        });
        assert.equal(invalidContact.statusCode, 400);
    } finally {
        mongoose.startSession = originalStartSession;
        User.findOne = originalUserFindOne;
        Hostel.findOne = originalHostelFindOne;
        User.prototype.save = originalUserSave;
        Hostel.prototype.save = originalHostelSave;
        HostelMembership.prototype.save = originalMembershipSave;
    }
});
// LOGIN_DEFAULT_HOSTEL_WITHOUT_MANUAL_ID_V1
test("login selects an active membership automatically when the primary hostel is not set", async () => {
    const firstHostelId = "64b64c1a1e2c3d4e5f607101";
    const secondHostelId = "64b64c1a1e2c3d4e5f607102";
    const user = {
        _id: "multi-hostel-no-primary-user",
        name: "Multi Hostel Warden",
        email: "multi-hostel@example.invalid",
        mobile: "",
        role: ROLES.WARDEN,
        hostelId: null,
        status: "ACTIVE",
        isDeleted: false,
        passwordHash: await hashPassword("multi-hostel-password")
    };

    const originalUserFind = User.find;
    const originalMembershipFind = HostelMembership.find;
    const originalHostelFind = Hostel.find;

    try {
        User.find = () => ({ limit: async () => [user] });
        HostelMembership.find = () => membershipQuery([
            { hostelId: secondHostelId },
            { hostelId: firstHostelId }
        ]);
        Hostel.find = () => hostelListQuery([
            { _id: secondHostelId },
            { _id: firstHostelId }
        ]);

        const response = await invokeLogin({
            identifier: user.email,
            password: "multi-hostel-password",
            role: ROLES.WARDEN
        });

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.data.user.hostelId, firstHostelId);
        assert.equal(
            verifyAccessToken(response.body.data.token, config.jwtSecret).hostelId,
            firstHostelId
        );
    } finally {
        User.find = originalUserFind;
        HostelMembership.find = originalMembershipFind;
        Hostel.find = originalHostelFind;
    }
});
