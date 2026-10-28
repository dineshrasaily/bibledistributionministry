import type Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db-setup";
import {
  ALL_FIXTURES,
  signedRequest,
  stripeFixture,
  WEBHOOK_SECRET,
} from "@/test/stripe";
import type { StripeLike } from "./stripe-client";
import {
  HANDLED_EVENT_TYPES,
  InvalidSignatureError,
  processStripeEvent,
  verifyStripeEvent,
} from "./webhook";

let list: ReturnType<typeof vi.fn>;
let client: StripeLike;

beforeEach(async () => {
  await resetDb();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      throw new Error(`unexpected network call to ${String(input)}`);
    }),
  );
  list = vi.fn(async () => ({
    data: [
      {
        payment: {
          type: "payment_intent",
          payment_intent: "pi_test_invoice_1",
        },
      },
    ],
  }));
  client = {
    checkout: { sessions: { create: vi.fn() } },
    invoicePayments: { list },
  } as unknown as StripeLike;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const handle = (event: Stripe.Event) => processStripeEvent(event, { client });
const events = () => prisma.stripeEvent.findMany({ orderBy: { id: "asc" } });

describe("verifyStripeEvent (signature on the raw body)", () => {
  const event = stripeFixture("checkout-session-completed-payment");

  it("accepts a valid signature (generateTestHeaderString + constructEvent)", () => {
    const { payload, header } = signedRequest(event);
    expect(verifyStripeEvent(payload, header, WEBHOOK_SECRET).id).toBe(
      event.id,
    );
    // Raw bytes work too (what the route passes).
    expect(
      verifyStripeEvent(Buffer.from(payload), header, WEBHOOK_SECRET).id,
    ).toBe(event.id);
  });

  it("rejects a wrong secret, a tampered body, a stale timestamp, a missing or malformed header", () => {
    const { payload, header } = signedRequest(event);
    const tampered = payload.replace(
      '"amount_total":5000',
      '"amount_total":5001',
    );
    expect(tampered).not.toBe(payload);
    const stale = signedRequest(event, {
      timestamp: Math.floor(Date.now() / 1000) - 301,
    });
    const cases: [string, string | null, string][] = [
      [payload, header, "whsec_wrong_secret"],
      [tampered, header, WEBHOOK_SECRET],
      [`${payload} `, header, WEBHOOK_SECRET],
      [stale.payload, stale.header, WEBHOOK_SECRET],
      [payload, null, WEBHOOK_SECRET],
      [payload, "", WEBHOOK_SECRET],
      [payload, "t=123,v1=deadbeef", WEBHOOK_SECRET],
      [payload, "garbage", WEBHOOK_SECRET],
    ];
    for (const [body, sig, secret] of cases) {
      expect(() => verifyStripeEvent(body, sig, secret)).toThrow(
        InvalidSignatureError,
      );
    }
  });
});

describe("processStripeEvent: each handled event type", () => {
  it("handles exactly the four event types from the brief", () => {
    expect(HANDLED_EVENT_TYPES.sort()).toEqual(
      [
        "charge.refunded",
        "checkout.session.completed",
        "customer.subscription.deleted",
        "invoice.paid",
      ].sort(),
    );
  });

  it("checkout.session.completed (payment): one ONE_TIME PAID donation", async () => {
    expect(
      await handle(stripeFixture("checkout-session-completed-payment")),
    ).toEqual({
      outcome: "processed",
    });
    const [d, ...rest] = await prisma.donation.findMany();
    expect(rest).toEqual([]);
    expect(d).toMatchObject({
      amountCents: 5000,
      currency: "usd",
      interval: "ONE_TIME",
      status: "PAID",
      amountRefundedCents: 0,
      donorEmail: "donor.one@example.org",
      livemode: false,
      stripeCheckoutSessionId: "cs_test_payment_1",
      stripePaymentIntentId: "pi_test_payment_1",
      stripeCustomerId: "cus_test_donor1",
      stripeInvoiceId: null,
      subscriptionId: null,
      paidAt: new Date(1793000000 * 1000),
    });
    expect(await events()).toMatchObject([
      {
        id: "evt_test_checkout_payment",
        type: "checkout.session.completed",
        outcome: "processed",
        livemode: false,
      },
    ]);
  });

  it("checkout.session.completed (subscription): one ACTIVE subscription, no donation yet", async () => {
    expect(
      await handle(stripeFixture("checkout-session-completed-subscription")),
    ).toEqual({ outcome: "processed" });
    expect(await prisma.donation.count()).toBe(0);
    expect(await prisma.donationSubscription.findMany()).toMatchObject([
      {
        stripeSubscriptionId: "sub_test_monthly_1",
        status: "ACTIVE",
        amountCents: 1234,
        donorEmail: "monthly@example.org",
        canceledAt: null,
      },
    ]);
  });

  it("invoice.paid: one MONTHLY donation linked to the subscription, PI from invoicePayments.list", async () => {
    await handle(stripeFixture("checkout-session-completed-subscription"));
    expect(await handle(stripeFixture("invoice-paid"))).toEqual({
      outcome: "processed",
    });
    expect(list).toHaveBeenCalledWith({
      invoice: "in_test_monthly_1",
      limit: 1,
    });
    const sub = await prisma.donationSubscription.findUniqueOrThrow({
      where: { stripeSubscriptionId: "sub_test_monthly_1" },
    });
    expect(await prisma.donation.findMany()).toMatchObject([
      {
        amountCents: 1234,
        interval: "MONTHLY",
        status: "PAID",
        stripeInvoiceId: "in_test_monthly_1",
        stripePaymentIntentId: "pi_test_invoice_1",
        stripeCustomerId: "cus_test_donor2",
        donorEmail: "monthly@example.org",
        subscriptionId: sub.id,
        paidAt: new Date(1793000160 * 1000),
      },
    ]);
  });

  it("invoice.paid uses the payment intent from the payload when present (no API call)", async () => {
    const event = stripeFixture("invoice-paid");
    (event.data.object as unknown as Record<string, unknown>).payments = {
      object: "list",
      data: [
        {
          payment: { type: "payment_intent", payment_intent: "pi_test_inline" },
        },
      ],
    };
    await handle(event);
    expect(list).not.toHaveBeenCalled();
    expect(
      (await prisma.donation.findFirstOrThrow()).stripePaymentIntentId,
    ).toBe("pi_test_inline");
  });

  it("invoice.paid before checkout.session.completed: works in either order, one subscription", async () => {
    await handle(stripeFixture("invoice-paid"));
    await handle(stripeFixture("checkout-session-completed-subscription"));
    expect(await prisma.donationSubscription.count()).toBe(1);
    expect(await prisma.donation.count()).toBe(1);
    const sub = await prisma.donationSubscription.findFirstOrThrow();
    expect(sub).toMatchObject({ status: "ACTIVE", amountCents: 1234 });
    expect((await prisma.donation.findFirstOrThrow()).subscriptionId).toBe(
      sub.id,
    );
  });

  it("charge.refunded: partial then full -> PARTIALLY_REFUNDED then REFUNDED", async () => {
    await handle(stripeFixture("checkout-session-completed-payment"));
    expect(await handle(stripeFixture("charge-refunded-partial"))).toEqual({
      outcome: "processed",
    });
    expect(await prisma.donation.findFirstOrThrow()).toMatchObject({
      status: "PARTIALLY_REFUNDED",
      amountRefundedCents: 1500,
      refundedAt: new Date(1793001000 * 1000),
    });
    await handle(stripeFixture("charge-refunded-full"));
    expect(await prisma.donation.findFirstOrThrow()).toMatchObject({
      status: "REFUNDED",
      amountRefundedCents: 5000,
    });
  });

  it("charge.refunded out of order never lowers the refunded total", async () => {
    await handle(stripeFixture("checkout-session-completed-payment"));
    await handle(stripeFixture("charge-refunded-full"));
    await handle(stripeFixture("charge-refunded-partial"));
    expect(await prisma.donation.findFirstOrThrow()).toMatchObject({
      status: "REFUNDED",
      amountRefundedCents: 5000,
    });
  });

  it("customer.subscription.deleted: CANCELED with canceledAt", async () => {
    await handle(stripeFixture("checkout-session-completed-subscription"));
    expect(
      await handle(stripeFixture("customer-subscription-deleted")),
    ).toEqual({ outcome: "processed" });
    expect(await prisma.donationSubscription.findFirstOrThrow()).toMatchObject({
      status: "CANCELED",
      canceledAt: new Date(1793008900 * 1000),
    });
  });

  it("customer.subscription.deleted for an unknown subscription: ours -> created CANCELED, foreign -> ignored", async () => {
    expect(
      await handle(stripeFixture("customer-subscription-deleted")),
    ).toEqual({ outcome: "processed" });
    expect(await prisma.donationSubscription.findFirstOrThrow()).toMatchObject({
      status: "CANCELED",
      amountCents: 1234,
    });
    const foreign = stripeFixture("customer-subscription-deleted");
    foreign.id = "evt_test_sub_deleted_foreign";
    const sub = foreign.data.object as Stripe.Subscription;
    sub.id = "sub_test_foreign";
    sub.metadata = {};
    expect(await handle(foreign)).toEqual({ outcome: "ignored" });
    expect(await prisma.donationSubscription.count()).toBe(1);
  });
});

describe("processStripeEvent: ignored events", () => {
  it.each([
    "checkout-session-completed-unpaid",
    "checkout-session-completed-foreign-app",
    "checkout-session-completed-eur",
    "payment-intent-succeeded",
  ] as const)("%s -> ignored, ledger row, no donation", async (name) => {
    const event = stripeFixture(name);
    expect(await handle(event)).toEqual({ outcome: "ignored" });
    expect(await prisma.donation.count()).toBe(0);
    expect(await prisma.donationSubscription.count()).toBe(0);
    expect(await events()).toMatchObject([
      { id: event.id, outcome: "ignored" },
    ]);
  });

  it("a refund for an unknown payment -> ignored", async () => {
    expect(await handle(stripeFixture("charge-refunded-partial"))).toEqual({
      outcome: "ignored",
    });
  });

  it("invoice.paid for a foreign subscription -> ignored, no API call", async () => {
    const event = stripeFixture("invoice-paid");
    const inv = event.data.object as Stripe.Invoice;
    inv.parent!.subscription_details!.metadata = { app: "another-shop" };
    expect(await handle(event)).toEqual({ outcome: "ignored" });
    expect(list).not.toHaveBeenCalled();
    expect(await prisma.donationSubscription.count()).toBe(0);
  });
});

describe("processStripeEvent: idempotency", () => {
  it("the same event twice -> duplicate; one donation, one ledger row", async () => {
    const event = stripeFixture("checkout-session-completed-payment");
    expect(await handle(event)).toEqual({ outcome: "processed" });
    expect(await handle(event)).toEqual({ outcome: "duplicate" });
    expect(await prisma.donation.count()).toBe(1);
    expect(await prisma.stripeEvent.count()).toBe(1);
  });

  it("a re-send under a NEW event id for the same session -> still one donation", async () => {
    await handle(stripeFixture("checkout-session-completed-payment"));
    const again = stripeFixture("checkout-session-completed-payment");
    again.id = "evt_test_checkout_payment_resent";
    expect(await handle(again)).toEqual({ outcome: "processed" });
    expect(await prisma.donation.count()).toBe(1);
    expect(await prisma.stripeEvent.count()).toBe(2);
  });

  it("the same invoice twice under different ids -> one monthly donation", async () => {
    await handle(stripeFixture("invoice-paid"));
    const again = stripeFixture("invoice-paid");
    again.id = "evt_test_invoice_paid_resent";
    await handle(again);
    expect(await prisma.donation.count()).toBe(1);
  });

  it("concurrent deliveries of the same event -> one row", async () => {
    const event = stripeFixture("checkout-session-completed-payment");
    const results = await Promise.all([
      handle(event),
      handle(structuredClone(event)),
      handle(structuredClone(event)),
    ]);
    expect(results.map((r) => r.outcome).sort()).toEqual([
      "duplicate",
      "duplicate",
      "processed",
    ]);
    expect(await prisma.donation.count()).toBe(1);
    expect(await prisma.stripeEvent.count()).toBe(1);
  });
});

describe("processStripeEvent: failures roll back so Stripe can retry", () => {
  it("a failing Stripe lookup (invoice.paid) stores nothing; the retry succeeds", async () => {
    list.mockRejectedValueOnce(new Error("Stripe API down"));
    const event = stripeFixture("invoice-paid");
    await expect(handle(event)).rejects.toThrow("Stripe API down");
    expect(await prisma.stripeEvent.count()).toBe(0);
    expect(await prisma.donation.count()).toBe(0);
    expect(await handle(event)).toEqual({ outcome: "processed" });
    expect(await prisma.donation.count()).toBe(1);
  });

  it("a handler error inside the transaction rolls back the ledger row too", async () => {
    const failingDb = {
      stripeEvent: prisma.stripeEvent,
      $transaction: ((fn: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        prisma.$transaction((tx) =>
          fn(
            new Proxy(tx, {
              get(target, prop, receiver) {
                if (prop === "donation") {
                  return {
                    ...target.donation,
                    upsert: async () => {
                      throw new Error("disk full");
                    },
                  };
                }
                return Reflect.get(target, prop, receiver);
              },
            }),
          ),
        )) as typeof prisma.$transaction,
    };
    const event = stripeFixture("checkout-session-completed-payment");
    await expect(
      processStripeEvent(event, { db: failingDb, client }),
    ).rejects.toThrow("disk full");
    expect(await prisma.stripeEvent.count()).toBe(0);
    expect(await prisma.donation.count()).toBe(0);
    expect(await handle(event)).toEqual({ outcome: "processed" });
  });
});

describe("no card data is stored", () => {
  it("after every fixture, no card details exist in any donation row", async () => {
    for (const name of ALL_FIXTURES) await handle(stripeFixture(name));
    const dump = JSON.stringify([
      await prisma.donation.findMany(),
      await prisma.donationSubscription.findMany(),
      await prisma.stripeEvent.findMany(),
    ]);
    expect(dump).not.toContain("4242");
    expect(dump).not.toMatch(/card|last4|visa|exp_/i);
  });

  it("the Donation and DonationSubscription models have no card-like columns", () => {
    const fields = [
      ...Object.keys(Prisma.DonationScalarFieldEnum),
      ...Object.keys(Prisma.DonationSubscriptionScalarFieldEnum),
    ];
    for (const field of fields) {
      expect(field).not.toMatch(
        /card|last4|brand|exp(iry|_|M|Y)|cvc|billing|address/i,
      );
    }
  });
});
