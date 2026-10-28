import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DetailList } from "@/components/admin/DetailList";
import { EditorSection } from "@/components/admin/EditorSection";
import {
  DONATION_INTERVAL_LABELS,
  DONATION_MODE_LABELS,
  DONATION_STATUS_LABELS,
  formatDateTime,
  optionsOf,
  type SearchParams,
} from "@/components/admin/labels";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { PageHeader } from "@/components/admin/PageHeader";
import { hrefWith, Pagination } from "@/components/admin/Pagination";
import { ListSkeleton } from "@/components/admin/Skeletons";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSiteConfig } from "@/config/site";
import { formatUsd } from "@/lib/donations/amount";
import { PERIOD_LABELS } from "@/lib/donations/period";
import {
  resolveStripeConfig,
  type StripeConfig,
} from "@/lib/donations/stripe-config";
import { getSiteSettings } from "@/lib/site-settings";
import {
  parseDonationListQuery,
  type DonationListQuery,
} from "@/lib/validation/donations";
import { requireOwnerPage } from "@/server/auth/guards";
import {
  activeSubscriptionCount,
  donationTotals,
  lastWebhookAt,
  listDonations,
} from "@/server/services/donations";

export const metadata: Metadata = { title: "Donations" };

const PATH = "/admin/donations";

const KEY_STATUS: Record<StripeConfig["secretKey"], string> = {
  missing: "Not set: the Support page says online giving is not set up yet",
  test: "Test mode key set",
  live: "Live mode key set",
  invalid: "Not recognised (check the key)",
};

const linkClass =
  "font-medium text-navy underline decoration-gold-dark underline-offset-2 hover:decoration-2";

function filterQuery(query: DonationListQuery) {
  return {
    period: query.period,
    interval: query.interval,
    status: query.status,
    mode: query.mode,
    q: query.q,
  };
}

function stripeLink(d: {
  livemode: boolean;
  stripePaymentIntentId: string | null;
  stripeInvoiceId: string | null;
}): string | null {
  const base = `https://dashboard.stripe.com/${d.livemode ? "" : "test/"}`;
  if (d.stripePaymentIntentId)
    return `${base}payments/${d.stripePaymentIntentId}`;
  if (d.stripeInvoiceId) return `${base}invoices/${d.stripeInvoiceId}`;
  return null;
}

async function StripeStatus() {
  const config = resolveStripeConfig(process.env);
  const [settings, lastEvent] = await Promise.all([
    getSiteSettings(),
    lastWebhookAt(),
  ]);
  return (
    <EditorSection title="Stripe connection">
      <DetailList
        items={[
          { label: "Secret key", value: KEY_STATUS[config.secretKey] },
          {
            label: "Webhook signing secret",
            value: config.webhookSecretSet ? "Set" : "Not set",
          },
          {
            label: "Webhook URL for Stripe",
            value: (
              <code className="rounded bg-beige/60 px-1.5 py-0.5 text-sm break-all">
                {`${getSiteConfig().siteUrl.replace(/\/+$/, "")}/api/stripe/webhook`}
              </code>
            ),
          },
          {
            label: "Last webhook received",
            value: lastEvent ? formatDateTime(lastEvent) : "Never",
          },
          {
            label: "Customer portal link",
            value: config.portalUrl ? "Set" : "Not set",
          },
          {
            label: "Public giving",
            value: (
              <>
                {settings.donationsEnabled ? "On" : "Off"} (
                <Link href="/admin/settings" className={linkClass}>
                  change in Settings
                </Link>
                )
              </>
            ),
          },
          {
            label: "Tax wording",
            value: settings.taxDeductibleVerified
              ? "Tax status verified"
              : "Tax status not verified",
          },
        ]}
      />
      <p className="text-sm text-navy/75">
        Keys are never shown here. To connect Stripe, follow README › Setting up
        Stripe (donations).
      </p>
    </EditorSection>
  );
}

async function Totals({ query }: { query: DonationListQuery }) {
  const [totals, active] = await Promise.all([
    donationTotals(query),
    activeSubscriptionCount(),
  ]);
  const items = [
    { label: "Gifts", value: String(totals.count) },
    { label: "Gross", value: formatUsd(totals.grossCents) },
    { label: "Refunded", value: formatUsd(totals.refundedCents) },
    { label: "Net", value: formatUsd(totals.netCents) },
    { label: "One-time", value: formatUsd(totals.oneTimeCents) },
    { label: "Monthly", value: formatUsd(totals.monthlyCents) },
    { label: "Active monthly gifts (now)", value: String(active) },
  ];
  return (
    <section aria-labelledby="donation-totals" className="mb-6">
      <h2
        id="donation-totals"
        className="mb-3 font-serif text-xl font-semibold text-navy"
      >
        Totals: {PERIOD_LABELS[query.period]}
        {query.period === "all" ? "" : " (UTC)"}
      </h2>
      <dl
        data-testid="donation-totals"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      >
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-beige bg-white px-4 py-3"
          >
            <dt className="text-sm text-navy/75">{item.label}</dt>
            <dd className="font-serif text-2xl font-semibold text-navy">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

async function DonationList({
  query,
  configured,
}: {
  query: DonationListQuery;
  configured: boolean;
}) {
  const page = await listDonations(query);
  if (page.total === 0) {
    const filtered =
      query.period !== "all" ||
      query.interval ||
      query.status ||
      query.mode ||
      query.q;
    return (
      <EmptyState
        title={filtered ? "No gifts in this period" : "No gifts recorded yet"}
        description={
          configured
            ? "Gifts appear here when Stripe reports them to the webhook."
            : "Online giving is not set up yet. See the README to connect Stripe."
        }
      />
    );
  }
  return (
    <>
      <ul aria-label="Donations" className="flex flex-col gap-3">
        {page.items.map((d) => {
          const link = stripeLink(d);
          return (
            <li
              key={d.id}
              className="flex flex-col gap-2 rounded-lg border border-beige bg-white p-4 md:flex-row md:items-center md:gap-6"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <p className="font-serif text-lg font-semibold text-navy">
                  {formatUsd(d.amountCents)}{" "}
                  <span className="font-sans text-base font-normal text-navy/80">
                    · {DONATION_INTERVAL_LABELS[d.interval]}
                  </span>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={d.status} />
                  {d.livemode ? null : <Badge variant="gold">Test</Badge>}
                  {d.amountRefundedCents > 0 ? (
                    <span className="text-sm text-navy/80">
                      Refunded {formatUsd(d.amountRefundedCents)}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm break-all text-navy/75">
                  {formatDateTime(d.paidAt)} · {d.donorEmail ?? "No email"}
                </p>
              </div>
              {link ? (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center self-start rounded-full px-4 text-sm font-medium text-navy underline underline-offset-2 hover:bg-beige/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-dark md:self-center"
                >
                  View in Stripe
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>
      <Pagination
        path={PATH}
        query={filterQuery(query)}
        page={page.page}
        pageCount={page.pageCount}
      />
    </>
  );
}

export default async function DonationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOwnerPage(PATH);
  const query = parseDonationListQuery(await searchParams);
  const configured = resolveStripeConfig(process.env).checkoutReady;
  const exportHref = hrefWith(
    "/api/admin/donations/export",
    filterQuery(query),
  );

  return (
    <>
      <PageHeader
        title="Donations"
        description="Gifts recorded from Stripe. Amounts in US dollars; periods in UTC."
        action={
          <a
            href={exportHref}
            download
            className={buttonVariants({ variant: "secondary" })}
          >
            Export CSV
          </a>
        }
      />
      <div
        role="note"
        className="mb-6 rounded-lg border border-gold/60 bg-beige/40 px-4 py-3 text-sm text-navy"
      >
        <p>
          <span className="font-semibold">Private: </span>
          Donor emails are personal data. Only the owner can see this page.
          Refunds are made in the Stripe Dashboard and show up here
          automatically.
        </p>
      </div>
      <Suspense fallback={<ListSkeleton rows={2} />}>
        <StripeStatus />
      </Suspense>
      <div className="mt-6">
        <ListToolbar
          action={PATH}
          q={query.q}
          searchLabel="Donor email"
          filters={[
            {
              name: "period",
              label: "Period",
              value: query.period,
              options: optionsOf(PERIOD_LABELS),
              allLabel: null,
            },
            {
              name: "interval",
              label: "Frequency",
              value: query.interval,
              options: optionsOf(DONATION_INTERVAL_LABELS),
            },
            {
              name: "status",
              label: "Status",
              value: query.status,
              options: optionsOf(DONATION_STATUS_LABELS),
            },
            {
              name: "mode",
              label: "Mode",
              value: query.mode,
              options: optionsOf(DONATION_MODE_LABELS),
            },
          ]}
        />
      </div>
      <Suspense key={JSON.stringify(query)} fallback={<ListSkeleton />}>
        <Totals query={query} />
        <DonationList query={query} configured={configured} />
      </Suspense>
    </>
  );
}
