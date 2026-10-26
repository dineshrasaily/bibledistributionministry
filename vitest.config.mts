import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Same value as urlFor("mission_unit") in scripts/local-db.ts (kept literal so
// loading this config never pulls in the Postgres tooling).
const MISSION_UNIT_URL =
  "postgresql://postgres:postgres@127.0.0.1:54329/mission_unit";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./src/test/empty-module.ts", import.meta.url),
      ),
    },
  },
  test: {
    css: false,
    // next-auth imports "next/server" without an extension (not valid Node
    // ESM); let Vite resolve it instead of Node.
    server: { deps: { inline: ["next-auth"] } },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: ["./src/test/setup.ts"],
          include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
          exclude: ["src/**/*.db.test.ts", "**/node_modules/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "db",
          environment: "node",
          include: ["src/**/*.db.test.ts", "prisma/**/*.db.test.ts"],
          globalSetup: ["./src/test/db-global-setup.ts"],
          setupFiles: ["./src/test/db-setup.ts"],
          fileParallelism: false,
          testTimeout: 20000,
          hookTimeout: 60000,
          env: {
            // Both URLs point at the local unit DB so a Neon DIRECT_URL in .env can never be used.
            DATABASE_URL: MISSION_UNIT_URL,
            DIRECT_URL: MISSION_UNIT_URL,
            AUTH_SECRET: randomBytes(32).toString("base64"),
            TOTP_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
          },
        },
      },
    ],
  },
});
