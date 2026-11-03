const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const test = require("node:test");

process.env.JWT_SECRET = process.env.JWT_SECRET || "api-test-secret-with-at-least-32-bytes";

const mongoose = require("mongoose");
const config = require("../src/config");
const connectDatabase = require("../src/config/db");
const ROLES = require("../src/constants/roles");
const { signAccessToken } = require("../src/utils/token");
const app = require("../src/app");
const dashboardService = require("../src/services/dashboardService");

test("authentication APIs validate input and reject unknown accounts without writing records", async () => {
    await connectDatabase(config.mongoUri);
    const summary = await dashboardService.getDashboardSummary();
    assert.equal(Number.isInteger(summary.counts.maintenanceBeds), true);
    assert.equal(Number.isInteger(summary.counts.reservedBeds), true);
    assert.equal(Number.isInteger(summary.counts.vacantBeds), true);
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    try {
        const missingToken = await fetch(`${baseUrl}/api/auth/me`);
        assert.equal(missingToken.status, 401);

        const nonexistentAccountToken = signAccessToken({
            id: new mongoose.Types.ObjectId().toString(),
            role: ROLES.SYSTEM_ADMIN
        }, config.jwtSecret);
        const staleAccountToken = await fetch(`${baseUrl}/api/auth/me`, {
            headers: { Authorization: `Bearer ${nonexistentAccountToken}` }
        });
        assert.equal(staleAccountToken.status, 401);

        const unprotectedDashboard = await fetch(`${baseUrl}/api/dashboard/summary`);
        assert.equal(unprotectedDashboard.status, 401);

        for (const [path, method] of [
            ["/api/facilities/blocks", "GET"],
            ["/api/facilities/rooms", "GET"],
            ["/api/hostels/current", "GET"],
            ["/api/hostels", "GET"],
            ["/api/hostels/64b64c1a1e2c3d4e5f607182", "DELETE"],
            ["/api/hostels/64b64c1a1e2c3d4e5f607182/restore", "POST"],
            ["/api/students", "GET"],
            ["/api/students/64b64c1a1e2c3d4e5f607182", "DELETE"],
            ["/api/students/64b64c1a1e2c3d4e5f607182/restore", "POST"],
            ["/api/allocations", "GET"],
            ["/api/allocations/options", "GET"],
            ["/api/allocations/available-beds?roomId=64b64c1a1e2c3d4e5f607185", "GET"],
            ["/api/staff", "GET"],
            ["/api/staff", "POST"],
            ["/api/uploads/photos/00000000-0000-4000-8000-000000000000.jpg", "GET"],
            ["/api/uploads/photos/student", "POST"]
        ]) {
            const protectedResponse = await fetch(`${baseUrl}${path}`, { method });
            assert.equal(protectedResponse.status, 401, `${path} must require authentication`);
        }
        const invalidLogin = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({})
        });
        assert.equal(invalidLogin.status, 400);

        const invalidRoleLogin = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                identifier: `${randomUUID()}@example.invalid`,
                password: randomUUID(),
                role: "SYSTEM_OWNER"
            })
        });
        assert.equal(invalidRoleLogin.status, 400);

        const invalidRegistration = await fetch(`${baseUrl}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: "Invalid Owner",
                email: "invalid-owner@example.invalid",
                mobile: "123",
                password: "valid-password",
                hostelName: "Invalid Hostel",
                hostelCode: "INVALID01",
                accessCode: "ACCESS01",
                photoUrl: "javascript:alert(1)"
            })
        });
        assert.equal(invalidRegistration.status, 400);

        const unknownStaffLogin = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                identifier: `${randomUUID()}@example.invalid`,
                password: randomUUID()
            })
        });
        assert.equal(unknownStaffLogin.status, 401);

        const unknownStudentLogin = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                accessCode: `unknown-${randomUUID()}`,
                identifier: `unknown-${randomUUID()}`,
                password: randomUUID()
            })
        });
        assert.equal(unknownStudentLogin.status, 401);
    } finally {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        await mongoose.disconnect();
    }
});

