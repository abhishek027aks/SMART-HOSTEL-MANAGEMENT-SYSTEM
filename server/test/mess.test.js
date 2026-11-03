const assert = require("node:assert/strict"); const test = require("node:test");
const MessMenu = require("../src/models/MessMenu"); const service = require("../src/services/messService");
const hostelId = "64b64c1a1e2c3d4e5f607181"; const userId = "64b64c1a1e2c3d4e5f607182";
const req = (body = {}) => ({ auth: { id: userId }, tenant: { hostelId }, body, query: {} });
async function swap(key, replacement, work) { const original = MessMenu[key]; MessMenu[key] = replacement; try { return await work(); } finally { MessMenu[key] = original; } }
test("mess menu validates the menu date", async () => { await assert.rejects(service.saveMenu(req({ menuDate: "bad" })), (error) => error.statusCode === 400); });
test("mess menu writes and lists from the verified hostel", async () => {
  await swap("findOneAndUpdate", async (filter, update) => ({ filter, update }), async () => { const result = await service.saveMenu(req({ menuDate: "2026-10-22", breakfast: { name: "Breakfast", items: ["Poha"] } })); assert.equal(result.filter.hostelId, hostelId); });
  await swap("find", (filter) => { assert.equal(filter.hostelId, hostelId); return { sort: () => ({ lean: async () => [] }) }; }, async () => assert.deepEqual(await service.list(req()), { items: [] }));
});
