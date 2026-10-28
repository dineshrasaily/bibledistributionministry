import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { parseDonationListQuery } from "@/lib/validation/donations";
import { resetDb } from "@/test/db-setup";
import { makeDonation, makeDonationSubscription } from "@/test/factories";
import {
  activeSubscriptionCount,
  buildDonationCsv,
  donationTotals,
  lastWebhookAt,
  listDonations,
} from "./donations";

const NOW = new Date("2026-10-15T12:00:00.000Z");
const q = (params: Record<string, string> = {}) =>
  parseDonationListQuery(params);

beforeEach(async () => {
  await resetDb();
});
afterEach(() => {
  vi.useRealTimers();
});

async function seed() {
  const sub = await makeDonationSubscription({ amountCents: 1234 });
  await makeDonation({
    amountCents: 5000,
    paidAt: new Date("2026-10-01T00:00:00.000Z"), // first instant of Oct (UTC)
    donorEmail: "alice@example.org",
    livemode: true,
  });
  await makeDonation({
    amountCents: 1234,
    interval: "MONTHLY",
    paidAt: new Date("2026-10-10T08:00:00.000Z"),
    donorEmail: "Bob@Example.org",
    subscriptionId: sub.id,
    stripePaymentIntentId: null,
    stripeInvoiceId: "in_test_bob",
  });
  await makeDonation({
    amountCents: 10_000,
    amountRefundedCents: 2500,
    status: "PARTIALLY_REFUNDED",
    paidAt: new Date("2026-10-14T23:59:59.999Z"),
    donorEmail: null,
  });
  await makeDonation({
    amountCents: 2500,
    status: "REFUNDED",
    amountRefundedCents: 2500,
    paidAt: new Date("2026-09-30T23:59:59.999Z"), // last instant of Sept (UTC)
    donorEmail: "alice@example.org",
  });
  await makeDonation({
    amountCents: 25_000,
    paidAt: new Date("2025-06-01T00:00:00.000Z"),
    livemode: true,
  });
}

describe("listDonations filters", () => {
  it("this month (UTC) by default, newest first", async () => {
    await seed();
    const page = await listDonations(q(), NOW);
    expect(page.items.map((d) => d.amountCents)).toEqual([10_000, 1234, 5000]);
  });

  it("each filter on its own and combined", async () => {
    await seed();
    const amounts = async (p: Record<string, string>) =>
      (await listDonations(q(p), NOW)).items.map((d) => d.amountCents);
    expect(await amounts({ period: "last-month" })).toEqual([2500]);
    expect(await amounts({ period: "this-year" })).toEqual([
      10_000, 1234, 5000, 2500,
    ]);
    expect(await amounts({ period: "last-year" })).toEqual([25_000]);
    expect(await amounts({ period: "all" })).toHaveLength(5);
    expect(await amounts({ period: "all", interval: "MONTHLY" })).toEqual([
      1234,
    ]);
    expect(await amounts({ period: "all", status: "REFUNDED" })).toEqual([
      2500,
    ]);
    expect(await amounts({ period: "all", mode: "live" })).toEqual([
      5000, 25_000,
    ]);
    expect(await amounts({ period: "all", mode: "test" })).toEqual([
      10_000, 1234, 2500,
    ]);
    expect(
      await amounts({
        period: "this-year",
        mode: "test",
        interval: "ONE_TIME",
      }),
    ).toEqual([10_000, 2500]);
  });

  it("q matches donor emails case-insensitively", async () => {
    await seed();
    const page = await listDonations(q({ period: "all", q: "BOB@" }), NOW);
    expect(page.items.map((d) => d.donorEmail)).toEqual(["Bob@Example.org"]);
    expect(
      (await listDonations(q({ period: "all", q: "alice" }), NOW)).total,
    ).toBe(2);
  });

  it("paginates 20 per page", async () => {
    for (let i = 0; i < 23; i += 1) {
      await makeDonation({ paidAt: new Date(NOW.getTime() - i * 60_000) });
    }
    const first = await listDonations(q(), NOW);
    expect(first).toMatchObject({ total: 23, pageCount: 2, page: 1 });
    expect(first.items).toHaveLength(20);
    const second = await listDonations(q({ page: "2" }), NOW);
    expect(second.items).toHaveLength(3);
  });

  it("the this-month boundary uses UTC (real clock)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T00:30:00.000Z"));
    await makeDonation({ paidAt: new Date("2026-10-31T23:59:00.000Z") });
    await makeDonation({ paidAt: new Date("2026-11-01T00:00:00.000Z") });
    const page = await listDonations(q());
    expect(page.items.map((d) => d.paidAt.toISOString())).toEqual([
      "2026-11-01T00:00:00.000Z",
    ]);
  });
});

describe("donationTotals", () => {
  it("gross, refunded, net, one-time and monthly in exact cents", async () => {
    await seed();
    expect(await donationTotals(q(), NOW)).toEqual({
      count: 3,
      grossCents: 16_234,
      refundedCents: 2500,
      netCents: 13_734,
      oneTimeCents: 15_000,
      monthlyCents: 1234,
    });
    expect(await donationTotals(q({ period: "all" }), NOW)).toEqual({
      count: 5,
      grossCents: 43_734,
      refundedCents: 5000,
      netCents: 38_734,
      oneTimeCents: 42_500,
      monthlyCents: 1234,
    });
  });

  it("an empty set is all zeros", async () => {
    expect(await donationTotals(q(), NOW)).toEqual({
      count: 0,
      grossCents: 0,
      refundedCents: 0,
      netCents: 0,
      oneTimeCents: 0,
      monthlyCents: 0,
    });
  });
});

describe("status helpers", () => {
  it("counts only ACTIVE subscriptions", async () => {
    await makeDonationSubscription();
    await makeDonationSubscription();
    await makeDonationSubscription({ status: "CANCELED" });
    expect(await activeSubscriptionCount()).toBe(2);
  });

  it("lastWebhookAt is the newest ledger row, or null", async () => {
    expect(await lastWebhookAt()).toBeNull();
    await prisma.stripeEvent.create({
      data: {
        id: "evt_test_a",
        type: "invoice.paid",
        livemode: false,
        outcome: "processed",
        processedAt: new Date("2026-10-01T00:00:00.000Z"),
      },
    });
    await prisma.stripeEvent.create({
      data: {
        id: "evt_test_b",
        type: "invoice.paid",
        livemode: false,
        outcome: "ignored",
        processedAt: new Date("2026-10-02T00:00:00.000Z"),
      },
    });
    expect(await lastWebhookAt()).toEqual(new Date("2026-10-02T00:00:00.000Z"));
  });
});

describe("buildDonationCsv", () => {
  it("applies the filters and caps the rows with a truncation line", async () => {
    await seed();
    const all = await buildDonationCsv(new URLSearchParams("period=all"), 3);
    expect(all.rows).toBe(3);
    expect(all.truncated).toBe(true);
    expect(all.csv.endsWith("# truncated at 3 rows\r\n")).toBe(true);
    const monthly = await buildDonationCsv(
      new URLSearchParams("period=all&interval=MONTHLY"),
    );
    expect(monthly.rows).toBe(1);
    expect(monthly.truncated).toBe(false);
    const sub = await prisma.donationSubscription.findFirstOrThrow();
    const line = monthly.csv.split("\r\n")[1]!;
    expect(line).toBe(
      `"2026-10-10T08:00:00.000Z","12.34","USD","Monthly","Paid","0.00","Bob@Example.org","yes","","in_test_bob","${sub.stripeSubscriptionId}"`,
    );
  });
});
