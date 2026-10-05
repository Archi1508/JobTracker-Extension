import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";

function unauthorized(res, message) {
    return res.status(401).json({ success: false, message: message });
}

// Middleware: only lets requests with a valid "Authorization: Bearer <token>"
// header through, and sets req.user = { id } for the controllers.
export async function requireAuth(req, res, next) {
    const header = req.get("Authorization") || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
        return unauthorized(res, "Please log in to continue.");
    }

    let userId;
    try {
        const payload = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
        userId = Number(payload.sub);
    } catch {
        return unauthorized(res, "Your session has expired. Please log in again.");
    }

    // A token stays valid until it expires, even if the account was deleted,
    // so check that the user still exists (a fast primary-key lookup).
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });

    if (!user) {
        return unauthorized(res, "Your account no longer exists. Please log in again.");
    }

    req.user = { id: user.id };
    next();
}
