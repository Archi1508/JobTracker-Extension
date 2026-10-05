import { HttpError } from "../utils/httpError.js";

// 404 for any route that does not exist.
export function notFound(req, res) {
    res.status(404).json({
        success: false,
        message: "Route not found"
    });
}

// Central error handler. Express sends every thrown/rejected error here
// (Express 5 also catches errors from async route handlers).
// Clients get a short safe message; details only go to the server log.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
    if (err instanceof HttpError) {
        return res.status(err.status).json({
            success: false,
            message: err.message,
            ...err.extra
        });
    }

    // Errors raised by express.json() while reading the body.
    if (err.type === "entity.parse.failed") {
        return res.status(400).json({ success: false, message: "Request body is not valid JSON" });
    }
    if (err.type === "entity.too.large") {
        return res.status(413).json({ success: false, message: "Request body is too large" });
    }

    console.error(err);

    res.status(500).json({
        success: false,
        message: "Something went wrong on the server"
    });
}
