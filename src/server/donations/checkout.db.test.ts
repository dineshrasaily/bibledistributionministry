import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSiteSettings, getSiteConfig } from "@/config/site";
import { prisma } from "@/lib/db";
import { buildCheckoutParams } from "@/lib/donations/checkout-params";
import type { DonationFormState } from "@/lib/validation/donations";
import { NavigationSignal, resetDb, testRequest } from "@/test/db-setup";
import { form } from "@/test/forms";
import { allAttemptRows } from "@/test/inbox-rows";
import { runCheckoutStart, type CheckoutDeps } from "./checkout";
import { getStripeClient, type StripeLike } from "./stripe-client";

const IP = "198.51.100.23";
const TEST_ENV = {
  STRIPE_SECRET_KEY: "sk_test_unit_fake",
  // Phase 9: giving opens only when the webhook can record the gift too.
  STRIPE_WEBHOOK_SECRET: "whsec_unit_fake",
  DONATION_RATE_LIMIT_PER_HOUR: "",
};
const CHECKOUT_URL = "https://checkout.stripe.com/c/pay/cs_test_unit_1";

let logs: string[];
let create: ReturnType<typeof vi.fn>;
let fake: StripeLike;

function deps(env: Record<string, string> = TEST_ENV): CheckoutDeps {
  return { env, getClient: () => fake };
}

async function settings(donationsEnabled: boolean) {
  await prisma.siteSettings.create({
    data: {
      ...defaultSiteSettings,
      id: "singleton",
      ministryName: "Unit Ministry",
      donationsEnabled,
    },
  });
}

const giveForm = (fields: Record<string, string> = {}) =>
  form({
    locale: "en",
    interval: "ONE_TIME",
    amountChoice: "50",
    customAmount: "",
    website: "",
    ...fields,
  });

/** Runs the pipeline; returns the redirect target or the error state. */
async function run(
  fd: FormData,
  d: CheckoutDeps = deps(),
): Promise<{ redirect: string } | DonationFormState> {
  try {
    return await runCheckoutStart(fd, d);
  } catch (error) {
    if (error instanceof NavigationSignal && error.kind === "redirect") {
      return { redirect: error.location! };
    }
    throw error;
  }
}

beforeEach(async () => {
  await resetDb();
  testRequest.headers.set("x-forwarded-for", IP);
  logs = [];
  for (const level of ["info", "warn", "error"] as const) {
    vi.spyOn(console, level).mockImplementation((line: unknown) => {
      logs.push(String(line));
    });
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      throw new Error(`unexpected network call to ${String(input)}`);
    }),
  );
  create = vi.fn(async () => ({ id: "cs_test_unit_1", url: CHECKOUT_URL }));
  fake = {
    checkout: { sessions: { create } },
    invoicePayments: { list: vi.fn() },
  } as unknown as StripeLike;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("runCheckoutStart: checks before Stripe", () => {
  it("not configured (no key): NOT_AVAILABLE and Stripe is never called", async () => {
    await settings(true);
    expect(await run(giveForm(), deps({ STRIPE_SECRET_KEY: "" }))).toEqual({
      status: "error",
      code: "NOT_AVAILABLE",
    });
    expect(create).not.toHaveBeenCalled();
    expect(await allAttemptRows()).toEqual([]);
  });

  it("a secret key without a webhook signing secret: NOT_AVAILABLE, no Stripe call", async () => {
    await settings(true);
    expect(
      await run(
        giveForm(),
        deps({
          STRIPE_SECRET_KEY: "sk_test_unit_fake",
          STRIPE_WEBHOOK_SECRET: "",
        }),
      ),
    ).toEqual({ status: "error", code: "NOT_AVAILABLE" });
    expect(create).not.toHaveBeenCalled();
    expect(await allAttemptRows()).toEqual([]);
  });

  it("the real client factory returns null without a key", () => {
    expect(getStripeClient({ STRIPE_SECRET_KEY: "" })).toBeNull();
    expect(getStripeClient({ STRIPE_SECRET_KEY: "nonsense" })).toBeNull();
  });

  it("closed (keys set, donations disabled): NOT_AVAILABLE", async () => {
    await settings(false);
    expect(await run(giveForm())).toEqual({
      status: "error",
      code: "NOT_AVAILABLE",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("closed when the settings row is missing (default: disabled)", async () => {
    expect(await run(giveForm())).toMatchObject({ code: "NOT_AVAILABLE" });
  });

  it.each([
    [{ amountChoice: "custom", customAmount: "4" }, "amountTooSmall:5"],
    [{ amountChoice: "custom", customAmount: "10001" }, "amountTooLarge:10000"],
    [{ amountChoice: "custom", customAmount: "abc" }, "amountInvalid"],
    [{ amountChoice: "custom", customAmount: "" }, "amountRequired"],
  ])(
    "invalid amount %j -> VALIDATION %s, no Stripe call",
    async (fields, key) => {
      await settings(true);
      expect(await run(giveForm(fields))).toEqual({
        status: "error",
        code: "VALIDATION",
        fieldErrors: { customAmount: key },
      });
      expect(create).not.toHaveBeenCalled();
      expect(await allAttemptRows()).toEqual([]);
    },
  );

  it("a tampered preset is rejected", async () => {
    await settings(true);
    expect(await run(giveForm({ amountChoice: "1" }))).toEqual({
      status: "error",
      code: "VALIDATION",
      fieldErrors: { amountChoice: "amountRequired" },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("honeypot: pretends success (thank-you page), no Stripe call, no attempt row", async () => {
    await settings(true);
    expect(
      await run(giveForm({ website: "https://spam.example", locale: "ne" })),
    ).toEqual({ redirect: "/ne/support/thank-you" });
    expect(create).not.toHaveBeenCalled();
    expect(await allAttemptRows()).toEqual([]);
  });

  it("rate limit: the limit plus one -> RATE_LIMITED; the raw IP is never stored", async () => {
    await settings(true);
    const env = { ...TEST_ENV, DONATION_RATE_LIMIT_PER_HOUR: "2" };
    expect(await run(giveForm(), deps(env))).toHaveProperty("redirect");
    expect(await run(giveForm(), deps(env))).toHaveProperty("redirect");
    expect(await run(giveForm(), deps(env))).toEqual({
      status: "error",
      code: "RATE_LIMITED",
    });
    expect(create).toHaveBeenCalledTimes(2);
    const rows = await allAttemptRows();
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.form).toBe("DONATION");
      expect(row.ipHash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.ipHash).not.toContain(IP);
    }
    expect(logs.join("\n")).not.toContain(IP);
  });
});

describe("runCheckoutStart: Stripe Checkout", () => {
  it("one-time $50: the params match buildCheckoutParams and it redirects to Stripe", async () => {
    await settings(true);
    expect(await run(giveForm())).toEqual({ redirect: CHECKOUT_URL });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]![0]).toEqual(
      buildCheckoutParams(
        { locale: "en", interval: "ONE_TIME", amountCents: 5000 },
        { siteUrl: getSiteConfig().siteUrl, ministryName: "Unit Ministry" },
      ),
    );
  });

  it("monthly custom $12.34 in Nepali: subscription params", async () => {
    await settings(true);
    expect(
      await run(
        giveForm({
          locale: "ne",
          interval: "MONTHLY",
          amountChoice: "custom",
          customAmount: "12.34",
        }),
      ),
    ).toEqual({ redirect: CHECKOUT_URL });
    expect(create.mock.calls[0]![0]).toEqual(
      buildCheckoutParams(
        { locale: "ne", interval: "MONTHLY", amountCents: 1234 },
        { siteUrl: getSiteConfig().siteUrl, ministryName: "Unit Ministry" },
      ),
    );
  });

  it("a session URL that is not Stripe's checkout -> ERROR, no redirect", async () => {
    await settings(true);
    for (const url of [
      "https://evil.example/pay",
      "http://checkout.stripe.com/c/pay/x",
      "https://checkout.stripe.com.evil.example/x",
      null,
    ]) {
      create.mockResolvedValueOnce({ id: "cs_test_bad", url });
      expect(await run(giveForm()), String(url)).toEqual({
        status: "error",
        code: "ERROR",
      });
    }
  });

  it("a loopback session URL is accepted only with the test override", async () => {
    await settings(true);
    create.mockResolvedValue({
      id: "cs_test_e2e",
      url: "http://localhost:3211/en/support/thank-you",
    });
    expect(await run(giveForm())).toMatchObject({ code: "ERROR" });
    expect(
      await run(
        giveForm(),
        deps({
          ...TEST_ENV,
          STRIPE_API_BASE_URL_FOR_TESTS: "http://127.0.0.1:3212",
        }),
      ),
    ).toEqual({ redirect: "http://localhost:3211/en/support/thank-you" });
    // A live key never honours the override.
    expect(
      await run(
        giveForm(),
        deps({
          STRIPE_SECRET_KEY: "sk_live_unit_fake",
          STRIPE_WEBHOOK_SECRET: TEST_ENV.STRIPE_WEBHOOK_SECRET,
          STRIPE_API_BASE_URL_FOR_TESTS: "http://127.0.0.1:3212",
        }),
      ),
    ).toMatchObject({ code: "ERROR" });
  });

  it("a Stripe error -> ERROR; the log has no email or amount", async () => {
    await settings(true);
    create.mockRejectedValueOnce(
      Object.assign(new Error("Your card was declined for donor@example.org"), {
        name: "StripeInvalidRequestError",
        type: "invalid_request_error",
        code: "parameter_invalid",
      }),
    );
    expect(await run(giveForm({ amountChoice: "250" }))).toEqual({
      status: "error",
      code: "ERROR",
    });
    const all = logs.join("\n");
    expect(all).toContain("donation.checkout.error");
    expect(all).toContain("StripeInvalidRequestError");
    expect(all).not.toMatch(/donor@example\.org|25000|\b250\b/);
  });

  it("the real client with a live key never uses the test override", () => {
    const client = getStripeClient({
      STRIPE_SECRET_KEY: "sk_live_unit_fake",
      STRIPE_API_BASE_URL_FOR_TESTS: "http://127.0.0.1:3212",
    }) as unknown as { _api: { host: string; port: string | number } };
    expect(client).not.toBeNull();
    expect(client._api.host).toBe("api.stripe.com");
    const testClient = getStripeClient({
      STRIPE_SECRET_KEY: "sk_test_unit_fake",
      STRIPE_API_BASE_URL_FOR_TESTS: "http://127.0.0.1:3212",
    }) as unknown as { _api: { host: string; port: string | number } };
    expect(testClient._api.host).toBe("127.0.0.1");
    expect(Number(testClient._api.port)).toBe(3212);
  });
});
