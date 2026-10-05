import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

function unauthorized(res, message) {
    return res.status(401).json({ success: false, message: message });
}

// Middleware: only lets requests with a valid "Authorization: Bearer <token>"
// header through, and sets req.user = { id } for the controllers.
export function requireAuth(req, res, next) {
    const header = req.get("Authorization") || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
        return unauthorized(res, "Please log in to continue.");
    }

    try {
        const payload = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
        req.user = { id: Number(payload.sub) };
        next();
    } catch {
        return unauthorized(res, "Your session has expired. Please log in again.");
    }
}
