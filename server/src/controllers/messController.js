const service = require("../services/messService");
const respond = (operation, status = 200) => async (req, res, next) => { try { return res.status(status).json({ status: "success", data: await operation(req) }); } catch (error) { if (error.statusCode) return res.status(error.statusCode).json({ status: "error", message: error.message }); return next(error); } };
module.exports = { list: respond(service.list), review: respond(service.review), saveMenu: respond(service.saveMenu) };
