/**
 * Production-safety fence: destructive and test commands only run against the
 * local Postgres. Pure module (no server-only / next imports) so scripts,
 * Vitest globalSetup and the E2E prepare script can all use it.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";

export class LocalDbGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalDbGuardError";
  }
}

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

function refuse(variable: string): never {
  throw new LocalDbGuardError(
    `Refusing to run: ${variable} points to a non-local database. Destructive and test commands only run against the local Postgres. See README > Switching to Neon.`,
  );
}

function isLocalUrl(value: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(value).hostname);
  } catch {
    return false;
  }
}

/** Throws LocalDbGuardError unless DATABASE_URL (and DIRECT_URL, if set) are local. Never includes the URL in the message. */
export function assertLocalDbUrls(env: {
  DATABASE_URL?: string;
  DIRECT_URL?: string;
  [key: string]: string | undefined;
}): void {
  const databaseUrl = env.DATABASE_URL ?? "";
  if (databaseUrl.trim() === "") {
    throw new LocalDbGuardError(
      "Refusing to run: DATABASE_URL is not set. Destructive and test commands only run against the local Postgres. See README > Local database.",
    );
  }
  if (!isLocalUrl(databaseUrl)) refuse("DATABASE_URL");
  const directUrl = env.DIRECT_URL ?? "";
  if (directUrl.trim() !== "" && !isLocalUrl(directUrl)) refuse("DIRECT_URL");
}

function main(): void {
  try {
    try {
      process.loadEnvFile(".env");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    assertLocalDbUrls(process.env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) main();
