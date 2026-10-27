import "server-only";
import { randomUUID } from "node:crypto";
import { log } from "@/lib/log";
import {
  resolveTurnstileKeys,
  TURNSTILE_DUMMY_TOKEN,
  type TurnstileKeys,
} from "@/lib/turnstile-keys";

export const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

let warnedTestKeys = false;

/**
 * Keys from TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY (read at call time),
 * else Cloudflare's always-pass test pair. The site key is passed to the
 * client as a prop, so no NEXT_PUBLIC_ variable is needed.
 */
export function getTurnstileConfig(): TurnstileKeys {
  const keys = resolveTurnstileKeys(process.env);
  if (
    keys.mode === "test" &&
    process.env.NODE_ENV === "production" &&
    !warnedTestKeys
  ) {
    warnedTestKeys = true;
    log.warn("turnstile.test_keys", {
      note: "TURNSTILE_SITE_KEY/TURNSTILE_SECRET_KEY not set; using Cloudflare test keys (no bot challenge).",
    });
  }
  return keys;
}

export type TurnstileResult =
  { ok: true } | { ok: false; reason: "invalid" | "unavailable" };

type SiteverifyResponse = {
  success?: unknown;
  action?: unknown;
  "error-codes"?: unknown;
};

/**
 * Server-side token check. With the test keys it is offline and accepts
 * exactly Cloudflare's dummy token. With live keys it calls siteverify
 * (no remoteip: data minimisation) and fails closed on network errors.
 */
export async function verifyTurnstile(
  token: string,
  expectedAction: string,
  { fetchImpl = fetch }: { fetchImpl?: typeof fetch } = {},
): Promise<TurnstileResult> {
  const { secretKey, mode } = getTurnstileConfig();
  if (mode === "test") {
    return token === TURNSTILE_DUMMY_TOKEN
      ? { ok: true }
      : { ok: false, reason: "invalid" };
  }

  let data: SiteverifyResponse;
  try {
    const response = await fetchImpl(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
        idempotency_key: randomUUID(),
      }).toString(),
      signal: AbortSignal.timeout(5000),
    });
    data = (await response.json()) as SiteverifyResponse;
  } catch (error) {
    log.warn("turnstile.unavailable", { name: (error as Error)?.name });
    return { ok: false, reason: "unavailable" };
  }

  if (data?.success === true && data.action === expectedAction) {
    return { ok: true };
  }
  log.info("turnstile.rejected", {
    errorCodes: Array.isArray(data?.["error-codes"]) ? data["error-codes"] : [],
    actionMatched: data?.action === expectedAction,
  });
  return { ok: false, reason: "invalid" };
}
