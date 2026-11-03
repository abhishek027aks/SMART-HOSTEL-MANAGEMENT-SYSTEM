const service = require("../services/facilityService");

const respond = (operation, statusCode = 200) => async (req, res, next) => {
    try {
        const data = await operation(req.params.resource, req);
        res.status(statusCode).json({ status: "success", data });
    } catch (error) {
        if (error.statusCode) {
            res.status(error.statusCode).json({ status: "error", message: error.message });
            return;
        }
        next(error);
    }
};

const controller = {
    list: respond(service.list),
    get: respond(service.get),
    create: respond(service.create, 201),
    update: respond(service.update),
    archive: respond(service.archive)
};

module.exports = controller;
