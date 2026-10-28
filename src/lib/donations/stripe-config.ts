/**
 * Stripe configuration status, derived from the environment per request.
 * Pure module. The derived statuses go to the UI; the values never do.
 */

type Env = Record<string, string | undefined>;

export type SecretKeyStatus = "missing" | "test" | "live" | "invalid";

export type StripeApiOverride = {
  protocol: "http" | "https";
  host: string;
  port: number;
};

export type StripeConfig = {
  secretKey: SecretKeyStatus;
  /** Checkout can be started (a test or live secret key is set). */
  checkoutReady: boolean;
  /** The webhook can verify signatures (checkoutReady + whsec_ secret). */
  webhookReady: boolean;
  webhookSecretSet: boolean;
  /** Stripe customer portal login link (https://billing.stripe.com/...). */
  portalUrl: string | null;
  /** Tests only: loopback mock Stripe API, honoured only with a test key. */
  apiOverride: StripeApiOverride | null;
};

function keyStatus(raw: string): SecretKeyStatus {
  if (raw === "") return "missing";
  if (/^(sk|rk)_test_\S+$/.test(raw)) return "test";
  if (/^(sk|rk)_live_\S+$/.test(raw)) return "live";
  return "invalid";
}

function portalUrlOf(raw: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" &&
      url.hostname === "billing.stripe.com" &&
      !url.username &&
      !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

const LOOPBACK = new Set(["127.0.0.1", "localhost"]);

function overrideOf(
  raw: string,
  key: SecretKeyStatus,
): StripeApiOverride | null {
  if (!raw || key !== "test") return null;
  try {
    const url = new URL(raw);
    if (!LOOPBACK.has(url.hostname)) return null;
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const protocol = url.protocol === "https:" ? "https" : "http";
    const port = url.port ? Number(url.port) : protocol === "https" ? 443 : 80;
    return { protocol, host: url.hostname, port };
  } catch {
    return null;
  }
}

export function resolveStripeConfig(env: Env): StripeConfig {
  const secretKey = keyStatus(env.STRIPE_SECRET_KEY?.trim() ?? "");
  const checkoutReady = secretKey === "test" || secretKey === "live";
  const webhookSecretSet = /^whsec_\S+$/.test(
    env.STRIPE_WEBHOOK_SECRET?.trim() ?? "",
  );
  return {
    secretKey,
    checkoutReady,
    webhookReady: checkoutReady && webhookSecretSet,
    webhookSecretSet,
    portalUrl: portalUrlOf(env.STRIPE_CUSTOMER_PORTAL_URL?.trim() ?? ""),
    apiOverride: overrideOf(
      env.STRIPE_API_BASE_URL_FOR_TESTS?.trim() ?? "",
      secretKey,
    ),
  };
}

export const DEFAULT_DONATION_RATE_LIMIT = 10;

/** DONATION_RATE_LIMIT_PER_HOUR: integer 1..1000, anything else -> 10. */
export function donationRateLimit(env: Env): number {
  const raw = env.DONATION_RATE_LIMIT_PER_HOUR?.trim();
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_DONATION_RATE_LIMIT;
  const n = Number(raw);
  return n >= 1 && n <= 1000 ? n : DEFAULT_DONATION_RATE_LIMIT;
}
