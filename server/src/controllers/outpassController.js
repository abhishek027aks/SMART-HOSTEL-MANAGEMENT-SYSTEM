const service = require("../services/outpassService");

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
    create: respond(service.create, 201),
    list: respond(service.list),
    listMine: respond(service.listMine),
    parentReview: respond(service.parentReview),
    finalDecision: respond(service.finalDecision),
    confirmReturn: respond(service.confirmReturn)
};