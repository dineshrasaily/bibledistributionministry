/**
 * Reads and validates the two server secrets. Pure module (no server-only /
 * next imports): scripts call these directly, app code goes through
 * `src/lib/env.ts`.
 */

/** A fatal configuration problem (missing or malformed secret). */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

type Env = { readonly [key: string]: string | undefined };

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** `TOTP_ENCRYPTION_KEY`: base64 that decodes to exactly 32 bytes. */
export function readTotpKey(env: Env = process.env): Buffer {
  const raw = (env.TOTP_ENCRYPTION_KEY ?? "").trim();
  const key = BASE64.test(raw) ? Buffer.from(raw, "base64") : Buffer.alloc(0);
  if (key.length !== 32) {
    throw new ConfigError("TOTP_ENCRYPTION_KEY must be base64 for 32 bytes");
  }
  return key;
}

/** `AUTH_SECRET`: at least 32 characters. */
export function readAuthSecret(env: Env = process.env): string {
  const secret = env.AUTH_SECRET ?? "";
  if (secret.length < 32) {
    throw new ConfigError("AUTH_SECRET must be at least 32 characters");
  }
  return secret;
}
