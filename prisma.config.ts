import { defineConfig } from "prisma/config";

// Prisma 7 does not load .env itself. Process env always wins over .env.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: rely on the process environment.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  // DIRECT_URL (Neon non-pooled) is used by the CLI for migrations; the app runtime uses DATABASE_URL.
  datasource: { url: process.env.DIRECT_URL || process.env.DATABASE_URL || "" },
});
