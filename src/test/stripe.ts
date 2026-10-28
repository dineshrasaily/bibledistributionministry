/**
 * Stripe test helpers: synthetic fixture events (fake ids, no real data) and
 * signatures made with Stripe's own generateTestHeaderString. No network.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import Stripe from "stripe";

export const WEBHOOK_SECRET = "whsec_unit_test_secret";

export type FixtureName =
  | "checkout-session-completed-payment"
  | "checkout-session-completed-subscription"
  | "checkout-session-completed-unpaid"
  | "checkout-session-completed-foreign-app"
  | "checkout-session-completed-eur"
  | "invoice-paid"
  | "charge-refunded-partial"
  | "charge-refunded-full"
  | "customer-subscription-deleted"
  | "payment-intent-succeeded";

export const ALL_FIXTURES: FixtureName[] = [
  "checkout-session-completed-payment",
  "checkout-session-completed-subscription",
  "checkout-session-completed-unpaid",
  "checkout-session-completed-foreign-app",
  "checkout-session-completed-eur",
  "invoice-paid",
  "charge-refunded-partial",
  "charge-refunded-full",
  "customer-subscription-deleted",
  "payment-intent-succeeded",
];

/** A fresh (deep-copied) fixture event; override fields as needed. */
export function stripeFixture(name: FixtureName): Stripe.Event {
  const file = path.join(
    process.cwd(),
    "src/test/fixtures/stripe",
    `${name}.json`,
  );
  return JSON.parse(readFileSync(file, "utf8")) as Stripe.Event;
}

/** JSON payload + Stripe-Signature header for an event. */
export function signedRequest(
  event: unknown,
  {
    secret = WEBHOOK_SECRET,
    timestamp,
  }: { secret?: string; timestamp?: number } = {},
): { payload: string; header: string } {
  const payload = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
    ...(timestamp !== undefined ? { timestamp } : {}),
  });
  return { payload, header };
}
