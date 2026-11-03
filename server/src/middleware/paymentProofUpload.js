const multer = require("multer");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, callback) => {
        if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
            return callback(null, true);
        }
        const error = new Error("Upload a JPEG, PNG, or WEBP payment screenshot.");
        error.statusCode = 400;
        return callback(error);
    }
}).single("proof");

const receivePaymentProof = (req, res, next) => upload(req, res, (error) => {
    if (error) {
        const status = error.code === "LIMIT_FILE_SIZE" ? 413 : (error.statusCode || 400);
        return res.status(status).json({
            status: "error",
            message: status === 413
                ? "Payment screenshot must be 5 MB or smaller."
                : error.message || "Invalid payment screenshot."
        });
    }
    return next();
});

module.exports = { receivePaymentProof };