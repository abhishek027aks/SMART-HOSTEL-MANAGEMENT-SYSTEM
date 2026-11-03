const service = require("../services/gateService");

const sendError = (error, res, next) => {
    if (error.statusCode) {
        return res.status(error.statusCode).json({
            status: "error",
            message: error.message
        });
    }

    return next(error);
};

const issueQrToken = async (req, res, next) => {
    try {
        const data = await service.issueForCurrentStudent(req);

        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Pragma", "no-cache");

        return res.status(201).json({
            status: "success",
            data
        });
    } catch (error) {
        return sendError(error, res, next);
    }
};

const scan = async (req, res, next) => {
    try {
        const data = await service.consumeForGate(req, req.body);

        return res.status(201).json({
            status: "success",
            data
        });
    } catch (error) {
        return sendError(error, res, next);
    }
};

module.exports = {
    issueQrToken,
    scan
};
