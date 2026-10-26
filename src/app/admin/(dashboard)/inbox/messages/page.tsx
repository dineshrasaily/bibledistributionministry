import type { Metadata } from "next";
import { Suspense } from "react";
import {
  formatDateTime,
  MESSAGE_KIND_LABELS,
  MESSAGE_STATUS_LABELS,
  optionsOf,
  type SearchParams,
} from "@/components/admin/labels";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { ConsentBadge, PrivacyNotice } from "@/components/admin/PrivacyNotice";
import { RecordList } from "@/components/admin/RecordList";
import { ListSkeleton } from "@/components/admin/Skeletons";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { MessageKind, MessageStatus } from "@/generated/prisma/enums";
import { parseListQuery, type ListQuery } from "@/lib/validation/list-query";
import { requireAdminPage } from "@/server/auth/guards";
import { listContactMessages } from "@/server/services/inbox";

export const metadata: Metadata = { title: "Messages" };

const FILTERS = { status: MessageStatus, kind: MessageKind };
type Query = ListQuery<typeof FILTERS>;

async function MessageList({ query }: { query: Query }) {
  const page = await listContactMessages(query);
  if (page.total === 0) {
    return (
      <EmptyState
        title={
          query.q || query.status || query.kind
            ? "No matching messages"
            : "No messages yet"
        }
        description="They will appear here when the contact form launches."
      />
    );
  }
  return (
    <>
      <RecordList
        label="Messages"
        rows={page.items.map((m) => ({
          id: m.id,
          title: m.subject,
          href: `/admin/inbox/messages/${m.id}`,
          badges: (
            <>
              <StatusBadge status={m.status} />
              <Badge>{MESSAGE_KIND_LABELS[m.kind]}</Badge>
              <ConsentBadge consent={m.shareConsent} />
            </>
          ),
          meta: `From ${m.name} · ${formatDateTime(m.createdAt)}`,
        }))}
      />
      <Pagination
        path="/admin/inbox/messages"
        query={{ q: query.q, status: query.status, kind: query.kind }}
        page={page.page}
        pageCount={page.pageCount}
      />
    </>
  );
}

export default async function MessagesInboxPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdminPage("/admin/inbox/messages");
  const query = parseListQuery(await searchParams, FILTERS);
  return (
    <>
      <PageHeader title="Messages" />
      <PrivacyNotice />
      <ListToolbar
        action="/admin/inbox/messages"
        q={query.q}
        filters={[
          {
            name: "kind",
            label: "Kind",
            value: query.kind,
            options: optionsOf(MESSAGE_KIND_LABELS),
          },
          {
            name: "status",
            label: "Status",
            value: query.status,
            options: optionsOf(MESSAGE_STATUS_LABELS),
          },
        ]}
      />
      <Suspense key={JSON.stringify(query)} fallback={<ListSkeleton />}>
        <MessageList query={query} />
      </Suspense>
    </>
  );
}
