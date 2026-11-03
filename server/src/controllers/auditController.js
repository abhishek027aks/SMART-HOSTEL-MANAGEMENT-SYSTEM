const auditService = require("../services/auditService");

const list = async (req, res, next) => {
    try {
        res.status(200).json({ status: "success", data: await auditService.list(req) });
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json({ status: "error", message: error.message });
        return next(error);
    }
};

module.exports = { list };
