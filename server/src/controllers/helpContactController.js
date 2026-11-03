const service = require("../services/helpContactService");
const respond = (operation, status = 200) => async (req, res, next) => {
    try { return res.status(status).json({ status: "success", data: await operation(req) }); }
    catch (error) { if (error.statusCode) return res.status(error.statusCode).json({ status: "error", message: error.message }); return next(error); }
};
module.exports = { archive: respond(service.archive), create: respond(service.create, 201), list: respond(service.list), manageList: respond(service.manageList), update: respond(service.update) };
