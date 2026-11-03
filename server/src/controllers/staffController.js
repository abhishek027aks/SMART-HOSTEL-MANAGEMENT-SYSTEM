const service = require("../services/staffService");

const respond = (operation, status = 200) => async (req, res, next) => {
    try {
        return res.status(status).json({ status: "success", data: await operation(req) });
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json({ status: "error", message: error.message });
        return next(error);
    }
};

module.exports = {
    create: respond(service.create, 201),
    archive: respond(service.archive),
    deactivate: respond(service.deactivate),
    get: respond(service.get),
    list: respond(service.list),
    restore: respond(service.restore),
    update: respond(service.update)
};
