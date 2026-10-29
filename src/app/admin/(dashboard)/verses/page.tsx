import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { FeatureVerseDialog } from "@/components/admin/FeatureVerseDialog";
import { InlineAction } from "@/components/admin/InlineAction";
import {
  CONTENT_STATUS_LABELS,
  formatDate,
  optionsOf,
  type SearchParams,
} from "@/components/admin/labels";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { RecordList } from "@/components/admin/RecordList";
import { ListSkeleton } from "@/components/admin/Skeletons";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ContentStatus } from "@/generated/prisma/enums";
import { parseListQuery, type ListQuery } from "@/lib/validation/list-query";
import {
  clearFeaturedVerseAction,
  deleteVerseAction,
  setVerseStatusAction,
} from "@/server/actions/verses";
import { requireAdminPage } from "@/server/auth/guards";
import {
  getTodayVersePreview,
  listVerses,
  siteToday,
} from "@/server/services/verses";

export const metadata: Metadata = { title: "Bible verses" };

const FILTERS = { status: ContentStatus };
type Query = ListQuery<typeof FILTERS>;

const longDate = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00.000Z`));

/** Read-only: what visitors see on the home page today. */
async function TodayVerse({ isOwner }: { isOwner: boolean }) {
  const p = await getTodayVersePreview();
  const settingsLink = isOwner ? (
    <Link
      href="/admin/settings"
      className="font-medium text-navy underline decoration-gold-dark underline-offset-2 hover:decoration-2"
    >
      Settings
    </Link>
  ) : (
    "Settings (owner only)"
  );
  return (
    <section
      aria-labelledby="today-heading"
      data-testid="today-verse-preview"
      className="mb-6 rounded-lg border border-gold/60 bg-white p-5"
    >
      <h2
        id="today-heading"
        className="text-xs font-semibold tracking-[0.14em] text-gold-dark uppercase"
      >
        Today&apos;s verse
      </h2>
      <p className="mt-1 text-sm text-navy/80">
        {longDate(p.today)} ({p.timeZone})
      </p>
      <dl className="mt-3 grid gap-3 text-sm text-navy sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <dt className="font-semibold">Picked for today</dt>
          <dd data-testid="today-override">
            {p.override ? (
              <>
                <Badge variant="gold">Override active today</Badge>{" "}
                <span className="font-medium">
                  {p.override.reference} ({p.override.translation})
                </span>{" "}
                is shown to visitors.
              </>
            ) : (
              <>No override today. Use &ldquo;Feature on…&rdquo; below.</>
            )}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-semibold">Today&apos;s automatic verse</dt>
          <dd data-testid="today-auto">
            {p.autoEnabled ? (
              <>
                <span className="font-medium">
                  {p.auto.reference} ({p.auto.translation})
                </span>
                {p.override ? " (replaced by the override today)" : null}
              </>
            ) : (
              <>
                The automatic verse is off. Turn it on in {settingsLink}.
                {p.override
                  ? null
                  : " Visitors see the most recent featured verse."}
              </>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}

async function VerseList({ query }: { query: Query }) {
  const [page, day] = await Promise.all([listVerses(query), siteToday()]);
  const today = day.iso;
  if (page.total === 0) {
    return (
      <EmptyState
        title={query.q || query.status ? "No matching verses" : "No verses yet"}
        description="Add a verse, then feature it as the verse of the day."
        action={<Button href="/admin/verses/new">New verse</Button>}
      />
    );
  }
  return (
    <>
      <RecordList
        label="Bible verses"
        rows={page.items.map((v) => ({
          id: v.id,
          title: `${v.reference} (${v.translation})`,
          href: `/admin/verses/${v.id}`,
          badges: (
            <>
              <StatusBadge status={v.status} />
              {v.featuredOn ? (
                <Badge variant="gold">
                  Featured {formatDate(v.featuredOn)}
                </Badge>
              ) : null}
              {v.isDemo ? <Badge>Demo</Badge> : null}
            </>
          ),
          meta: v.text.length > 120 ? `${v.text.slice(0, 120)}…` : v.text,
          actions: (
            <>
              <InlineAction
                action={setVerseStatusAction}
                fields={{
                  id: v.id,
                  status: v.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
                }}
                label={v.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                accessibleLabel={`${v.status === "PUBLISHED" ? "Unpublish" : "Publish"} ${v.reference}`}
              />
              {v.status === "PUBLISHED" ? (
                <FeatureVerseDialog
                  id={v.id}
                  reference={v.reference}
                  defaultDate={today}
                  timeZone={day.timeZone}
                />
              ) : null}
              {v.featuredOn ? (
                <InlineAction
                  action={clearFeaturedVerseAction}
                  fields={{ id: v.id }}
                  label="Stop featuring"
                  accessibleLabel={`Stop featuring ${v.reference}`}
                  variant="ghost"
                />
              ) : null}
              <ConfirmDialog
                action={deleteVerseAction}
                fields={{ id: v.id }}
                triggerLabel="Delete"
                title={`Delete ${v.reference}?`}
              />
            </>
          ),
        }))}
      />
      <Pagination
        path="/admin/verses"
        query={{ q: query.q, status: query.status }}
        page={page.page}
        pageCount={page.pageCount}
      />
    </>
  );
}

export default async function VersesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const actor = await requireAdminPage("/admin/verses");
  const query = parseListQuery(await searchParams, FILTERS);
  return (
    <>
      <PageHeader
        title="Bible verses"
        description="English verse text (WEB or KJV) for the verse of the day."
        action={<Button href="/admin/verses/new">New verse</Button>}
      />
      <Suspense fallback={<ListSkeleton rows={1} />}>
        <TodayVerse isOwner={actor.role === "OWNER"} />
      </Suspense>
      <ListToolbar
        action="/admin/verses"
        q={query.q}
        filters={[
          {
            name: "status",
            label: "Status",
            value: query.status,
            options: optionsOf(CONTENT_STATUS_LABELS),
          },
        ]}
      />
      <Suspense key={JSON.stringify(query)} fallback={<ListSkeleton />}>
        <VerseList query={query} />
      </Suspense>
    </>
  );
}
