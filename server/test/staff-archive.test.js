const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const test = require("node:test");
const User = require("../src/models/User");
const HostelMembership = require("../src/models/HostelMembership");
const StaffAudit = require("../src/models/StaffAudit");
const ROLES = require("../src/constants/roles");
const service = require("../src/services/staffService");

const HOSTEL_ID = "64b64c1a1e2c3d4e5f607181";
const USER_ID = "64b64c1a1e2c3d4e5f607184";
const MEMBERSHIP_ID = "64b64c1a1e2c3d4e5f607185";

function replaceMethod(target, name, replacement, restoreList) {
    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    Object.defineProperty(target, name, { configurable: true, writable: true, value: replacement });
    restoreList.push(() => {
        if (descriptor) Object.defineProperty(target, name, descriptor);
        else delete target[name];
    });
}

function harness({ membershipExists = true } = {}) {
    const restoreList = [];
    const state = { sessionStarted: false, ended: false, auditSaved: false, filter: null };
    const session = {
        withTransaction: async (callback) => callback(),
        endSession: async () => { state.ended = true; }
    };

    const membership = {
        _id: MEMBERSHIP_ID,
        userId: USER_ID,
        hostelId: HOSTEL_ID,
        role: ROLES.WARDEN,
        status: "ACTIVE",
        isDeleted: false,
        save: async (options) => { state.saveOptions = options; }
    };
    const user = { _id: USER_ID, role: ROLES.WARDEN, isDeleted: false };

    replaceMethod(mongoose, "startSession", async () => {
        state.sessionStarted = true;
        return session;
    }, restoreList);

    replaceMethod(HostelMembership, "findOne", (filter) => {
        state.filter = filter;
        return { session: async () => membershipExists ? membership : null };
    }, restoreList);

    replaceMethod(User, "findOne", () => ({ session: async () => user }), restoreList);
    replaceMethod(StaffAudit.prototype, "save", async function (options) {
        state.auditSaved = true;
        state.auditOptions = options;
        return this;
    }, restoreList);

    return {
        state, membership, user, session,
        restore() { for (const restore of restoreList.reverse()) restore(); }
    };
}

function request(role = ROLES.OWNER) {
    return {
        params: { id: USER_ID },
        tenant: { hostelId: HOSTEL_ID },
        auth: { id: "64b64c1a1e2c3d4e5f607188", role }
    };
}

test("staff archive marks only the hostel membership inactive/deleted and retains User", async () => {
    const h = harness();
    try {
        const result = await service.archive(request());
        assert.equal(result.deleted, true);
        assert.equal(h.membership.status, "INACTIVE");
        assert.equal(h.membership.isDeleted, true);
        assert.equal(h.user.isDeleted, false);
        assert.equal(h.state.saveOptions.session, h.session);
        assert.equal(h.state.auditSaved, true);
        assert.equal(h.state.ended, true);
        assert.equal(String(h.state.filter.hostelId), HOSTEL_ID);
    } finally {
        h.restore();
    }
});

test("staff archive returns not found if membership is missing", async () => {
    const h = harness({ membershipExists: false });
    try {
        await assert.rejects(service.archive(request()), { statusCode: 404 });
        assert.equal(h.state.ended, true);
        assert.equal(h.state.auditSaved, false);
    } finally {
        h.restore();
    }
});

test("staff archive rejects non-owner roles", async () => {
    const h = harness();
    try {
        await assert.rejects(service.archive(request(ROLES.WARDEN)), { statusCode: 403 });
        assert.equal(h.state.sessionStarted, false);
    } finally {
        h.restore();
    }
});