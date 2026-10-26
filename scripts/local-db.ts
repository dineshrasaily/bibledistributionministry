/**
 * Docker-free local PostgreSQL (embedded-postgres binaries).
 * Used by the db:start/stop/status npm scripts, the Vitest db globalSetup and
 * scripts/e2e-prepare.ts. Pure module: no server-only / next imports.
 *
 * Dev-only credentials: the server only listens on 127.0.0.1.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { assertLocalDbUrls } from "./assert-local-db";

export const PORT = 54329;
export const HOST = "127.0.0.1";
export const USER = "postgres";
export const PASSWORD = "postgres";
export const ROOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const LOCAL_DIR = path.join(ROOT_DIR, ".local");
export const DATA_DIR = path.join(LOCAL_DIR, "postgres");
export const DATABASES = [
  "mission_dev",
  "mission_unit",
  "mission_test",
] as const;
export type DatabaseName = (typeof DATABASES)[number];

const RECREATABLE: readonly DatabaseName[] = ["mission_unit", "mission_test"];

const PLATFORM_PACKAGES: Partial<
  Record<NodeJS.Platform, Partial<Record<string, string>>>
> = {
  win32: { x64: "@embedded-postgres/windows-x64" },
  darwin: {
    arm64: "@embedded-postgres/darwin-arm64",
    x64: "@embedded-postgres/darwin-x64",
  },
  linux: {
    x64: "@embedded-postgres/linux-x64",
    arm64: "@embedded-postgres/linux-arm64",
  },
};

const localRequire = createRequire(import.meta.url);

function binaries(): { pg_ctl: string } {
  const pkg = PLATFORM_PACKAGES[process.platform]?.[process.arch];
  if (!pkg) {
    throw new Error(
      `Local Postgres is not available for ${process.platform}/${process.arch}. Set DATABASE_URL to another Postgres server.`,
    );
  }
  const { pg_ctl } = localRequire(pkg) as { pg_ctl: string };
  return { pg_ctl };
}

export function urlFor(name: DatabaseName): string {
  return `postgresql://${USER}:${PASSWORD}@${HOST}:${PORT}/${name}`;
}

export async function ensureInitialised(): Promise<void> {
  if (existsSync(path.join(DATA_DIR, "PG_VERSION"))) return;
  const server = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
    // Without these initdb picks WIN1252 on Windows, which cannot store Devanagari.
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
  });
  await server.initialise();
}

export function isRunning(): boolean {
  if (!existsSync(path.join(DATA_DIR, "PG_VERSION"))) return false;
  const { pg_ctl } = binaries();
  const result = spawnSync(pg_ctl, ["-D", DATA_DIR, "status"], {
    stdio: "ignore",
    windowsHide: true,
  });
  return result.status === 0;
}

function serverLogTail(): string {
  const logFile = path.join(DATA_DIR, "server.log");
  if (!existsSync(logFile)) return "(no server.log)";
  return readFileSync(logFile, "utf8").split(/\r?\n/).slice(-20).join("\n");
}

async function withAdminClient<T>(
  fn: (client: pg.Client) => Promise<T>,
): Promise<T> {
  const client = new pg.Client({
    host: HOST,
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: "postgres",
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Creates the database if missing. Names are constants, never user input. */
export async function ensureDatabase(name: DatabaseName): Promise<void> {
  if (!DATABASES.includes(name)) throw new Error(`Unknown database ${name}`);
  await withAdminClient(async (client) => {
    const existing = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [name],
    );
    if (existing.rowCount === 0)
      await client.query(`CREATE DATABASE "${name}"`);
  });
}

/** Drops and recreates a test database. Only mission_unit and mission_test are allowed. */
export async function recreateDatabase(name: DatabaseName): Promise<void> {
  if (!RECREATABLE.includes(name)) {
    throw new Error(`recreateDatabase only supports ${RECREATABLE.join(", ")}`);
  }
  await withAdminClient(async (client) => {
    await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${name}"`);
  });
}

export async function start(): Promise<{ startedNow: boolean }> {
  await ensureInitialised();
  if (isRunning()) return { startedNow: false };
  const { pg_ctl } = binaries();
  // stdio "ignore" is required: with captured output the detached postgres child
  // inherits the pipe and the caller hangs forever.
  const result = spawnSync(
    pg_ctl,
    [
      "-D",
      DATA_DIR,
      "-l",
      path.join(DATA_DIR, "server.log"),
      "-o",
      `-p ${PORT} -c listen_addresses=${HOST}`,
      "-w",
      "-t",
      "60",
      "start",
    ],
    { stdio: "ignore", windowsHide: true },
  );
  if (result.status !== 0) {
    // A concurrent start() may have won the race; treat that as running.
    if (isRunning()) return { startedNow: false };
    throw new Error(
      `pg_ctl start failed (exit ${result.status}).\n${serverLogTail()}`,
    );
  }
  for (const name of DATABASES) await ensureDatabase(name);
  return { startedNow: true };
}

export function stop(): void {
  if (!isRunning()) return;
  const { pg_ctl } = binaries();
  const result = spawnSync(
    pg_ctl,
    ["-D", DATA_DIR, "-m", "fast", "-w", "stop"],
    {
      stdio: "ignore",
      windowsHide: true,
    },
  );
  if (result.status !== 0)
    throw new Error(`pg_ctl stop failed (exit ${result.status}).`);
}

const prismaCli = localRequire.resolve("prisma/build/index.js");

/** The only way harness code invokes the Prisma CLI (spawnSync("npx") fails on Windows + Node 24). */
export function runPrisma(args: string[], url: string): void {
  assertLocalDbUrls({ DATABASE_URL: url, DIRECT_URL: url });
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: ROOT_DIR,
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`prisma ${args.join(" ")} failed (exit ${result.status})`);
}

async function main(): Promise<void> {
  const command = process.argv[2];
  try {
    if (command === "start") {
      const { startedNow } = await start();
      console.log(
        startedNow
          ? `Local Postgres started on ${HOST}:${PORT}.`
          : `Local Postgres already running on ${HOST}:${PORT}.`,
      );
      console.log(`Dev database: ${urlFor("mission_dev")}`);
    } else if (command === "stop") {
      const wasRunning = isRunning();
      stop();
      console.log(
        wasRunning
          ? "Local Postgres stopped."
          : "Local Postgres is not running.",
      );
    } else if (command === "status") {
      console.log(
        isRunning()
          ? `Local Postgres is running on ${HOST}:${PORT}.`
          : "Local Postgres is stopped.",
      );
    } else {
      throw new Error("Usage: tsx scripts/local-db.ts start|stop|status");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) void main();
