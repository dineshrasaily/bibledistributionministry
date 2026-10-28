/**
 * Playwright globalTeardown: stop the local Postgres only if e2e:prepare
 * started it and no Vitest db run is using it.
 *
 * Playwright loads this file as CommonJS, where scripts/local-db.ts
 * (import.meta.url) cannot be imported, so the stop goes through the
 * `local-db.ts stop` CLI under tsx instead.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const ROOT_DIR = path.resolve(__dirname, "..");
const LOCAL_DIR = path.join(ROOT_DIR, ".local");

export default async function globalTeardown(): Promise<void> {
  const started = path.join(LOCAL_DIR, "e2e-started-db");
  const running = path.join(LOCAL_DIR, "e2e-running");
  const vitest = path.join(LOCAL_DIR, "vitest-running");

  rmSync(running, { force: true });

  // Phase 8: a leftover second app server (e2e/helpers/stripe-server.ts).
  const stripePid = path.join(LOCAL_DIR, "e2e-stripe-server.pid");
  if (existsSync(stripePid)) {
    const pid = Number(readFileSync(stripePid, "utf8").trim());
    if (Number.isInteger(pid) && pid > 0) {
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/pid", String(pid), "/t", "/f"], {
          stdio: "ignore",
          windowsHide: true,
        });
      } else {
        try {
          process.kill(pid, "SIGTERM");
        } catch {
          // already gone
        }
      }
    }
    rmSync(stripePid, { force: true });
  }

  if (existsSync(started) && !existsSync(vitest)) {
    const tsxCli = createRequire(__filename).resolve("tsx/cli");
    const result = spawnSync(
      process.execPath,
      [tsxCli, "scripts/local-db.ts", "stop"],
      {
        cwd: ROOT_DIR,
        stdio: "ignore",
        windowsHide: true,
      },
    );
    if (result.status !== 0)
      console.warn("[e2e teardown] could not stop local Postgres");
  }
  rmSync(started, { force: true });
}
