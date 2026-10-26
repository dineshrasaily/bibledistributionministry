/**
 * Vitest `db` project globalSetup: starts the local Postgres (if needed),
 * recreates `mission_unit` and applies migrations. Stops the server at the
 * end only if it started it and no E2E run is using it.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { TestProject } from "vitest/node";
import { assertLocalDbUrls } from "../../scripts/assert-local-db";
import {
  LOCAL_DIR,
  recreateDatabase,
  runPrisma,
  start,
  stop,
  urlFor,
} from "../../scripts/local-db";

const VITEST_MARKER = path.join(LOCAL_DIR, "vitest-running");
const E2E_MARKER = path.join(LOCAL_DIR, "e2e-running");

export default async function setup(
  project: TestProject,
): Promise<() => Promise<void>> {
  const url = urlFor("mission_unit");
  assertLocalDbUrls({ DATABASE_URL: url, DIRECT_URL: url });
  const env = project.config.env ?? {};
  if (env.DATABASE_URL !== url || env.DIRECT_URL !== url) {
    throw new Error(
      "vitest db project must set DATABASE_URL and DIRECT_URL to the mission_unit URL",
    );
  }

  const { startedNow } = await start();
  mkdirSync(LOCAL_DIR, { recursive: true });
  writeFileSync(VITEST_MARKER, String(process.pid));
  await recreateDatabase("mission_unit");
  runPrisma(["migrate", "deploy"], url);

  return async () => {
    rmSync(VITEST_MARKER, { force: true });
    if (startedNow && !existsSync(E2E_MARKER)) stop();
  };
}
