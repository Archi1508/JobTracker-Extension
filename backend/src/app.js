import express from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env.js";
import healthRoutes from "./routes/healthRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

// Decides which browser origins may call the API.
// Requests without an Origin header (curl, tests) are not affected by CORS.
function isAllowedOrigin(origin) {
    if (env.corsOrigins.length > 0) {
        return env.corsOrigins.includes(origin);
    }
    return origin.startsWith("chrome-extension://");
}

// Create and configure the Express application.
// (No app.listen() here — starting the server is server.js's job.)
const app = express();

// Secure HTTP headers (no X-Powered-By, nosniff, etc.)
app.use(helmet());

app.use(cors({
    origin: (origin, callback) => callback(null, !origin || isAllowedOrigin(origin)),
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// Reads a JSON request body (max 100kb) and puts it on req.body
app.use(express.json({ limit: "100kb" }));

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);

// Anything not matched above, then errors from any route.
app.use(notFound);
app.use(errorHandler);

export default app;
