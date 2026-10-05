import { prisma } from "../db/prisma.js";

// GET /api/health → is the API up, and can it reach the database?
export async function getHealth(req, res) {
    try {
        await prisma.$queryRaw`SELECT 1`;

        res.status(200).json({
            success: true,
            message: "Job Tracker API is running",
            database: "connected"
        });
    } catch (error) {
        console.error("Health check: database unreachable:", error.message);

        // 503 Service Unavailable: the API is up but cannot do its job.
        res.status(503).json({
            success: false,
            message: "Job Tracker API is running, but the database is unreachable",
            database: "disconnected"
        });
    }
}
