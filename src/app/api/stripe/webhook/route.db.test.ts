import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db-setup";
import { signedRequest, stripeFixture, WEBHOOK_SECRET } from "@/test/stripe";
import * as routeModule from "./route";
import { POST } from "./route";

const URL = "http://localhost/api/stripe/webhook";

function webhookRequest(
  body: string,
  signature: string | null,
  extraHeaders: Record<string, string> = {},
) {
  const headers = new Headers({
    "content-type": "application/json",
    ...extraHeaders,
  });
  if (signature !== null) headers.set("stripe-signature", signature);
  return new Request(URL, { method: "POST", headers, body });
}

const signed = (name: Parameters<typeof stripeFixture>[0]) => {
  const { payload, header } = signedRequest(stripeFixture(name));
  return webhookRequest(payload, header);
};

let logs: string[];

beforeEach(async () => {
  await resetDb();
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
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_unit_fake");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/stripe/webhook", () => {
  it("exports only POST (plus route config)", () => {
    expect(Object.keys(routeModule).sort()).toEqual(
      ["POST", "dynamic", "runtime"].sort(),
    );
  });

  it("503 NOT_CONFIGURED without keys (nothing processed)", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const res = await POST(signed("checkout-session-completed-payment"));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "NOT_CONFIGURED" });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await prisma.stripeEvent.count()).toBe(0);
  });

  it("503 with a key but no signing secret", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect(
      (await POST(signed("checkout-session-completed-payment"))).status,
    ).toBe(503);
  });

  it("400 for a missing or bad signature; the body is never logged", async () => {
    const { payload } = signedRequest(
      stripeFixture("checkout-session-completed-payment"),
    );
    for (const sig of [null, "t=1,v1=00", "nonsense"]) {
      const res = await POST(webhookRequest(payload, sig));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "INVALID_SIGNATURE" });
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
    const wrong = signedRequest(
      stripeFixture("checkout-session-completed-payment"),
      { secret: "whsec_someone_else" },
    );
    expect(
      (await POST(webhookRequest(wrong.payload, wrong.header))).status,
    ).toBe(400);
    expect(await prisma.stripeEvent.count()).toBe(0);
    expect(logs.join("\n")).toContain("stripe.webhook.invalid_signature");
    expect(logs.join("\n")).not.toMatch(/donor\.one|cs_test_payment_1/i);
  });

  it("413 when the body is over 1 MiB (declared or actual)", async () => {
    const big = "x".repeat(1024 * 1024 + 1);
    const declared = await POST(
      webhookRequest("{}", "t=1,v1=00", {
        "content-length": String(big.length),
      }),
    );
    expect(declared.status).toBe(413);
    const actual = await POST(webhookRequest(big, "t=1,v1=00"));
    expect(actual.status).toBe(413);
  });

  it("200 processed, then 200 duplicate for the same event", async () => {
    const first = await POST(signed("checkout-session-completed-payment"));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      received: true,
      outcome: "processed",
    });
    expect(first.headers.get("cache-control")).toBe("no-store");
    const second = await POST(signed("checkout-session-completed-payment"));
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ received: true, duplicate: true });
    expect(await prisma.donation.count()).toBe(1);
  });

  it("200 ignored for an unhandled event type", async () => {
    const res = await POST(signed("payment-intent-succeeded"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, outcome: "ignored" });
  });

  it("500 when processing fails (Stripe retries), and the retry succeeds", async () => {
    const spy = vi
      .spyOn(prisma, "$transaction")
      .mockRejectedValueOnce(new Error("database unavailable"));
    const res = await POST(signed("checkout-session-completed-payment"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "PROCESSING_FAILED" });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await prisma.stripeEvent.count()).toBe(0);
    spy.mockRestore();
    const retry = await POST(signed("checkout-session-completed-payment"));
    expect(retry.status).toBe(200);
    expect(await prisma.donation.count()).toBe(1);
  });
});
