/**
 * AES-256-GCM sealing for authenticator secrets. Format
 * `v1:<iv b64url>:<tag b64url>:<ciphertext b64url>`; the AAD binds a
 * ciphertext to its row (`totp:<userId>` / `enroll:<userId>`).
 * Pure module: the key is a parameter defaulting to `readTotpKey()`.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ConfigError, readTotpKey } from "./keys";

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function assertKey(key: Buffer): void {
  if (key.length !== 32) {
    throw new ConfigError("TOTP_ENCRYPTION_KEY must be base64 for 32 bytes");
  }
}

export function seal(
  plaintext: string,
  aad: string,
  key: Buffer = readTotpKey(),
): string {
  assertKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ct.toString("base64url"),
  ].join(":");
}

/** Throws on unknown version, malformed input, wrong AAD/key or tampering. */
export function open(
  sealed: string,
  aad: string,
  key: Buffer = readTotpKey(),
): string {
  assertKey(key);
  const parts = sealed.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Unsupported sealed value");
  }
  const iv = Buffer.from(parts[1]!, "base64url");
  const tag = Buffer.from(parts[2]!, "base64url");
  const ct = Buffer.from(parts[3]!, "base64url");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("Malformed sealed value");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString(
    "utf8",
  );
}
