import "server-only";
import { readAuthSecret, readTotpKey } from "@/server/auth/keys";

/** Server-only, memoized access to the app secrets (scripts use keys.ts). */
let authSecret: string | undefined;
let totpKey: Buffer | undefined;

export function getAuthSecret(): string {
  authSecret ??= readAuthSecret();
  return authSecret;
}

export function getTotpKey(): Buffer {
  totpKey ??= readTotpKey();
  return totpKey;
}
