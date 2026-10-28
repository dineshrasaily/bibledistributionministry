import { describe, expect, it } from "vitest";
import { donationRateLimit, resolveStripeConfig } from "./stripe-config";

const TEST_KEY = "sk_test_unit_fake";

describe("resolveStripeConfig", () => {
  it.each([
    [undefined, "missing", false],
    ["", "missing", false],
    ["   ", "missing", false],
    ["sk_test_abc", "test", true],
    ["rk_test_abc", "test", true],
    ["sk_live_abc", "live", true],
    ["rk_live_abc", "live", true],
    ["pk_test_abc", "invalid", false],
    ["sk_test_", "invalid", false],
    ["whsec_abc", "invalid", false],
    ["hello", "invalid", false],
  ])("secret key %j -> %s", (key, status, ready) => {
    const config = resolveStripeConfig({ STRIPE_SECRET_KEY: key });
    expect(config.secretKey).toBe(status);
    expect(config.checkoutReady).toBe(ready);
  });

  it("the webhook needs a key AND a whsec_ secret", () => {
    expect(
      resolveStripeConfig({
        STRIPE_SECRET_KEY: TEST_KEY,
        STRIPE_WEBHOOK_SECRET: "whsec_x",
      }).webhookReady,
    ).toBe(true);
    expect(
      resolveStripeConfig({ STRIPE_WEBHOOK_SECRET: "whsec_x" }).webhookReady,
    ).toBe(false);
    const wrong = resolveStripeConfig({
      STRIPE_SECRET_KEY: TEST_KEY,
      STRIPE_WEBHOOK_SECRET: "secret",
    });
    expect(wrong.webhookReady).toBe(false);
    expect(wrong.webhookSecretSet).toBe(false);
  });

  it("accepts only an https billing.stripe.com portal link", () => {
    const portal = (url: string) =>
      resolveStripeConfig({ STRIPE_CUSTOMER_PORTAL_URL: url }).portalUrl;
    expect(portal("https://billing.stripe.com/p/login/test_abc")).toBe(
      "https://billing.stripe.com/p/login/test_abc",
    );
    expect(portal("http://billing.stripe.com/p/login/x")).toBeNull();
    expect(portal("https://billing.stripe.com.evil.example/p")).toBeNull();
    expect(portal("https://evil.example/p")).toBeNull();
    expect(portal("https://user:pw@billing.stripe.com/p")).toBeNull();
    expect(portal("not a url")).toBeNull();
    expect(portal("")).toBeNull();
  });

  it("honours the test API override only for loopback + a test key", () => {
    const override = (url: string, key = TEST_KEY) =>
      resolveStripeConfig({
        STRIPE_SECRET_KEY: key,
        STRIPE_API_BASE_URL_FOR_TESTS: url,
      }).apiOverride;
    expect(override("http://127.0.0.1:3212")).toEqual({
      protocol: "http",
      host: "127.0.0.1",
      port: 3212,
    });
    expect(override("http://localhost:3212")?.host).toBe("localhost");
    expect(override("https://api.example.com:443")).toBeNull();
    expect(override("http://10.0.0.5:3212")).toBeNull();
    expect(override("http://127.0.0.1:3212", "sk_live_abc")).toBeNull();
    expect(override("http://127.0.0.1:3212", "")).toBeNull();
    expect(override("not a url")).toBeNull();
    expect(override("ftp://127.0.0.1:21")).toBeNull();
    expect(override("")).toBeNull();
  });
});

describe("donationRateLimit", () => {
  it("defaults to 10 and accepts 1..1000", () => {
    expect(donationRateLimit({})).toBe(10);
    expect(donationRateLimit({ DONATION_RATE_LIMIT_PER_HOUR: "3" })).toBe(3);
    expect(donationRateLimit({ DONATION_RATE_LIMIT_PER_HOUR: "1000" })).toBe(
      1000,
    );
    for (const bad of ["0", "1001", "-1", "2.5", "abc", " "]) {
      expect(donationRateLimit({ DONATION_RATE_LIMIT_PER_HOUR: bad })).toBe(10);
    }
  });
});
