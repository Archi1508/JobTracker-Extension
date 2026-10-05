import app from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./db/prisma.js";

async function start() {
    // Fail fast with a clear message if the database is unreachable.
    try {
        await prisma.$connect();
        await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
        console.error("Could not connect to the database. Check DATABASE_URL in backend/.env.");
        console.error(error.message);
        process.exit(1);
    }

    const server = app.listen(env.port, () => {
        console.log(`Job Tracker API running on http://localhost:${env.port}`);
    });

    // Close the HTTP server and database pool cleanly on Ctrl+C / kill.
    async function shutdown() {
        server.close();
        await prisma.$disconnect();
        process.exit(0);
    }

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

start();
