/**
 * TOTP helpers on the otplib 13 functional API. Pure module.
 */
import { generate, generateSecret, generateURI, verify } from "otplib";

/** New base32 secret (20 random bytes = 32 base32 characters). */
export function newTotpSecret(): string {
  return generateSecret();
}

export function otpauthUri(opts: {
  secret: string;
  email: string;
  issuer: string;
}): string {
  return generateURI({
    issuer: opts.issuer,
    label: opts.email,
    secret: opts.secret,
  });
}

/** Unix seconds for otplib's `epoch` option. */
export function toEpoch(now: Date): number {
  return Math.floor(now.getTime() / 1000);
}

export type TotpCheck = { valid: true; timeStep: number } | { valid: false };

/**
 * Verifies a 6-digit code with +-30 s tolerance. `lastStep` (the last
 * accepted time step) rejects replays of that step or older.
 */
export async function verifyTotp(
  secret: string,
  code: string,
  lastStep: number | null,
  now: Date = new Date(),
): Promise<TotpCheck> {
  try {
    const result = await verify({
      secret,
      token: code,
      epochTolerance: 30,
      epoch: toEpoch(now),
      ...(lastStep != null ? { afterTimeStep: lastStep } : {}),
    });
    return result.valid && "timeStep" in result
      ? { valid: true, timeStep: result.timeStep }
      : { valid: false };
  } catch {
    // otplib throws on malformed tokens; treat as a wrong code.
    return { valid: false };
  }
}

/** Current code for a secret (CLI confirmation, tests, E2E helpers). */
export function generateTotp(
  secret: string,
  now: Date = new Date(),
): Promise<string> {
  return generate({ secret, epoch: toEpoch(now) });
}
