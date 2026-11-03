const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const test = require("node:test");

const Parent = require("../src/models/Parent");
const User = require("../src/models/User");
const HostelMembership = require("../src/models/HostelMembership");
const ROLES = require("../src/constants/roles");
const service = require("../src/services/parentService");

const HOSTEL_ID = "64b64c1a1e2c3d4e5f607181";
const OTHER_HOSTEL_ID = "64b64c1a1e2c3d4e5f607199";
const PARENT_ID = "64b64c1a1e2c3d4e5f607183";
const USER_ID = "64b64c1a1e2c3d4e5f607184";

function replaceMethod(target, name, replacement, restoreList) {
    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    Object.defineProperty(target, name, {
        configurable: true,
        writable: true,
        value: replacement
    });
    restoreList.push(() => {
        if (descriptor) Object.defineProperty(target, name, descriptor);
        else delete target[name];
    });
}

function createHarness({ parentExists = true } = {}) {
    const restoreList = [];
    const state = {
        sessionStarted: false,
        ended: false,
        parentFilter: null,
        membershipFilter: null,
        parentSaved: false,
        userSaved: false,
        membershipSaved: false
    };

    const session = {
        withTransaction: async (callback) => callback(),
        endSession: async () => { state.ended = true; }
    };
    state.session = session;

    const parent = {
        _id: PARENT_ID,
        userId: USER_ID,
        parentId: "PARENT-001",
        status: "ACTIVE",
        isDeleted: false,
        save: async (options) => {
            state.parentSaved = true;
            state.parentSaveOptions = options;
        }
    };
    const user = {
        _id: USER_ID,
        role: ROLES.PARENT,
        status: "ACTIVE",
        isDeleted: false,
        save: async (options) => {
            state.userSaved = true;
            state.userSaveOptions = options;
        }
    };
    const membership = {
        userId: USER_ID,
        hostelId: HOSTEL_ID,
        role: ROLES.PARENT,
        status: "ACTIVE",
        isDeleted: false,
        save: async (options) => {
            state.membershipSaved = true;
            state.membershipSaveOptions = options;
        }
    };

    replaceMethod(mongoose, "startSession", async () => {
        state.sessionStarted = true;
        return session;
    }, restoreList);

    replaceMethod(Parent, "findOne", (filter) => {
        state.parentFilter = filter;
        return { session: async () => parentExists ? parent : null };
    }, restoreList);

    replaceMethod(User, "findOne", (filter) => {
        state.userFilter = filter;
        return { session: async () => user };
    }, restoreList);

    replaceMethod(HostelMembership, "findOne", (filter) => {
        state.membershipFilter = filter;
        return { session: async () => membership };
    }, restoreList);

    return {
        state, parent, user, membership,
        restore() {
            for (const restore of restoreList.reverse()) restore();
        }
    };
}

function request({ role = ROLES.OWNER, hostelId = HOSTEL_ID } = {}) {
    return {
        params: { id: PARENT_ID },
        tenant: { hostelId },
        auth: { id: "64b64c1a1e2c3d4e5f607188", role }
    };
}

test("Parent archive disables login and soft-deletes only the tenant-scoped parent records", async () => {
    const h = createHarness();
    try {
        const result = await service.archive(request());

        assert.equal(result.deleted, true);
        assert.equal(result.status, "INACTIVE");
        assert.equal(h.parent.isDeleted, true);
        assert.equal(h.parent.status, "INACTIVE");
        assert.equal(h.user.isDeleted, true);
        assert.equal(h.user.status, "INACTIVE");
        assert.equal(h.membership.isDeleted, true);
        assert.equal(h.membership.status, "INACTIVE");
        assert.equal(h.state.parentSaved, true);
        assert.equal(h.state.userSaved, true);
        assert.equal(h.state.membershipSaved, true);
        assert.equal(h.state.parentSaveOptions.session, h.state.session);
        assert.equal(h.state.userSaveOptions.session, h.state.session);
        assert.equal(h.state.membershipSaveOptions.session, h.state.session);
        assert.equal(String(h.state.parentFilter.hostelId), HOSTEL_ID);
        assert.equal(h.state.ended, true);
    } finally {
        h.restore();
    }
});

test("Parent archive cannot find a parent outside the verified hostel", async () => {
    const h = createHarness({ parentExists: false });
    try {
        await assert.rejects(
            service.archive(request({ hostelId: OTHER_HOSTEL_ID })),
            { statusCode: 404 }
        );
        assert.equal(String(h.state.parentFilter.hostelId), OTHER_HOSTEL_ID);
        assert.equal(h.state.userSaved, false);
        assert.equal(h.state.ended, true);
    } finally {
        h.restore();
    }
});

test("Only Owner or System Admin can archive a Parent account", async () => {
    const h = createHarness();
    try {
        await assert.rejects(
            service.archive(request({ role: ROLES.WARDEN })),
            { statusCode: 403 }
        );
        assert.equal(h.state.sessionStarted, false);
    } finally {
        h.restore();
    }
});