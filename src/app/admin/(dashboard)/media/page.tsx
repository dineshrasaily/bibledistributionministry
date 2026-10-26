import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { InlineAction } from "@/components/admin/InlineAction";
import {
  CONTENT_STATUS_LABELS,
  formatDate,
  MEDIA_CATEGORY_LABELS,
  MEDIA_TYPE_LABELS,
  optionsOf,
  type SearchParams,
} from "@/components/admin/labels";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { RecordList } from "@/components/admin/RecordList";
import { ListSkeleton } from "@/components/admin/Skeletons";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { UploadNoteCard } from "@/components/admin/UploadHint";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  ContentStatus,
  MediaCategory,
  MediaType,
} from "@/generated/prisma/enums";
import { parseListQuery, type ListQuery } from "@/lib/validation/list-query";
import {
  deleteMediaAction,
  setMediaStatusAction,
} from "@/server/actions/media";
import { requireAdminPage } from "@/server/auth/guards";
import { listMedia } from "@/server/services/media";

export const metadata: Metadata = { title: "Media" };

const FILTERS = {
  type: MediaType,
  status: ContentStatus,
  category: MediaCategory,
};
type Query = ListQuery<typeof FILTERS>;

async function MediaList({ query }: { query: Query }) {
  const page = await listMedia(query);
  if (page.total === 0) {
    return (
      <EmptyState
        title={
          query.q || query.type || query.status || query.category
            ? "No matching media"
            : "No media yet"
        }
        description="Add an image link, an audio link or a YouTube video."
        action={<Button href="/admin/media/new">New media</Button>}
      />
    );
  }
  return (
    <>
      <RecordList
        label="Media"
        rows={page.items.map((m) => ({
          id: m.id,
          title: m.titleEn,
          href: `/admin/media/${m.id}`,
          badges: (
            <>
              <StatusBadge status={m.status} />
              <Badge>{MEDIA_TYPE_LABELS[m.type]}</Badge>
              <Badge>{MEDIA_CATEGORY_LABELS[m.category]}</Badge>
              {m.isFeatured ? <Badge variant="gold">Featured</Badge> : null}
              {m.isDemo ? <Badge>Demo</Badge> : null}
            </>
          ),
          meta: formatDate(m.publishedAt),
          actions: (
            <>
              <InlineAction
                action={setMediaStatusAction}
                fields={{
                  id: m.id,
                  status: m.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
                }}
                label={m.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                accessibleLabel={`${m.status === "PUBLISHED" ? "Unpublish" : "Publish"} ${m.titleEn}`}
              />
              <ConfirmDialog
                action={deleteMediaAction}
                fields={{ id: m.id }}
                triggerLabel="Delete"
                title={`Delete "${m.titleEn}"?`}
              />
            </>
          ),
        }))}
      />
      <Pagination
        path="/admin/media"
        query={{
          q: query.q,
          type: query.type,
          status: query.status,
          category: query.category,
        }}
        page={page.page}
        pageCount={page.pageCount}
      />
    </>
  );
}

export default async function MediaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdminPage("/admin/media");
  const query = parseListQuery(await searchParams, FILTERS);
  return (
    <>
      <PageHeader
        title="Media"
        description="Sermons, worship, podcasts and gallery images."
        action={<Button href="/admin/media/new">New media</Button>}
      />
      <div className="mb-6">
        <UploadNoteCard />
      </div>
      <ListToolbar
        action="/admin/media"
        q={query.q}
        filters={[
          {
            name: "type",
            label: "Type",
            value: query.type,
            options: optionsOf(MEDIA_TYPE_LABELS),
          },
          {
            name: "category",
            label: "Category",
            value: query.category,
            options: optionsOf(MEDIA_CATEGORY_LABELS),
          },
          {
            name: "status",
            label: "Status",
            value: query.status,
            options: optionsOf(CONTENT_STATUS_LABELS),
          },
        ]}
      />
      <Suspense key={JSON.stringify(query)} fallback={<ListSkeleton />}>
        <MediaList query={query} />
      </Suspense>
    </>
  );
}
