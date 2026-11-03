const service = require("../services/allocationService");
const sendError = (error, res, next) => {
    if (error.statusCode) return res.status(error.statusCode).json({ status: "error", message: error.message });
    return next(error);
};
const handler = (operation, status = 200) => async (req, res, next) => {
    try { return res.status(status).json({ status: "success", data: await operation(req) }); }
    catch (error) { return sendError(error, res, next); }
};
module.exports = {
    options: handler(service.options),
    list: handler(service.list),
    availableBeds: handler(service.listAvailableBeds),
    assign: handler(service.assign, 201),
    release: handler(service.release),
    transfer: handler(service.transfer)
};
