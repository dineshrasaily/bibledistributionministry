import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { CredentialsSignin } from "next-auth";
import { headers } from "next/headers";
import type { AdminRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { getTotpKey } from "@/lib/env";
import { log } from "@/lib/log";
import { getSiteSettings } from "@/lib/site-settings";
import {
  applyLock,
  MAX_FAILED_ATTEMPTS,
  refundCredentialAttempt,
  reserveCredentialAttempt,
} from "./lockout";
import { getDummyHash, verifyPassword } from "./password";
import { clientIp, hashIp, reserveIpAttempt } from "./rate-limit";
import { open, seal } from "./secret-box";
import { newTotpSecret, otpauthUri, verifyTotp } from "./totp";

/**
 * Two-step admin login (section 7.6). Every check is an atomic conditional
 * write, so parallel requests cannot exceed the attempt budgets or mint two
 * sessions from one challenge.
 */

export const GENERIC_MSG = "Email or password is incorrect.";
export const RATE_LIMITED_MSG =
  "Too many sign-in attempts from this network. Please wait 15 minutes and try again.";
export const EXPIRED_MSG = "Your sign-in session expired. Please start again.";
export const INVALID_CODE_MSG =
  "That code didn't work. Check the time on your phone and try again.";

export const CHALLENGE_COOKIE = "admin_login_challenge";
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const MAX_CHALLENGE_ATTEMPTS = 5;

/** Injectable clock (tests replace `clock.now`). */
export const clock = { now: (): Date => new Date() };

export type InvalidLoginCode = "invalid_code" | "challenge_expired";

/** Thrown from `authorize`; Auth.js passes AuthError subclasses through unwrapped. */
export class InvalidLoginError extends CredentialsSignin {
  constructor(code: InvalidLoginCode) {
    super();
    this.code = code;
    this.name = "InvalidLoginError";
  }
}

/** State shared by the login actions and the (FEAT-003) login forms. */
export type LoginStep = "credentials" | "verify" | "enroll";
export type LoginState = {
  ok: boolean;
  step: LoginStep;
  formError?: string;
  fieldErrors?: Record<string, string>;
  next?: string | null;
  enrollment?: { otpauthUri: string; secret: string; qrSvg: string };
};

export type AuthorizedAdmin = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  sessionVersion: number;
};

export type BeginLoginResult =
  | { ok: false; reason: "rate_limited" | "invalid"; formError: string }
  | { ok: true; step: "verify"; token: string }
  | {
      ok: true;
      step: "enroll";
      token: string;
      secret: string;
      otpauthUri: string;
    };

export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

async function housekeeping(now: Date): Promise<void> {
  await prisma.loginAttempt.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - 24 * 3_600_000) } },
  });
  await prisma.loginChallenge.deleteMany({
    where: { expiresAt: { lt: new Date(now.getTime() - 3_600_000) } },
  });
}

async function dummyVerify(password: string): Promise<void> {
  await verifyPassword(await getDummyHash(), password);
}

const invalid = (): BeginLoginResult => ({
  ok: false,
  reason: "invalid",
  formError: GENERIC_MSG,
});

/** Step 1: email + password -> a one-time challenge (VERIFY or ENROLL). */
export async function beginLogin(
  input: { email: string; password: string },
  ctx: { ip: string; now?: Date },
): Promise<BeginLoginResult> {
  const now = ctx.now ?? clock.now();
  await housekeeping(now);

  const ipHash = hashIp(ctx.ip);
  const { attemptId, limited } = await reserveIpAttempt(prisma, ipHash, now);
  if (limited) {
    log.warn("auth.login.rate_limited", { ipHash });
    return { ok: false, reason: "rate_limited", formError: RATE_LIMITED_MSG };
  }

  const user = await prisma.adminUser.findUnique({
    where: { email: input.email },
  });
  if (!user) {
    await dummyVerify(input.password);
    log.warn("auth.login.failed", { ipHash, reason: "unknown_email" });
    return invalid();
  }
  await prisma.loginAttempt.update({
    where: { id: attemptId },
    data: { userId: user.id },
  });

  // Reserve-then-verify: at most 5 real-hash checks between locks.
  const reserved = await reserveCredentialAttempt(prisma, user.id, now);
  if (reserved === null) {
    await dummyVerify(input.password);
    log.warn("auth.login.failed", {
      userId: user.id,
      ipHash,
      reason: "inactive_or_locked",
    });
    return invalid();
  }
  if (reserved > MAX_FAILED_ATTEMPTS) {
    await applyLock(prisma, user.id, now);
    await dummyVerify(input.password);
    log.warn("auth.login.failed", {
      userId: user.id,
      ipHash,
      reason: "budget",
    });
    return invalid();
  }

  const correct = await verifyPassword(user.passwordHash, input.password);
  if (!correct) {
    if (reserved === MAX_FAILED_ATTEMPTS) {
      await applyLock(prisma, user.id, now);
    }
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: "auth.login.failed",
        entityType: "AdminUser",
        entityId: user.id,
        metadata: { step: "password" },
      },
    });
    log.warn("auth.login.failed", {
      userId: user.id,
      ipHash,
      reason: "password",
    });
    return invalid();
  }

  // Correct password: refund the reservation (earlier failures stay counted
  // until the TOTP step succeeds).
  await refundCredentialAttempt(prisma, user.id);
  await prisma.loginAttempt.update({
    where: { id: attemptId },
    data: { success: true },
  });

  const token = randomBytes(32).toString("base64url");
  const enroll = !user.totpEnabled || !user.totpSecretEnc;
  const secret = enroll ? newTotpSecret() : null;
  await prisma.$transaction([
    prisma.loginChallenge.deleteMany({
      where: { userId: user.id, consumedAt: null },
    }),
    prisma.loginChallenge.create({
      data: {
        tokenHash: hashToken(token),
        userId: user.id,
        purpose: enroll ? "ENROLL" : "VERIFY",
        pendingSecretEnc: secret
          ? seal(secret, `enroll:${user.id}`, getTotpKey())
          : null,
        expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS),
        createdAt: now,
      },
    }),
  ]);

  if (!secret) return { ok: true, step: "verify", token };
  const settings = await getSiteSettings();
  return {
    ok: true,
    step: "enroll",
    token,
    secret,
    otpauthUri: otpauthUri({
      secret,
      email: user.email,
      issuer: `${settings.ministryName} Admin`,
    }),
  };
}

const expired = () => new InvalidLoginError("challenge_expired");

/**
 * Step 2 (called only from Auth.js `authorize`): challenge + TOTP code ->
 * the admin to put in the session. Throws InvalidLoginError for expected
 * failures; anything else (bad key, tampered secret, DB error) propagates.
 */
export async function completeLogin(
  input: { challengeToken: string; code: string },
  ctx: { ip: string; now?: Date },
): Promise<AuthorizedAdmin> {
  const now = ctx.now ?? clock.now();
  const ipHash = hashIp(ctx.ip);

  const { attemptId, limited } = await reserveIpAttempt(prisma, ipHash, now);
  if (limited) {
    log.warn("auth.login.rate_limited", { ipHash });
    throw expired();
  }

  const tokenHash = hashToken(input.challengeToken);
  const reservedChallenge = await prisma.loginChallenge.updateMany({
    where: {
      tokenHash,
      consumedAt: null,
      expiresAt: { gt: now },
      attempts: { lt: MAX_CHALLENGE_ATTEMPTS },
    },
    data: { attempts: { increment: 1 } },
  });
  if (reservedChallenge.count !== 1) {
    log.info("auth.login.challenge_expired", { ipHash });
    throw expired();
  }
  const challenge = await prisma.loginChallenge.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!challenge) throw expired();
  const { user } = challenge;
  await prisma.loginAttempt.update({
    where: { id: attemptId },
    data: { userId: user.id },
  });

  const reserved = await reserveCredentialAttempt(prisma, user.id, now);
  if (reserved === null) throw expired();
  if (reserved > MAX_FAILED_ATTEMPTS) {
    await applyLock(prisma, user.id, now);
    throw expired();
  }

  const enroll = challenge.purpose === "ENROLL";
  const sealed = enroll ? challenge.pendingSecretEnc : user.totpSecretEnc;
  if (!sealed) throw expired();
  const secret = open(
    sealed,
    enroll ? `enroll:${user.id}` : `totp:${user.id}`,
    getTotpKey(),
  );

  const check = await verifyTotp(secret, input.code, user.lastTotpStep, now);
  if (!check.valid) {
    let locked = false;
    if (reserved === MAX_FAILED_ATTEMPTS) {
      await applyLock(prisma, user.id, now);
      locked = true;
    }
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: "auth.login.failed",
        entityType: "AdminUser",
        entityId: user.id,
        metadata: { step: "totp" },
      },
    });
    log.warn("auth.login.failed", { userId: user.id, ipHash, reason: "totp" });
    // A challenge consumed by a parallel request is "start again", not "wrong code".
    const current = await prisma.loginChallenge.findUnique({
      where: { id: challenge.id },
      select: { consumedAt: true },
    });
    if (
      locked ||
      challenge.attempts >= MAX_CHALLENGE_ATTEMPTS ||
      current?.consumedAt
    ) {
      throw expired();
    }
    throw new InvalidLoginError("invalid_code");
  }

  const timeStep = check.timeStep;
  await prisma.$transaction(async (tx) => {
    const c = await tx.loginChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    const u = await tx.adminUser.updateMany({
      where: {
        id: user.id,
        isActive: true,
        OR: [{ lastTotpStep: null }, { lastTotpStep: { lt: timeStep } }],
      },
      data: {
        lastTotpStep: timeStep,
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: now,
        ...(enroll
          ? {
              totpSecretEnc: seal(secret, `totp:${user.id}`, getTotpKey()),
              totpEnabled: true,
            }
          : {}),
      },
    });
    // Rolls back both writes.
    if (c.count !== 1 || u.count !== 1) throw expired();
    await tx.loginAttempt.update({
      where: { id: attemptId },
      data: { success: true, userId: user.id },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: "auth.login.success",
        entityType: "AdminUser",
        entityId: user.id,
      },
    });
    if (enroll) {
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorEmail: user.email,
          action: "auth.totp.enrolled",
          entityType: "AdminUser",
          entityId: user.id,
        },
      });
    }
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    sessionVersion: user.sessionVersion,
  };
}

/** Auth.js Credentials `authorize` for the "admin-totp" provider. */
export async function authorizeAdminTotp(
  raw: Partial<Record<string, unknown>>,
): Promise<AuthorizedAdmin> {
  const challengeToken = typeof raw.challenge === "string" ? raw.challenge : "";
  const code = typeof raw.code === "string" ? raw.code.replace(/\s+/g, "") : "";
  if (!challengeToken) throw expired();
  if (!/^\d{6}$/.test(code)) throw new InvalidLoginError("invalid_code");
  const ip = clientIp(await headers());
  return completeLogin({ challengeToken, code }, { ip });
}
