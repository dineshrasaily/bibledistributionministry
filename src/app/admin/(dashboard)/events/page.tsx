import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { InlineAction } from "@/components/admin/InlineAction";
import {
  EVENT_KIND_LABELS,
  EVENT_STATUS_LABELS,
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
import { EventKind, EventStatus } from "@/generated/prisma/enums";
import { parseListQuery, type ListQuery } from "@/lib/validation/list-query";
import {
  deleteEventAction,
  setEventStatusAction,
} from "@/server/actions/events";
import { requireAdminPage } from "@/server/auth/guards";
import { listEvents } from "@/server/services/events";

export const metadata: Metadata = { title: "Events & missions" };

const FILTERS = { kind: EventKind, status: EventStatus };
type Query = ListQuery<typeof FILTERS>;

async function EventList({ query }: { query: Query }) {
  const page = await listEvents(query);
  if (page.total === 0) {
    return (
      <EmptyState
        title={
          query.q || query.kind || query.status
            ? "No matching events"
            : "No events yet"
        }
        description="Add a mission trip, outreach or service."
        action={<Button href="/admin/events/new">New event</Button>}
      />
    );
  }
  return (
    <>
      <RecordList
        label="Events"
        rows={page.items.map((e) => ({
          id: e.id,
          title: e.titleEn,
          href: `/admin/events/${e.id}`,
          badges: (
            <>
              <StatusBadge status={e.publishStatus} />
              <StatusBadge status={e.status} />
              <Badge>{EVENT_KIND_LABELS[e.kind]}</Badge>
              {e.isDemo ? <Badge>Demo</Badge> : null}
            </>
          ),
          meta: `Starts ${formatDate(e.startsAt)}`,
          actions: (
            <>
              <InlineAction
                action={setEventStatusAction}
                fields={{
                  id: e.id,
                  status:
                    e.publishStatus === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
                }}
                label={
                  e.publishStatus === "PUBLISHED" ? "Unpublish" : "Publish"
                }
                accessibleLabel={`${e.publishStatus === "PUBLISHED" ? "Unpublish" : "Publish"} ${e.titleEn}`}
              />
              <ConfirmDialog
                action={deleteEventAction}
                fields={{ id: e.id }}
                triggerLabel="Delete"
                title={`Delete "${e.titleEn}"?`}
              />
            </>
          ),
        }))}
      />
      <Pagination
        path="/admin/events"
        query={{ q: query.q, kind: query.kind, status: query.status }}
        page={page.page}
        pageCount={page.pageCount}
      />
    </>
  );
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdminPage("/admin/events");
  const query = parseListQuery(await searchParams, FILTERS);
  return (
    <>
      <PageHeader
        title="Events & missions"
        description="Mission trips, outreach, services and announcements."
        action={<Button href="/admin/events/new">New event</Button>}
      />
      <ListToolbar
        action="/admin/events"
        q={query.q}
        filters={[
          {
            name: "kind",
            label: "Kind",
            value: query.kind,
            options: optionsOf(EVENT_KIND_LABELS),
          },
          {
            name: "status",
            label: "Event status",
            value: query.status,
            options: optionsOf(EVENT_STATUS_LABELS),
          },
        ]}
      />
      <Suspense key={JSON.stringify(query)} fallback={<ListSkeleton />}>
        <EventList query={query} />
      </Suspense>
    </>
  );
}
