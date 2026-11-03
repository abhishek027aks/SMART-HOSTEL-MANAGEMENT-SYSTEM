const service = require("../services/parentService");

const respond = (operation, status = 200) => async (req, res, next) => {
    try {
        return res.status(status).json({
            status: "success",
            data: await operation(req)
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                status: "error",
                message: error.message
            });
        }
        return next(error);
    }
};

module.exports = {
    archive: respond(service.archive),
    create: respond(service.create, 201),
    get: respond(service.get),
    getMine: respond(service.getMine),
    list: respond(service.list),
    update: respond(service.update)
};
