import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { FeatureVerseDialog } from "@/components/admin/FeatureVerseDialog";
import { InlineAction } from "@/components/admin/InlineAction";
import {
  CONTENT_STATUS_LABELS,
  formatDate,
  isoDay,
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
  getVerseFeaturedOn,
  listVerses,
  utcDay,
} from "@/server/services/verses";

export const metadata: Metadata = { title: "Bible verses" };

const FILTERS = { status: ContentStatus };
type Query = ListQuery<typeof FILTERS>;

async function FeaturedToday() {
  const verse = await getVerseFeaturedOn();
  return (
    <section
      aria-labelledby="today-heading"
      className="mb-6 rounded-lg border border-gold/60 bg-white p-5"
    >
      <h2
        id="today-heading"
        className="text-xs font-semibold tracking-[0.14em] text-gold-dark uppercase"
      >
        Verse of the day (today, UTC)
      </h2>
      {verse ? (
        <div className="mt-2 flex flex-col gap-1">
          <p className="font-serif text-lg text-navy italic">
            &ldquo;{verse.text}&rdquo;
          </p>
          <p className="text-sm font-medium text-navy">
            {verse.reference} ({verse.translation})
          </p>
        </div>
      ) : (
        <p className="mt-2 text-navy/80">
          No verse is set for today. The home page shows the most recent
          featured verse instead. Use &ldquo;Feature on…&rdquo; below to pick
          one.
        </p>
      )}
    </section>
  );
}

async function VerseList({ query }: { query: Query }) {
  const page = await listVerses(query);
  const today = isoDay(utcDay());
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
  await requireAdminPage("/admin/verses");
  const query = parseListQuery(await searchParams, FILTERS);
  return (
    <>
      <PageHeader
        title="Bible verses"
        description="English verse text (WEB or KJV) for the verse of the day."
        action={<Button href="/admin/verses/new">New verse</Button>}
      />
      <Suspense fallback={<ListSkeleton rows={1} />}>
        <FeaturedToday />
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
