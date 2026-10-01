import express from "express";
import healthRoutes from "./routes/healthRoutes.js";

// Create and configure the Express application.
// (No app.listen() here — starting the server is server.js's job.)
const app = express();

// Every route in healthRoutes is mounted under /api/health
app.use("/api/health", healthRoutes);

export default app;
