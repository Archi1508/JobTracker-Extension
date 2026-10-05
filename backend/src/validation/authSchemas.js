import { z } from "zod";

const credentials = {
    email: z.string().trim().toLowerCase().pipe(z.email("must be a valid email address")),
    password: z.string()
};

// POST /api/auth/register
export const registerSchema = z.object({
    email: credentials.email,
    // bcrypt only uses the first 72 bytes of a password.
    password: credentials.password
        .min(8, "must be at least 8 characters")
        .max(72, "must be at most 72 characters")
});

// POST /api/auth/login
export const loginSchema = z.object({
    email: credentials.email,
    password: credentials.password.min(1, "is required")
});
