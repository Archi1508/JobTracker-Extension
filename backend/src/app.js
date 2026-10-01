import express from "express";
import healthRoutes from "./routes/healthRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";

// Create and configure the Express application.
// (No app.listen() here — starting the server is server.js's job.)
const app = express();

// Middleware: reads a JSON request body and puts it on req.body
app.use(express.json());

// Every route in healthRoutes is mounted under /api/health
app.use("/api/health", healthRoutes);

// Every route in jobRoutes is mounted under /api/jobs
app.use("/api/jobs", jobRoutes);

export default app;
