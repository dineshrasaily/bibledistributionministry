import "server-only";
import Stripe from "stripe";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { STRIPE_METADATA_APP } from "@/lib/donations/checkout-params";
import { log } from "@/lib/log";
import type { StripeLike } from "./stripe-client";

/**
 * Stripe webhook processing: signature verification on the RAW body, an
 * idempotency ledger (StripeEvent, one row per event id) and four handlers.
 *
 * Every write is an upsert on a unique Stripe id, so a gift is recorded once
 * even if Stripe re-sends it under a new event id. Objects whose metadata
 * `app` is not ours, and non-USD amounts, are ignored. No card data is ever
 * read or stored; logs carry only event ids, types and outcomes.
 */
export class InvalidSignatureError extends Error {
  constructor() {
    super("Invalid Stripe signature");
    this.name = "InvalidSignatureError";
  }
}

/** Throws InvalidSignatureError for a missing/bad/stale signature. */
export function verifyStripeEvent(
  raw: string | Uint8Array,
  header: string | null | undefined,
  secret: string,
  toleranceSeconds?: number,
): Stripe.Event {
  if (!header) throw new InvalidSignatureError();
  try {
    return Stripe.webhooks.constructEvent(
      raw,
      header,
      secret,
      toleranceSeconds,
    );
  } catch {
    throw new InvalidSignatureError();
  }
}

export type HandlerOutcome = "processed" | "ignored";
export type ProcessOutcome = HandlerOutcome | "duplicate";

type Tx = Prisma.TransactionClient;
type Extra = { invoicePaymentIntent?: string | null };
type Handler = (
  tx: Tx,
  object: unknown,
  event: Stripe.Event,
  extra: Extra,
) => Promise<HandlerOutcome>;

const MAX_EMAIL = 254;

const idOf = (
  value: string | { id: string } | null | undefined,
): string | null =>
  value == null ? null : typeof value === "string" ? value : value.id;

const isOurs = (metadata: Record<string, string> | null | undefined) =>
  metadata?.app === STRIPE_METADATA_APP;

const isUsd = (currency: string | null | undefined) =>
  (currency ?? "").toLowerCase() === "usd";

function donorEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase() ?? "";
  return email !== "" && email.length <= MAX_EMAIL ? email : null;
}

const eventDate = (event: Stripe.Event) => new Date(event.created * 1000);
const unixDate = (seconds: number | null | undefined) =>
  seconds ? new Date(seconds * 1000) : null;

// ---------- handlers ----------

const checkoutCompleted: Handler = async (tx, object, event) => {
  const s = object as Stripe.Checkout.Session;
  if (!isOurs(s.metadata) || !isUsd(s.currency)) return "ignored";
  if (s.amount_total == null || s.amount_total <= 0) return "ignored";
  const email = donorEmail(s.customer_details?.email ?? s.customer_email);
  const customer = idOf(s.customer);

  if (s.mode === "payment") {
    // Card only: a completed payment session is paid; anything else is not ours to record.
    if (s.payment_status !== "paid") return "ignored";
    await tx.donation.upsert({
      where: { stripeCheckoutSessionId: s.id },
      create: {
        amountCents: s.amount_total,
        currency: "usd",
        interval: "ONE_TIME",
        donorEmail: email,
        livemode: event.livemode,
        stripeCheckoutSessionId: s.id,
        stripePaymentIntentId: idOf(s.payment_intent),
        stripeCustomerId: customer,
        paidAt: eventDate(event),
      },
      update: {},
    });
    return "processed";
  }

  if (s.mode === "subscription") {
    const subscriptionId = idOf(s.subscription);
    if (!subscriptionId) return "ignored";
    // Each month (including the first) is recorded by invoice.paid.
    await tx.donationSubscription.upsert({
      where: { stripeSubscriptionId: subscriptionId },
      create: {
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: customer,
        amountCents: s.amount_total,
        currency: "usd",
        donorEmail: email,
        livemode: event.livemode,
        startedAt: eventDate(event),
      },
      update: {
        ...(customer ? { stripeCustomerId: customer } : {}),
        ...(email ? { donorEmail: email } : {}),
      },
    });
    return "processed";
  }
  return "ignored";
};

const invoicePaid: Handler = async (tx, object, event, extra) => {
  const inv = object as Stripe.Invoice;
  const details = inv.parent?.subscription_details;
  if (!details || !isOurs(details.metadata) || !isUsd(inv.currency)) {
    return "ignored";
  }
  const subscriptionId = idOf(details.subscription);
  if (!subscriptionId || inv.amount_paid <= 0) return "ignored";
  const email = donorEmail(inv.customer_email);
  const customer = idOf(inv.customer);
  const paidAt = unixDate(inv.status_transitions?.paid_at) ?? eventDate(event);

  // Stripe does not guarantee event order: this may arrive before checkout.
  const subscription = await tx.donationSubscription.upsert({
    where: { stripeSubscriptionId: subscriptionId },
    create: {
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customer,
      amountCents: inv.amount_paid,
      currency: "usd",
      donorEmail: email,
      livemode: event.livemode,
      startedAt: paidAt,
    },
    update: {},
    select: { id: true },
  });
  await tx.donation.upsert({
    where: { stripeInvoiceId: inv.id },
    create: {
      amountCents: inv.amount_paid,
      currency: "usd",
      interval: "MONTHLY",
      donorEmail: email,
      livemode: event.livemode,
      stripeInvoiceId: inv.id,
      stripePaymentIntentId: extra.invoicePaymentIntent ?? null,
      stripeCustomerId: customer,
      subscriptionId: subscription.id,
      paidAt,
    },
    update: {},
  });
  return "processed";
};

const chargeRefunded: Handler = async (tx, object, event) => {
  const charge = object as Stripe.Charge;
  const paymentIntent = idOf(charge.payment_intent);
  if (!paymentIntent || !isUsd(charge.currency)) return "ignored";
  const donation = await tx.donation.findUnique({
    where: { stripePaymentIntentId: paymentIntent },
    select: { id: true, amountCents: true, amountRefundedCents: true },
  });
  if (!donation) {
    log.info("stripe.webhook.refund_unmatched", {
      event: event.id,
      charge: charge.id,
    });
    return "ignored";
  }
  // Refund events can arrive out of order: never lower the refunded total.
  const refunded = Math.max(
    donation.amountRefundedCents,
    charge.amount_refunded,
  );
  await tx.donation.update({
    where: { id: donation.id },
    data: {
      amountRefundedCents: refunded,
      status:
        refunded >= donation.amountCents
          ? "REFUNDED"
          : refunded > 0
            ? "PARTIALLY_REFUNDED"
            : "PAID",
      refundedAt: eventDate(event),
    },
  });
  return "processed";
};

const subscriptionDeleted: Handler = async (tx, object, event) => {
  const sub = object as Stripe.Subscription;
  const canceledAt =
    unixDate(sub.canceled_at) ?? unixDate(sub.ended_at) ?? eventDate(event);
  const existing = await tx.donationSubscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
    select: { id: true },
  });
  if (existing) {
    await tx.donationSubscription.update({
      where: { id: existing.id },
      data: { status: "CANCELED", canceledAt },
    });
    return "processed";
  }
  if (!isOurs(sub.metadata) || !isUsd(sub.currency)) return "ignored";
  await tx.donationSubscription.create({
    data: {
      stripeSubscriptionId: sub.id,
      stripeCustomerId: idOf(sub.customer),
      amountCents: sub.items?.data?.[0]?.price?.unit_amount ?? 0,
      currency: "usd",
      status: "CANCELED",
      livemode: event.livemode,
      startedAt: unixDate(sub.start_date) ?? canceledAt,
      canceledAt,
    },
  });
  return "processed";
};

const HANDLERS: Partial<Record<Stripe.Event["type"], Handler>> = {
  "checkout.session.completed": checkoutCompleted,
  "invoice.paid": invoicePaid,
  "charge.refunded": chargeRefunded,
  "customer.subscription.deleted": subscriptionDeleted,
};

export const HANDLED_EVENT_TYPES = Object.keys(HANDLERS);

/**
 * Network lookups happen OUTSIDE the transaction. Only invoice.paid without
 * `payments` in its payload asks Stripe for the invoice's payment intent.
 */
async function enrich(
  event: Stripe.Event,
  client: StripeLike | null,
): Promise<Extra> {
  if (event.type !== "invoice.paid") return {};
  const inv = event.data.object as Stripe.Invoice;
  const inPayload = inv.payments?.data?.[0]?.payment?.payment_intent;
  if (inPayload) return { invoicePaymentIntent: idOf(inPayload) };
  if (!isOurs(inv.parent?.subscription_details?.metadata) || !client) {
    return {};
  }
  const list = await client.invoicePayments.list({ invoice: inv.id, limit: 1 });
  return {
    invoicePaymentIntent: idOf(list.data[0]?.payment?.payment_intent) ?? null,
  };
}

type Db = Pick<PrismaClient, "stripeEvent" | "$transaction">;

export async function processStripeEvent(
  event: Stripe.Event,
  { db = prisma, client = null }: { db?: Db; client?: StripeLike | null } = {},
): Promise<{ outcome: ProcessOutcome }> {
  const seen = await db.stripeEvent.findUnique({
    where: { id: event.id },
    select: { id: true },
  });
  if (seen) {
    log.info("stripe.webhook.duplicate", { event: event.id, type: event.type });
    return { outcome: "duplicate" };
  }

  const extra = await enrich(event, client);
  const handler = HANDLERS[event.type];

  try {
    const outcome = await db.$transaction(async (tx) => {
      // Ledger row first: a concurrent duplicate blocks here, then fails (P2002).
      await tx.stripeEvent.create({
        data: {
          id: event.id,
          type: event.type,
          livemode: event.livemode,
          outcome: "processing",
        },
      });
      const result: HandlerOutcome = handler
        ? await handler(tx, event.data.object, event, extra)
        : "ignored";
      await tx.stripeEvent.update({
        where: { id: event.id },
        data: { outcome: result },
      });
      return result;
    });
    log.info("stripe.webhook.event", {
      event: event.id,
      type: event.type,
      outcome,
    });
    return { outcome };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      (await db.stripeEvent.findUnique({
        where: { id: event.id },
        select: { id: true },
      }))
    ) {
      log.info("stripe.webhook.duplicate", {
        event: event.id,
        type: event.type,
      });
      return { outcome: "duplicate" };
    }
    throw error;
  }
}
