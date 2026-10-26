import "server-only";
import { createHash } from "node:crypto";
import { getAuthSecret } from "@/lib/env";
import type { Db } from "./lockout";

export const IP_WINDOW_MS = 15 * 60 * 1000;
export const IP_MAX_FAILURES = 20;

/** sha256(AUTH_SECRET + ip): the raw IP is never stored. */
export function hashIp(ip: string, secret: string = getAuthSecret()): string {
  return createHash("sha256")
    .update(secret + ip)
    .digest("hex");
}

/**
 * Client IP for the rate-limit key.
 *
 * Trust assumption: this key relies on Vercel overwriting `x-forwarded-for`
 * with the real client IP. Behind any other proxy (or a bare `next start`),
 * derive the IP from that proxy's trusted header instead, because a client
 * can rotate `x-forwarded-for` itself. The per-account lockout is the
 * primary control; this limit is defence in depth.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Insert-then-count: the attempt row is committed before counting, so the
 * k-th committed request sees at least k rows and at most 20 failures per
 * window get past this check even in parallel.
 */
export async function reserveIpAttempt(
  db: Db,
  ipHash: string,
  now: Date,
): Promise<{ attemptId: string; limited: boolean }> {
  const attempt = await db.loginAttempt.create({
    data: { ipHash, success: false, createdAt: now },
    select: { id: true },
  });
  const count = await db.loginAttempt.count({
    where: {
      ipHash,
      success: false,
      createdAt: { gt: new Date(now.getTime() - IP_WINDOW_MS) },
    },
  });
  return { attemptId: attempt.id, limited: count > IP_MAX_FAILURES };
}
