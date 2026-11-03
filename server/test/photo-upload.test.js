const assert = require("node:assert/strict");
const test = require("node:test");

const { MAX_PHOTO_BYTES, validPhoto } = require("../src/middleware/photoUpload");

test("photo upload requires a supported image MIME type and matching file signature", () => {
    assert.equal(validPhoto("image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x00])), true);
    assert.equal(validPhoto("image/png", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), true);
    assert.equal(validPhoto("image/webp", Buffer.from("RIFFabcdWEBP")), true);
    assert.equal(validPhoto("image/png", Buffer.from("not a png")), false);
    assert.equal(validPhoto("text/plain", Buffer.from([0xff, 0xd8, 0xff])), false);
    assert.equal(validPhoto("image/jpeg", "not a buffer"), false);
    assert.equal(MAX_PHOTO_BYTES, 5 * 1024 * 1024);
});
