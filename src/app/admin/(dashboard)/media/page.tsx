import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { InlineAction } from "@/components/admin/InlineAction";
import {
  CONTENT_STATUS_LABELS,
  MEDIA_CATEGORY_LABELS,
  MEDIA_TYPE_LABELS,
  optionsOf,
  type SearchParams,
} from "@/components/admin/labels";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { ListSkeleton } from "@/components/admin/Skeletons";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { UploadNoteCard } from "@/components/admin/UploadHint";
import { MediaUploader } from "@/components/admin/uploads/MediaUploader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SiteImage } from "@/components/ui/SiteImage";
import {
  ContentStatus,
  MediaCategory,
  MediaType,
} from "@/generated/prisma/enums";
import type { StorageMode } from "@/lib/storage-mode";
import { formatBytes } from "@/lib/uploads/policy";
import { isSafeUrl } from "@/lib/validation/common";
import { parseListQuery, type ListQuery } from "@/lib/validation/list-query";
import {
  deleteMediaAction,
  setMediaStatusAction,
} from "@/server/actions/media";
import { requireAdminPage } from "@/server/auth/guards";
import { listMedia } from "@/server/services/media";
import { getStorageMode } from "@/server/storage";

export const metadata: Metadata = { title: "Media library" };

const SOURCE = { upload: "upload", link: "link" } as const;
const SOURCE_LABELS = { upload: "Uploaded", link: "Link" } as const;

const FILTERS = {
  type: MediaType,
  status: ContentStatus,
  category: MediaCategory,
  source: SOURCE,
};
type Query = ListQuery<typeof FILTERS>;

function TypeTile({ type }: { type: MediaType }) {
  return (
    <div
      aria-hidden="true"
      className="flex size-full items-center justify-center bg-[linear-gradient(135deg,var(--color-navy)_0%,var(--color-navy-deep)_100%)] text-gold"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        {type === "AUDIO" ? (
          <>
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </>
        ) : type === "VIDEO_EMBED" ? (
          <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
        ) : (
          <>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 16 5-5 4 4 3-3 6 6" />
          </>
        )}
      </svg>
    </div>
  );
}

async function MediaGrid({ query }: { query: Query }) {
  const page = await listMedia(query);
  if (page.total === 0) {
    const filtered =
      query.q || query.type || query.status || query.category || query.source;
    return (
      <EmptyState
        title={filtered ? "No matching media" : "No media yet"}
        description="Upload pictures or audio above, or add an image, audio or YouTube link."
        action={<Button href="/admin/media/new">Add a link</Button>}
      />
    );
  }
  return (
    <>
      <ul
        aria-label="Media"
        className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4"
        data-testid="media-grid"
      >
        {page.items.map((m) => {
          const thumb =
            m.type === "IMAGE" && m.url && isSafeUrl(m.url)
              ? { src: m.url, alt: m.altTextEn ?? "" }
              : m.thumbnailUrl && isSafeUrl(m.thumbnailUrl)
                ? { src: m.thumbnailUrl, alt: "" }
                : null;
          const action = m.status === "PUBLISHED" ? "Unpublish" : "Publish";
          return (
            <li
              key={m.id}
              className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-beige bg-white"
              data-testid="media-card"
            >
              <div className="relative aspect-[4/3] w-full bg-beige">
                {thumb ? (
                  <SiteImage
                    src={thumb.src}
                    alt={thumb.alt}
                    fill
                    sizes="(min-width: 1024px) 20vw, (min-width: 768px) 30vw, 50vw"
                    className="object-cover"
                  />
                ) : (
                  <TypeTile type={m.type} />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <Link
                  href={`/admin/media/${m.id}`}
                  className="rounded-sm font-semibold break-words text-navy underline decoration-gold underline-offset-4 hover:decoration-2"
                >
                  {m.titleEn}
                </Link>
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge status={m.status} />
                  <Badge>{MEDIA_TYPE_LABELS[m.type]}</Badge>
                  <Badge>{MEDIA_CATEGORY_LABELS[m.category]}</Badge>
                  {m.isFeatured ? <Badge variant="gold">Featured</Badge> : null}
                  {m.isDemo ? <Badge>Demo</Badge> : null}
                </div>
                <p className="text-sm text-navy/75" data-testid="media-source">
                  {m.storageDriver
                    ? `${MEDIA_TYPE_LABELS[m.type]} · Uploaded${m.sizeBytes != null ? ` · ${formatBytes(m.sizeBytes)}` : ""}`
                    : "Link"}
                </p>
                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  <InlineAction
                    action={setMediaStatusAction}
                    fields={{
                      id: m.id,
                      status: m.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
                    }}
                    label={action}
                    accessibleLabel={`${action} ${m.titleEn}`}
                  />
                  <ConfirmDialog
                    action={deleteMediaAction}
                    fields={{ id: m.id }}
                    triggerLabel="Delete"
                    title={`Delete "${m.titleEn}"?`}
                    description={
                      m.storageDriver
                        ? "The stored file is deleted too. This can't be undone."
                        : undefined
                    }
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <Pagination
        path="/admin/media"
        query={{
          q: query.q,
          type: query.type,
          status: query.status,
          category: query.category,
          source: query.source,
        }}
        page={page.page}
        pageCount={page.pageCount}
      />
    </>
  );
}

function UploadPanel({ mode }: { mode: StorageMode }) {
  if (mode === "disabled") return <UploadNoteCard mode="disabled" />;
  return (
    <details
      id="upload-files"
      className="group rounded-lg border border-beige bg-white p-4 sm:p-6"
      data-testid="upload-panel"
    >
      <summary className="flex min-h-11 cursor-pointer items-center font-serif text-xl font-semibold text-navy">
        Upload files
      </summary>
      <div className="mt-4 flex flex-col gap-4">
        <UploadNoteCard mode={mode} />
        <MediaUploader
          mode={mode}
          accept="image+audio"
          multiple
          refreshOnSuccess
        />
      </div>
    </details>
  );
}

export default async function MediaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdminPage("/admin/media");
  const query = parseListQuery(await searchParams, FILTERS);
  const mode = getStorageMode();
  return (
    <>
      <PageHeader
        title="Media library"
        description="Uploaded pictures and audio, plus links to sermons, worship and YouTube videos."
        action={<Button href="/admin/media/new">Add a link</Button>}
      />
      <div className="mb-6">
        <UploadPanel mode={mode} />
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
          {
            name: "source",
            label: "Source",
            value: query.source,
            options: optionsOf(SOURCE_LABELS),
          },
        ]}
      />
      <Suspense key={JSON.stringify(query)} fallback={<ListSkeleton />}>
        <MediaGrid query={query} />
      </Suspense>
    </>
  );
}
