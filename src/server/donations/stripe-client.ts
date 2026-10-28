import "server-only";
import Stripe from "stripe";
import { resolveStripeConfig } from "@/lib/donations/stripe-config";

/**
 * The narrow part of the Stripe client this app uses. Tests inject fakes
 * through parameters (runCheckoutStart deps, processStripeEvent options);
 * there is no global test setter.
 */
export type StripeLike = {
  checkout: {
    sessions: {
      create(
        params: Stripe.Checkout.SessionCreateParams,
      ): Promise<{ id: string; url: string | null }>;
    };
  };
  invoicePayments: {
    list(params: { invoice: string; limit?: number }): Promise<{
      data: { payment: { payment_intent?: string | { id: string } | null } }[];
    }>;
  };
};

type Env = Record<string, string | undefined>;

let memo: { cacheKey: string; client: Stripe } | null = null;

/**
 * Stripe client for the configured secret key, or null when online giving is
 * not set up. Created lazily (`new Stripe("")` throws) and memoized per key
 * and test override. The loopback override only applies to test keys.
 */
export function getStripeClient(env: Env = process.env): StripeLike | null {
  const config = resolveStripeConfig(env);
  if (!config.checkoutReady) return null;
  const key = env.STRIPE_SECRET_KEY!.trim();
  const cacheKey = `${key}|${JSON.stringify(config.apiOverride)}`;
  if (memo?.cacheKey !== cacheKey) {
    memo = {
      cacheKey,
      client: new Stripe(key, {
        maxNetworkRetries: 2,
        timeout: 15_000,
        telemetry: false,
        appInfo: { name: "mission-app" },
        ...(config.apiOverride ?? {}),
      }),
    };
  }
  return memo.client;
}
