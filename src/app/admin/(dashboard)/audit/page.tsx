import type { Metadata } from "next";
import { Suspense } from "react";
import { formatDateTime, type SearchParams } from "@/components/admin/labels";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { ListSkeleton } from "@/components/admin/Skeletons";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireOwnerPage } from "@/server/auth/guards";
import {
  listAuditEntityTypes,
  listAuditLogs,
  type AuditListQuery,
} from "@/server/services/audit";

export const metadata: Metadata = { title: "Audit log" };

const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

async function AuditList({ query }: { query: AuditListQuery }) {
  const page = await listAuditLogs(query);
  if (page.total === 0) {
    return (
      <EmptyState
        title="No audit entries"
        description="Every change in the admin is recorded here."
      />
    );
  }
  return (
    <>
      <ul aria-label="Audit entries" className="flex flex-col gap-2">
        {page.items.map((entry) => (
          <li
            key={entry.id}
            className="flex flex-col gap-1 rounded-lg border border-beige bg-white px-4 py-3"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-sm font-semibold text-navy">
                {entry.action}
              </span>
              <span className="text-sm text-navy/80">
                {entry.entityType}
                {entry.entityId ? ` · ${entry.entityId}` : ""}
              </span>
            </div>
            <p className="text-sm text-navy/75">
              {formatDateTime(entry.createdAt)} ·{" "}
              {entry.actor?.name ?? entry.actorEmail ?? "System"}
            </p>
            {entry.metadata ? (
              <details>
                <summary className="cursor-pointer text-sm text-navy underline underline-offset-2">
                  Details
                </summary>
                <pre className="mt-2 overflow-x-auto rounded bg-beige/40 p-3 text-xs whitespace-pre-wrap text-navy">
                  {JSON.stringify(entry.metadata, null, 2)}
                </pre>
              </details>
            ) : null}
          </li>
        ))}
      </ul>
      <Pagination
        path="/admin/audit"
        query={{ entityType: query.entityType }}
        page={page.page}
        pageCount={page.pageCount}
      />
    </>
  );
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOwnerPage("/admin/audit");
  const params = await searchParams;
  const types = await listAuditEntityTypes();
  const requested = first(params.entityType);
  const entityType =
    requested && types.includes(requested) ? requested : undefined;
  const pageNumber = Math.max(
    1,
    Number.parseInt(first(params.page) ?? "1", 10) || 1,
  );
  const query: AuditListQuery = { page: pageNumber, entityType };

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Who changed what, newest first. Message bodies and passwords are never recorded."
      />
      <ListToolbar
        action="/admin/audit"
        search={false}
        filters={[
          {
            name: "entityType",
            label: "Record type",
            value: entityType,
            options: types.map((t) => ({ value: t, label: t })),
          },
        ]}
      />
      <Suspense key={JSON.stringify(query)} fallback={<ListSkeleton />}>
        <AuditList query={query} />
      </Suspense>
    </>
  );
}
