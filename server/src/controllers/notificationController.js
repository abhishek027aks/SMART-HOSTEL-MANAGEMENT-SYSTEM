const service = require("../services/notificationService");

const respond = (operation) => async (req, res, next) => {
    try {
        return res.status(200).json({
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
    list: respond(service.list),
    markRead: respond(service.markRead),
    markAllRead: respond(service.markAllRead)
};