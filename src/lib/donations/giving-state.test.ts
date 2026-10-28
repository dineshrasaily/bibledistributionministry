import { describe, expect, it } from "vitest";
import { resolveGivingState } from "./giving-state";
import { resolveStripeConfig } from "./stripe-config";
describe("resolveGivingState", () => {
  it.each([
    [false, false, "not-configured"],
    [false, true, "not-configured"],
    [true, false, "closed"],
    [true, true, "open"],
  ] as const)(
    "webhookReady=%s donationsEnabled=%s -> %s",
    (webhookReady, donationsEnabled, state) => {
      expect(resolveGivingState({ webhookReady, donationsEnabled })).toBe(
        state,
      );
    },
  );
  // Rewritten in Phase 9 (Phase 8 review LOW #1): a secret key alone used to
  // open giving although the webhook could not record the gifts.
  it("stays not-configured with a secret key but no webhook signing secret", () => {
    const config = resolveStripeConfig({ STRIPE_SECRET_KEY: "sk_test_abc" });
    expect(config.checkoutReady).toBe(true);
    expect(
      resolveGivingState({
        webhookReady: config.webhookReady,
        donationsEnabled: true,
      }),
    ).toBe("not-configured");
  });
  it("opens with a secret key and a webhook signing secret", () => {
    const config = resolveStripeConfig({
      STRIPE_SECRET_KEY: "sk_test_abc",
      STRIPE_WEBHOOK_SECRET: "whsec_abc",
    });
    expect(
      resolveGivingState({
        webhookReady: config.webhookReady,
        donationsEnabled: true,
      }),
    ).toBe("open");
  });
});
