import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../config/env.js";

// Prisma 7 talks to PostgreSQL through a driver adapter (node-postgres here).
const adapter = new PrismaPg({ connectionString: env.databaseUrl });

// One shared client = one connection pool for the whole app.
export const prisma = new PrismaClient({ adapter });
