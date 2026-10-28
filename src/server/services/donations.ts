import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { toCsv, type CsvValue } from "@/lib/donations/csv";
import { periodRange } from "@/lib/donations/period";
import { PAGE_SIZE } from "@/lib/validation/list-query";
import {
  parseDonationListQuery,
  type DonationListQuery,
} from "@/lib/validation/donations";
import { ilike, paginate } from "./shared";

/**
 * Donation reads for the OWNER-only admin page and CSV export (callers
 * enforce requireOwnerPage / requireAdminRoute role OWNER). No writes: only
 * the Stripe webhook writes donation rows.
 */
export function donationWhere(
  query: DonationListQuery,
  now: Date = new Date(),
): Prisma.DonationWhereInput {
  const { from, to } = periodRange(query.period, now);
  return {
    ...(from || to
      ? {
          paidAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) },
        }
      : {}),
    ...(query.interval ? { interval: query.interval } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.mode ? { livemode: query.mode === "live" } : {}),
    ...(query.q ? { donorEmail: ilike(query.q) } : {}),
  };
}

const ORDER: Prisma.DonationOrderByWithRelationInput[] = [
  { paidAt: "desc" },
  { id: "desc" },
];

export function listDonations(query: DonationListQuery, now?: Date) {
  const where = donationWhere(query, now);
  return paginate(
    query.page,
    PAGE_SIZE,
    () => prisma.donation.count({ where }),
    ({ skip, take }) =>
      prisma.donation.findMany({
        where,
        orderBy: ORDER,
        skip,
        take,
        include: {
          subscription: { select: { stripeSubscriptionId: true } },
        },
      }),
  );
}

export type DonationTotals = {
  count: number;
  grossCents: number;
  refundedCents: number;
  netCents: number;
  oneTimeCents: number;
  monthlyCents: number;
};

/** Totals for the filtered set (exact integer cents). */
export async function donationTotals(
  query: DonationListQuery,
  now?: Date,
): Promise<DonationTotals> {
  const where = donationWhere(query, now);
  const [all, byInterval] = await Promise.all([
    prisma.donation.aggregate({
      where,
      _count: { _all: true },
      _sum: { amountCents: true, amountRefundedCents: true },
    }),
    prisma.donation.groupBy({
      by: ["interval"],
      where,
      _sum: { amountCents: true },
    }),
  ]);
  const gross = all._sum.amountCents ?? 0;
  const refunded = all._sum.amountRefundedCents ?? 0;
  const sumOf = (interval: "ONE_TIME" | "MONTHLY") =>
    byInterval.find((g) => g.interval === interval)?._sum.amountCents ?? 0;
  return {
    count: all._count._all,
    grossCents: gross,
    refundedCents: refunded,
    netCents: gross - refunded,
    oneTimeCents: sumOf("ONE_TIME"),
    monthlyCents: sumOf("MONTHLY"),
  };
}

/** Active monthly gifts right now (not bound to the period). */
export function activeSubscriptionCount(): Promise<number> {
  return prisma.donationSubscription.count({ where: { status: "ACTIVE" } });
}

export async function lastWebhookAt(): Promise<Date | null> {
  const row = await prisma.stripeEvent.findFirst({
    orderBy: { processedAt: "desc" },
    select: { processedAt: true },
  });
  return row?.processedAt ?? null;
}

export const EXPORT_CAP = 10_000;

/** Rows for the CSV export (newest first), capped; `truncated` when more exist. */
export async function exportDonationRows(
  query: DonationListQuery,
  cap: number = EXPORT_CAP,
  now?: Date,
) {
  const rows = await prisma.donation.findMany({
    where: donationWhere(query, now),
    orderBy: ORDER,
    take: cap + 1,
    include: { subscription: { select: { stripeSubscriptionId: true } } },
  });
  return { rows: rows.slice(0, cap), truncated: rows.length > cap };
}

const CSV_HEADER = [
  "Paid at (UTC)",
  "Amount (USD)",
  "Currency",
  "Frequency",
  "Status",
  "Refunded (USD)",
  "Donor email",
  "Test mode",
  "Stripe payment intent",
  "Stripe invoice",
  "Stripe subscription",
];

const CSV_FREQUENCY = { ONE_TIME: "One-time", MONTHLY: "Monthly" } as const;
const CSV_STATUS = {
  PAID: "Paid",
  PARTIALLY_REFUNDED: "Partially refunded",
  REFUNDED: "Refunded",
} as const;

const dollars = (cents: number) => (cents / 100).toFixed(2);

/** The export CSV for the given filters (CSV-injection safe, see csv.ts). */
export async function buildDonationCsv(
  searchParams: URLSearchParams,
  cap: number = EXPORT_CAP,
) {
  const query = parseDonationListQuery(Object.fromEntries(searchParams));
  const { rows, truncated } = await exportDonationRows(query, cap);
  const lines: CsvValue[][] = [
    CSV_HEADER,
    ...rows.map((d) => [
      d.paidAt.toISOString(),
      dollars(d.amountCents),
      d.currency.toUpperCase(),
      CSV_FREQUENCY[d.interval],
      CSV_STATUS[d.status],
      dollars(d.amountRefundedCents),
      d.donorEmail,
      d.livemode ? "no" : "yes",
      d.stripePaymentIntentId,
      d.stripeInvoiceId,
      d.subscription?.stripeSubscriptionId ?? null,
    ]),
  ];
  let csv = toCsv(lines);
  if (truncated) csv += `# truncated at ${cap} rows\r\n`;
  return { csv, query, rows: rows.length, truncated };
}
