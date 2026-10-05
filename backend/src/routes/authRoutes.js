import { Router } from "express";
import rateLimit from "express-rate-limit";
import { register, login, me, deleteMe } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { registerSchema, loginSchema } from "../validation/authSchemas.js";

// Mounted at /api/auth in app.js
const router = Router();

// Slows down password guessing: at most 20 register/login attempts
// per IP address every 15 minutes.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message: "Too many attempts. Please try again later." }
});

router.post("/register", authLimiter, validate(registerSchema, "Invalid registration data"), register);
router.post("/login", authLimiter, validate(loginSchema, "Invalid login data"), login);
router.get("/me", requireAuth, me);
router.delete("/me", requireAuth, deleteMe);

export default router;
