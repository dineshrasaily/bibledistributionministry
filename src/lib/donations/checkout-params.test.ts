import { describe, expect, it } from "vitest";
import { buildCheckoutParams, STRIPE_METADATA_APP } from "./checkout-params";

const ctx = { siteUrl: "https://example.org/", ministryName: "Test Ministry" };

describe("buildCheckoutParams", () => {
  it("one-time gift: payment mode, USD, cents, donate button, card only", () => {
    const params = buildCheckoutParams(
      { locale: "en", interval: "ONE_TIME", amountCents: 5000 },
      ctx,
    );
    expect(params).toEqual({
      mode: "payment",
      submit_type: "donate",
      allowed_payment_method_types: ["card"],
      locale: "en",
      success_url:
        "https://example.org/en/support/thank-you?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://example.org/en/support/cancelled",
      metadata: {
        app: STRIPE_METADATA_APP,
        interval: "ONE_TIME",
        locale: "en",
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: 5000,
            product_data: { name: "Gift to Test Ministry" },
          },
        },
      ],
      payment_intent_data: {
        metadata: {
          app: STRIPE_METADATA_APP,
          interval: "ONE_TIME",
          locale: "en",
        },
      },
    });
  });

  it("monthly gift: subscription mode with a monthly inline price", () => {
    const params = buildCheckoutParams(
      { locale: "ne", interval: "MONTHLY", amountCents: 1234 },
      ctx,
    );
    expect(params.mode).toBe("subscription");
    expect(params).not.toHaveProperty("submit_type");
    expect(params).not.toHaveProperty("payment_intent_data");
    expect(params.line_items?.[0]?.price_data).toEqual({
      currency: "usd",
      unit_amount: 1234,
      recurring: { interval: "month" },
      product_data: { name: "Monthly gift to Test Ministry" },
    });
    expect(params.subscription_data?.metadata).toEqual({
      app: STRIPE_METADATA_APP,
      interval: "MONTHLY",
      locale: "ne",
    });
    expect(params.success_url).toBe(
      "https://example.org/ne/support/thank-you?session_id={CHECKOUT_SESSION_ID}",
    );
    expect(params.cancel_url).toBe("https://example.org/ne/support/cancelled");
    expect(params.locale).toBe("auto");
    expect(params.allowed_payment_method_types).toEqual(["card"]);
  });

  it("never sends donor PII or a customer", () => {
    const json = JSON.stringify(
      buildCheckoutParams(
        { locale: "en", interval: "ONE_TIME", amountCents: 2500 },
        ctx,
      ),
    );
    expect(json).not.toMatch(/customer|email|@/);
  });
});
