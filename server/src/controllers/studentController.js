const service = require("../services/studentService");

const sendError = (error, res, next) => {
    if (error.statusCode) return res.status(error.statusCode).json({ status: "error", message: error.message });
    return next(error);
};
const list = async (req, res, next) => { try { return res.status(200).json({ status: "success", data: await service.list(req) }); } catch (error) { return sendError(error, res, next); } };
const get = async (req, res, next) => { try { return res.status(200).json({ status: "success", data: await service.get(req) }); } catch (error) { return sendError(error, res, next); } };
const create = async (req, res, next) => { try { return res.status(201).json({ status: "success", data: await service.create(req) }); } catch (error) { return sendError(error, res, next); } };
const update = async (req, res, next) => { try { return res.status(200).json({ status: "success", data: await service.update(req) }); } catch (error) { return sendError(error, res, next); } };
const archive = async (req, res, next) => { try { return res.status(200).json({ status: "success", data: await service.archive(req) }); } catch (error) { return sendError(error, res, next); } };
const restore = async (req, res, next) => { try { return res.status(200).json({ status: "success", data: await service.restore(req) }); } catch (error) { return sendError(error, res, next); } };
module.exports = { archive, create, get, list, restore, update };
