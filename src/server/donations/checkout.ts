import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSiteConfig } from "@/config/site";
import { buildCheckoutParams } from "@/lib/donations/checkout-params";
import { resolveGivingState } from "@/lib/donations/giving-state";
import {
  donationRateLimit,
  resolveStripeConfig,
} from "@/lib/donations/stripe-config";
import { prisma } from "@/lib/db";
import { log } from "@/lib/log";
import { getSiteSettings } from "@/lib/site-settings";
import { fieldErrorsOf } from "@/lib/validation/errors";
import {
  checkoutSchema,
  type DonationFormState,
} from "@/lib/validation/donations";
import { formDataToObject } from "@/server/actions/run-admin-action";
import { clientIp, hashIp } from "@/server/auth/rate-limit";
import { HONEYPOT_FIELD } from "@/server/forms/public-submission";
import { reserveFormSubmission } from "@/server/forms/rate-limit";
import { getStripeClient, type StripeLike } from "./stripe-client";

/**
 * The public donation checkout pipeline:
 * honeypot -> Zod -> giving state -> rate limit (hashed IP) -> Stripe Checkout
 * Session -> redirect to Stripe. Plain server helper (no server-action
 * directive). No card data ever reaches this server; logs never contain
 * emails, amounts or raw IPs.
 */
type Env = Record<string, string | undefined>;

export type CheckoutDeps = {
  env: Env;
  getClient: (env: Env) => StripeLike | null;
};

const defaultDeps: CheckoutDeps = {
  env: process.env,
  getClient: getStripeClient,
};

const STRIPE_CHECKOUT_PREFIX = "https://checkout.stripe.com/";
const LOOPBACK = new Set(["127.0.0.1", "localhost"]);

/** Only Stripe's hosted checkout (or the loopback mock in tests). */
function isAllowedCheckoutUrl(url: string | null, env: Env): url is string {
  if (!url) return false;
  if (url.startsWith(STRIPE_CHECKOUT_PREFIX)) return true;
  if (!resolveStripeConfig(env).apiOverride) return false;
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      LOOPBACK.has(parsed.hostname)
    );
  } catch {
    return false;
  }
}

const localeOf = (value: unknown) => (value === "ne" ? "ne" : "en");

export async function runCheckoutStart(
  formData: FormData,
  deps: CheckoutDeps = defaultDeps,
): Promise<DonationFormState> {
  let destination: string;
  try {
    const raw = formDataToObject(formData);

    // 1. Honeypot: pretend success (thank-you page), call nothing, store nothing.
    const trap = raw[HONEYPOT_FIELD];
    if (typeof trap === "string" && trap.trim() !== "") {
      log.info("form.honeypot", { form: "donation" });
      destination = `/${localeOf(raw.locale)}/support/thank-you`;
    } else {
      // 2. Validation: the amount is decided here, never by the client.
      const parsed = checkoutSchema.safeParse(raw);
      if (!parsed.success) {
        return {
          status: "error",
          code: "VALIDATION",
          fieldErrors: fieldErrorsOf(parsed.error),
        };
      }

      // 3. Giving must be open (secret key + webhook secret set AND enabled
      // in Settings).
      const config = resolveStripeConfig(deps.env);
      const settings = await getSiteSettings();
      const state = resolveGivingState({
        webhookReady: config.webhookReady,
        donationsEnabled: settings.donationsEnabled,
      });
      const client = state === "open" ? deps.getClient(deps.env) : null;
      if (!client) {
        log.info("donation.checkout.not_available", { state });
        return { status: "error", code: "NOT_AVAILABLE" };
      }

      // 4. Rate limit per hashed IP (the raw IP is never stored or logged).
      const ipHash = hashIp(clientIp(await headers()));
      const { limited } = await reserveFormSubmission(prisma, {
        form: "DONATION",
        ipHash,
        now: new Date(),
        limit: donationRateLimit(deps.env),
      });
      if (limited) {
        log.warn("form.rate_limited", {
          form: "donation",
          ip: ipHash.slice(0, 12),
        });
        return { status: "error", code: "RATE_LIMITED" };
      }

      // 5. Stripe Checkout Session (card entry happens on Stripe's page).
      const session = await client.checkout.sessions.create(
        buildCheckoutParams(parsed.data, {
          siteUrl: getSiteConfig().siteUrl,
          ministryName: settings.ministryName,
        }),
      );
      if (!isAllowedCheckoutUrl(session.url, deps.env)) {
        log.error("donation.checkout.bad_url", { session: session.id });
        return { status: "error", code: "ERROR" };
      }
      log.info("donation.checkout.created", {
        session: session.id,
        interval: parsed.data.interval,
      });
      destination = session.url;
    }
  } catch (error) {
    const err = error as { name?: string; type?: string; code?: string };
    log.error("donation.checkout.error", {
      name: err?.name,
      type: err?.type,
      code: err?.code,
    });
    return { status: "error", code: "ERROR" };
  }
  // 6. Outside the try/catch: redirect() works by throwing.
  redirect(destination);
}
