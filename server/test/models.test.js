const assert = require("node:assert/strict");
const test = require("node:test");

const ROLES = require("../src/constants/roles");
const User = require("../src/models/User");
const Hostel = require("../src/models/Hostel");
const Block = require("../src/models/Block");
const Floor = require("../src/models/Floor");
const Room = require("../src/models/Room");
const Bed = require("../src/models/Bed");

const tenantModels = [Block, Floor, Room, Bed];
const historicalModels = [User, Hostel, Block, Floor, Room, Bed];

const findIndexOptions = (model, fields) => {
    const index = model.schema.indexes().find(([keys]) =>
        JSON.stringify(keys) === JSON.stringify(fields)
    );

    return index && index[1];
};

test("user schema supports all six application roles", () => {
    assert.deepEqual(User.schema.path("role").enumValues, Object.values(ROLES));
    assert.equal(User.schema.path("role").isRequired, true);
    assert.equal(User.schema.path("hostelId").defaultValue, null);
});

test("hostel schema requires unique platform and access codes", () => {
    assert.equal(Hostel.schema.path("hostelCode").isRequired, true);
    assert.equal(Hostel.schema.path("hostelCode").options.unique, true);
    assert.equal(Hostel.schema.path("accessCode").isRequired, true);
    assert.equal(Hostel.schema.path("accessCode").options.unique, true);
});

test("hostel profiles persist photo URLs and optional room-capacity metadata", () => {
    const hostel = new Hostel({
        hostelCode: "PROFILE01",
        accessCode: "ACCESS01",
        name: "Profile Hostel",
        photoUrl: "https://images.example.invalid/cover.jpg",
        galleryImages: ["https://images.example.invalid/room.jpg"],
        roomSetup: {
            totalRooms: 12,
            totalBeds: 24,
            bedsPerRoom: 2,
            roomTypes: ["Double Sharing"]
        }
    });

    assert.equal(hostel.photoUrl, "https://images.example.invalid/cover.jpg");
    assert.deepEqual(hostel.galleryImages, ["https://images.example.invalid/room.jpg"]);
    assert.equal(hostel.roomSetup.totalRooms, 12);
    assert.equal(hostel.roomSetup.totalBeds, 24);
    assert.deepEqual(hostel.roomSetup.roomTypes, ["Double Sharing"]);
});

test("each physical hostel resource is tenant-scoped and linked to its parent", () => {
    for (const model of tenantModels) {
        assert.equal(model.schema.path("hostelId").isRequired, true, `${model.modelName}.hostelId`);
    }

    assert.equal(Floor.schema.path("blockId").isRequired, true);
    assert.equal(Room.schema.path("blockId").isRequired, true);
    assert.equal(Room.schema.path("floorId").isRequired, true);
    assert.equal(Bed.schema.path("roomId").isRequired, true);
});

test("resource names are unique within their tenant hierarchy", () => {
    assert.equal(findIndexOptions(Block, { hostelId: 1, name: 1 }).unique, true);
    assert.equal(findIndexOptions(Floor, { hostelId: 1, blockId: 1, number: 1 }).unique, true);
    assert.equal(findIndexOptions(Room, { hostelId: 1, floorId: 1, roomNumber: 1 }).unique, true);
    assert.equal(findIndexOptions(Bed, { hostelId: 1, roomId: 1, bedNumber: 1 }).unique, true);
});

test("room and bed lifecycle states match the access plan", () => {
    const expectedStatuses = ["AVAILABLE", "OCCUPIED", "RESERVED", "MAINTENANCE"];

    assert.deepEqual(Room.schema.path("status").enumValues, expectedStatuses);
    assert.deepEqual(Bed.schema.path("status").enumValues, expectedStatuses);
    assert.equal(Room.schema.path("status").defaultValue, "AVAILABLE");
    assert.equal(Bed.schema.path("status").defaultValue, "AVAILABLE");
});

test("base records retain timestamps and soft-delete state", () => {
    for (const model of historicalModels) {
        assert.equal(model.schema.options.timestamps, true, `${model.modelName}.timestamps`);
        assert.equal(model.schema.path("isDeleted").defaultValue, false, `${model.modelName}.isDeleted`);
    }
});
test("hostel membership is tenant-scoped, role-bound, and unique per user and hostel", () => {
    const HostelMembership = require("../src/models/HostelMembership");
    assert.equal(HostelMembership.schema.path("userId").isRequired, true);
    assert.equal(HostelMembership.schema.path("hostelId").isRequired, true);
    assert.equal(HostelMembership.schema.path("role").isRequired, true);
    assert.equal(HostelMembership.schema.path("role").enumValues.length, 6);
    assert.equal(HostelMembership.schema.path("status").defaultValue, "ACTIVE");
    assert.equal(findIndexOptions(HostelMembership, { userId: 1, hostelId: 1 }).unique, true);
});
