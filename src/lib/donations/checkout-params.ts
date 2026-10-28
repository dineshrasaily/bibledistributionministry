/**
 * Stripe Checkout Session parameters for one gift. Pure module (type-only
 * Stripe import). Never includes donor PII: Stripe collects the email itself.
 *
 * - USD only, inline price_data (no Dashboard products needed).
 * - Card only (Apple Pay / Google Pay are card wallets), so a completed
 *   session always means "paid" and no async-payment events are needed.
 * - metadata.app marks our sessions; the webhook ignores everything else.
 */
import type Stripe from "stripe";
import type { AppLocale } from "@/i18n/routing";

export const STRIPE_METADATA_APP = "mission-site";

export type CheckoutInput = {
  locale: AppLocale;
  interval: "ONE_TIME" | "MONTHLY";
  amountCents: number;
};

export type CheckoutContext = { siteUrl: string; ministryName: string };

export function successUrl(siteUrl: string, locale: AppLocale): string {
  return `${siteUrl.replace(/\/+$/, "")}/${locale}/support/thank-you?session_id={CHECKOUT_SESSION_ID}`;
}

export function cancelUrl(siteUrl: string, locale: AppLocale): string {
  return `${siteUrl.replace(/\/+$/, "")}/${locale}/support/cancelled`;
}

export function buildCheckoutParams(
  input: CheckoutInput,
  ctx: CheckoutContext,
): Stripe.Checkout.SessionCreateParams {
  const monthly = input.interval === "MONTHLY";
  const metadata = {
    app: STRIPE_METADATA_APP,
    interval: input.interval,
    locale: input.locale,
  };
  const name = monthly
    ? `Monthly gift to ${ctx.ministryName}`
    : `Gift to ${ctx.ministryName}`;
  const common = {
    allowed_payment_method_types: ["card"],
    // Stripe Checkout has no Nepali UI; "auto" follows the browser.
    locale: input.locale === "en" ? "en" : "auto",
    success_url: successUrl(ctx.siteUrl, input.locale),
    cancel_url: cancelUrl(ctx.siteUrl, input.locale),
    metadata,
  } satisfies Stripe.Checkout.SessionCreateParams;

  if (monthly) {
    return {
      ...common,
      mode: "subscription",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: input.amountCents,
            recurring: { interval: "month" },
            product_data: { name },
          },
        },
      ],
      subscription_data: { metadata },
    };
  }
  return {
    ...common,
    mode: "payment",
    submit_type: "donate",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: input.amountCents,
          product_data: { name },
        },
      },
    ],
    payment_intent_data: { metadata },
  };
}
