/**
 * Argon2id password hashing (OWASP baseline parameters). Pure module.
 */
import { randomBytes } from "node:crypto";
import { hash, verify, type Algorithm } from "@node-rs/argon2";

// `Algorithm` is an ambient const enum (not usable with isolatedModules);
// 2 is `Algorithm.Argon2id`.
const ARGON2ID = 2 as Algorithm;

export function hashPassword(password: string): Promise<string> {
  return hash(password, {
    algorithm: ARGON2ID,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

/** False for a wrong password and for a malformed hash. */
export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/**
 * A hash of a random value, computed once per process. Verified against when
 * the account is unknown, inactive or locked so timing does not reveal it.
 */
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(32).toString("hex"));
  return dummyHash;
}
