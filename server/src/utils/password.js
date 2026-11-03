const { randomBytes, scrypt, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");

const scryptAsync = promisify(scrypt);
const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;
const HASH_PATTERN = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([a-f\d]{32})\$([a-f\d]{128})$/;

const hashPassword = async (password) => {
    if (typeof password !== "string" || password.length < 1 || password.length > 1024) {
        throw new TypeError("Password must contain between 1 and 1024 characters.");
    }

    const salt = randomBytes(16);
    const key = await scryptAsync(password, salt, KEY_LENGTH, {
        N: COST,
        r: BLOCK_SIZE,
        p: PARALLELIZATION,
        maxmem: MAX_MEMORY
    });

    return `scrypt$${COST}$${BLOCK_SIZE}$${PARALLELIZATION}$${salt.toString("hex")}$${key.toString("hex")}`;
};

const verifyPassword = async (password, encodedHash) => {
    if (typeof password !== "string" || password.length > 1024 || typeof encodedHash !== "string") {
        return false;
    }

    const match = HASH_PATTERN.exec(encodedHash);
    if (!match) {
        return false;
    }

    const [, cost, blockSize, parallelization, saltHex, keyHex] = match;
    if (Number(cost) !== COST || Number(blockSize) !== BLOCK_SIZE || Number(parallelization) !== PARALLELIZATION) {
        return false;
    }

    const expectedKey = Buffer.from(keyHex, "hex");
    const actualKey = await scryptAsync(password, Buffer.from(saltHex, "hex"), KEY_LENGTH, {
        N: COST,
        r: BLOCK_SIZE,
        p: PARALLELIZATION,
        maxmem: MAX_MEMORY
    });

    return timingSafeEqual(actualKey, expectedKey);
};

module.exports = {
    hashPassword,
    verifyPassword
};
