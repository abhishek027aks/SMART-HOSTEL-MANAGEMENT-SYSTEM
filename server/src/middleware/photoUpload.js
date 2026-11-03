const multer = require("multer");
const path = require("node:path");
const { mkdir, writeFile, rm } = require("node:fs/promises");
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

const receiveGallery = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_PHOTO_BYTES,
        files: 8,
        fields: 32,
        parts: 40,
        fieldSize: 64 * 1024
    },
    fileFilter: (req, file, callback) => {
        if (!TYPES.has(file.mimetype)) {
            const error = new Error("Use JPEG, PNG, or WEBP images only.");
            error.statusCode = 400;
            return callback(error);
        }
        return callback(null, true);
    }
}).array("galleryImages", 8);

const handleGalleryUpload = (req, res, next) => receiveGallery(req, res, (error) => {
    if (error) {
        if (error.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({ status: "error", message: "Each photo must be 5 MB or smaller." });
        }
        if (error.code === "LIMIT_FILE_COUNT") {
            return res.status(400).json({ status: "error", message: "Upload no more than 8 gallery photos." });
        }
        return res.status(400).json({ status: "error", message: error.statusCode === 400
            ? error.message
            : "Upload up to 8 JPEG, PNG, or WEBP photos." });
    }

    const files = req.files || [];
    if (files.some((file) => !validPhoto(file.mimetype, file.buffer))) {
        return res.status(400).json({ status: "error", message: "A photo's actual file content does not match its image type." });
    }
    return next();
});

const handlePhotoUpload = (req, res, next) => receivePhoto(req, res, (error) => {
    if (error) {
        if (error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ status: "error", message: "Photo must be 5 MB or smaller." });
        return res.status(400).json({ status: "error", message: "Upload one JPEG, PNG, or WEBP photo." });
    }
    return next();
});

const savePhotoBuffer = async (mimeType, buffer, { publicGallery = false } = {}) => {
    const type = TYPES.get(mimeType);
    if (!validPhoto(mimeType, buffer)) {
        throw Object.assign(new Error("The uploaded file is not a valid JPEG, PNG, or WEBP image."), { statusCode: 400 });
    }

    const directory = path.join(UPLOAD_ROOT, "photos");
    await mkdir(directory, { recursive: true });
    const filename = `${randomUUID()}.${type.extension}`;
    const filePath = path.join(directory, filename);
    await writeFile(filePath, buffer, { flag: "wx", mode: 0o640 });

    return {
        filePath,
        photoUrl: publicGallery
            ? `/api/uploads/public/photos/${filename}`
            : `/api/uploads/photos/${filename}`
    };
};

const removeStoredPhoto = async (stored) => {
    if (!stored?.filePath) return;
    const directory = path.resolve(UPLOAD_ROOT, "photos") + path.sep;
    const filePath = path.resolve(stored.filePath);
    if (!filePath.startsWith(directory)) {
        throw new Error("Refusing to remove a file outside the photo upload directory.");
    }
    await rm(filePath, { force: true });
};

const savePhoto = async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ status: "error", message: "Select a JPEG, PNG, or WEBP photo." });
        const stored = await savePhotoBuffer(req.file.mimetype, req.file.buffer);
        return res.status(201).json({ status: "success", data: { photoUrl: stored.photoUrl } });
    } catch (error) {
        if (error.statusCode === 400) {
            return res.status(400).json({ status: "error", message: error.message });
        }
        return next(error);
    }
};

module.exports = {
    handlePhotoUpload,
    handleGalleryUpload,
    savePhoto,
    savePhotoBuffer,
    removeStoredPhoto,
    UPLOAD_ROOT,
    validPhoto,
    MAX_PHOTO_BYTES
};
