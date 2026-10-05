import dotenv from "dotenv";

// Load backend/.env into process.env (quiet: don't log what was loaded).
dotenv.config({ quiet: true });

// Reads a variable that the server cannot run without.
function required(name) {
    const value = process.env[name];

    if (!value || value.trim() === "") {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value.trim();
}

// Comma separated list -> array, e.g. "a, b" -> ["a", "b"]
function list(value) {
    return (value || "")
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);
}

const jwtSecret = required("JWT_SECRET");

if (jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long");
}

// All configuration in one place. Nothing else reads process.env directly.
export const env = {
    nodeEnv: process.env.NODE_ENV || "development",
    port: Number(process.env.PORT) || 5000,
    databaseUrl: required("DATABASE_URL"),
    jwtSecret: jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
    // Extension origins allowed by CORS, e.g. "chrome-extension://abcdef...".
    // Empty = allow any chrome-extension:// origin (fine for local development).
    corsOrigins: list(process.env.CORS_ORIGINS)
};
