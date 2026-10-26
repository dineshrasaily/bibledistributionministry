import type { Metadata } from "next";
import { Suspense } from "react";
import {
  formatDateTime,
  optionsOf,
  PRAYER_STATUS_LABELS,
  type SearchParams,
} from "@/components/admin/labels";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { ConsentBadge, PrivacyNotice } from "@/components/admin/PrivacyNotice";
import { RecordList } from "@/components/admin/RecordList";
import { ListSkeleton } from "@/components/admin/Skeletons";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PrayerStatus } from "@/generated/prisma/enums";
import { parseListQuery, type ListQuery } from "@/lib/validation/list-query";
import { requireAdminPage } from "@/server/auth/guards";
import { listPrayerRequests } from "@/server/services/inbox";

export const metadata: Metadata = { title: "Prayer requests" };

const FILTERS = { status: PrayerStatus };
type Query = ListQuery<typeof FILTERS>;

async function PrayerList({ query }: { query: Query }) {
  const page = await listPrayerRequests(query);
  if (page.total === 0) {
    return (
      <EmptyState
        title={
          query.q || query.status
            ? "No matching prayer requests"
            : "No prayer requests yet"
        }
        description="They will appear here when the prayer form launches."
      />
    );
  }
  return (
    <>
      <RecordList
        label="Prayer requests"
        rows={page.items.map((p) => ({
          id: p.id,
          title: p.isAnonymous || !p.name ? "Anonymous" : p.name,
          href: `/admin/inbox/prayer/${p.id}`,
          badges: (
            <>
              <StatusBadge status={p.status} />
              <ConsentBadge consent={p.shareConsent} />
            </>
          ),
          meta: `Received ${formatDateTime(p.createdAt)}`,
        }))}
      />
      <Pagination
        path="/admin/inbox/prayer"
        query={{ q: query.q, status: query.status }}
        page={page.page}
        pageCount={page.pageCount}
      />
    </>
  );
}

export default async function PrayerInboxPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdminPage("/admin/inbox/prayer");
  const query = parseListQuery(await searchParams, FILTERS);
  return (
    <>
      <PageHeader title="Prayer requests" />
      <PrivacyNotice />
      <ListToolbar
        action="/admin/inbox/prayer"
        q={query.q}
        filters={[
          {
            name: "status",
            label: "Status",
            value: query.status,
            options: optionsOf(PRAYER_STATUS_LABELS),
          },
        ]}
      />
      <Suspense key={JSON.stringify(query)} fallback={<ListSkeleton />}>
        <PrayerList query={query} />
      </Suspense>
    </>
  );
}
