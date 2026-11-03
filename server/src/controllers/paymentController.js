const service = require("../services/paymentService");

const respond = (operation, status = 200) => async (req, res, next) => {
    try {
        return res.status(status).json({ status: "success", data: await operation(req) });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ status: "error", message: error.message });
        }
        return next(error);
    }
};

const proof = async (req, res, next) => {
    try {
        const result = await service.getProof(req);
        res.setHeader("Content-Type", result.contentType);
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cache-Control", "private, no-store");
        return res.sendFile(result.filePath, (error) => {
            if (error && !res.headersSent) {
                res.status(404).json({ status: "error", message: "Payment screenshot not found." });
            }
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ status: "error", message: error.message });
        }
        return next(error);
    }
};

module.exports = {
    create: respond(service.createInvoice, 201),
    list: respond(service.listAll),
    mine: respond(service.listMine),
    proof,
    review: respond(service.reviewPayment),
    submit: respond(service.submitPayment)
};