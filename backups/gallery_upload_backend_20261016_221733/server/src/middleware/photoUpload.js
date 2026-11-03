const multer = require("multer");
const path = require("node:path");
const { mkdir, writeFile } = require("node:fs/promises");
const { randomUUID } = require("node:crypto");

const UPLOAD_ROOT = path.resolve(__dirname, "..", "..", "uploads");
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const TYPES = new Map([
    ["image/jpeg", { extension: "jpg", signature: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff }],
    ["image/png", { extension: "png", signature: (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) }],
    ["image/webp", { extension: "webp", signature: (buffer) => buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP" }]
]);
const validPhoto = (mimeType, buffer) => {
    const type = TYPES.get(mimeType);
    return Boolean(type && Buffer.isBuffer(buffer) && type.signature(buffer));
};

const receivePhoto = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PHOTO_BYTES, files: 1 },
    fileFilter: (req, file, callback) => callback(null, TYPES.has(file.mimetype))
}).single("file");

const handlePhotoUpload = (req, res, next) => receivePhoto(req, res, (error) => {
    if (error) {
        if (error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ status: "error", message: "Photo must be 5 MB or smaller." });
        return res.status(400).json({ status: "error", message: "Upload one JPEG, PNG, or WEBP photo." });
    }
    return next();
});

const savePhoto = async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ status: "error", message: "Select a JPEG, PNG, or WEBP photo." });
        const type = TYPES.get(req.file.mimetype);
        if (!validPhoto(req.file.mimetype, req.file.buffer)) return res.status(400).json({ status: "error", message: "The uploaded file is not a valid JPEG, PNG, or WEBP image." });
        const directory = path.join(UPLOAD_ROOT, "photos");
        await mkdir(directory, { recursive: true });
        const filename = `${randomUUID()}.${type.extension}`;
        await writeFile(path.join(directory, filename), req.file.buffer, { flag: "wx", mode: 0o640 });
        return res.status(201).json({ status: "success", data: { photoUrl: `/api/uploads/photos/${filename}` } });
    } catch (error) {
        return next(error);
    }
};

module.exports = { handlePhotoUpload, savePhoto, UPLOAD_ROOT, validPhoto, MAX_PHOTO_BYTES };
