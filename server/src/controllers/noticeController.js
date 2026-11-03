const service = require("../services/noticeService");
const respond = (operation, status = 200) => async (req, res, next) => { try { return res.status(status).json({ status: "success", data: await operation(req) }); } catch (err) { if (err.statusCode) return res.status(err.statusCode).json({ status: "error", message: err.message }); return next(err); } };
module.exports = { create: respond(service.create, 201), list: respond(service.list), mine: respond(service.mine) };
