// Prisma CLI configuration (used by `prisma migrate` / `prisma generate`).
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // process.env (not prisma's env()) so `prisma generate` also works on a
    // fresh clone before .env exists; migrate commands still need it set.
    url: process.env.DATABASE_URL ?? "",
  },
});
