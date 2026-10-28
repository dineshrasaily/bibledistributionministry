import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
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
  deleteGalleryAction,
  setGalleryStatusAction,
} from "@/server/actions/galleries";
import { requireAdminPage } from "@/server/auth/guards";
import { listGalleries } from "@/server/services/galleries";

export const metadata: Metadata = { title: "Galleries" };

const FILTERS = { status: ContentStatus };
type Query = ListQuery<typeof FILTERS>;

const photos = (n: number) => (n === 1 ? "1 photo" : `${n} photos`);

async function GalleryList({ query }: { query: Query }) {
  const page = await listGalleries(query);
  if (page.total === 0) {
    return (
      <EmptyState
        title={
          query.q || query.status ? "No matching galleries" : "No galleries yet"
        }
        description="Create a gallery, add pictures in order and link it to a mission or event."
        action={<Button href="/admin/galleries/new">New gallery</Button>}
      />
    );
  }
  return (
    <>
      <RecordList
        label="Galleries"
        rows={page.items.map((g) => {
          const action = g.status === "PUBLISHED" ? "Unpublish" : "Publish";
          return {
            id: g.id,
            title: g.titleEn,
            href: `/admin/galleries/${g.id}`,
            badges: (
              <>
                <StatusBadge status={g.status} />
                <Badge>{photos(g._count.items)}</Badge>
                {g.isDemo ? <Badge>Demo</Badge> : null}
              </>
            ),
            meta: g.event
              ? `Event: ${g.event.titleEn} · Updated ${formatDate(g.updatedAt)}`
              : `No linked event · Updated ${formatDate(g.updatedAt)}`,
            actions: (
              <>
                <InlineAction
                  action={setGalleryStatusAction}
                  fields={{
                    id: g.id,
                    status: g.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
                  }}
                  label={action}
                  accessibleLabel={`${action} ${g.titleEn}`}
                />
                <ConfirmDialog
                  action={deleteGalleryAction}
                  fields={{ id: g.id }}
                  triggerLabel="Delete"
                  title={`Delete "${g.titleEn}"?`}
                  description="The pictures stay in the media library. This can't be undone."
                />
              </>
            ),
          };
        })}
      />
      <Pagination
        path="/admin/galleries"
        query={{ q: query.q, status: query.status }}
        page={page.page}
        pageCount={page.pageCount}
      />
    </>
  );
}

export default async function GalleriesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdminPage("/admin/galleries");
  const query = parseListQuery(await searchParams, FILTERS);
  return (
    <>
      <PageHeader
        title="Galleries"
        description="Ordered photo galleries. Only published galleries and published photos appear on the public site."
        action={<Button href="/admin/galleries/new">New gallery</Button>}
      />
      <ListToolbar
        action="/admin/galleries"
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
        <GalleryList query={query} />
      </Suspense>
    </>
  );
}
