import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { EditorSection } from "@/components/admin/EditorSection";
import { GalleryEditor } from "@/components/admin/editors/GalleryEditor";
import { GalleryAddPictures } from "@/components/admin/GalleryAddPictures";
import { InlineAction } from "@/components/admin/InlineAction";
import type { IdParams } from "@/components/admin/labels";
import { PageHeader } from "@/components/admin/PageHeader";
import { RecordMeta } from "@/components/admin/RecordMeta";
import { FormSkeleton } from "@/components/admin/Skeletons";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { MediaUploader } from "@/components/admin/uploads/MediaUploader";
import { Button } from "@/components/ui/Button";
import { SiteImage } from "@/components/ui/SiteImage";
import { isSafeUrl } from "@/lib/validation/common";
import {
  deleteGalleryAction,
  moveGalleryItemAction,
  removeGalleryItemAction,
} from "@/server/actions/galleries";
import { setMediaStatusAction } from "@/server/actions/media";
import { requireAdminPage } from "@/server/auth/guards";
import { getGallery } from "@/server/services/galleries";
import { getStorageMode } from "@/server/storage";

export const metadata: Metadata = { title: "Edit gallery" };

function EdgeButton({ label }: { label: string }) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="min-h-11"
      disabled
    >
      {label}
    </Button>
  );
}

export default async function EditGalleryPage({
  params,
}: {
  params: IdParams;
}) {
  const { id } = await params;
  await requireAdminPage(`/admin/galleries/${id}`);
  const gallery = await getGallery(id);
  if (!gallery) notFound();
  const mode = getStorageMode();
  const { items } = gallery;
  const viewOnSite =
    gallery.status === "PUBLISHED" &&
    gallery.event?.publishStatus === "PUBLISHED"
      ? `/en/missions/${gallery.event.slug}`
      : null;

  return (
    <>
      <PageHeader
        title={gallery.titleEn}
        description={
          <RecordMeta status={gallery.status} updatedAt={gallery.updatedAt} />
        }
        action={
          viewOnSite ? (
            <Button href={viewOnSite} variant="secondary">
              View on site
            </Button>
          ) : undefined
        }
      />
      <div className="flex flex-col gap-8">
        <Suspense fallback={<FormSkeleton />}>
          <GalleryEditor gallery={gallery} />
        </Suspense>

        <EditorSection title="Photos">
          <p className="text-sm text-navy/80">
            Visitors see the published photos in this order. Draft photos are
            not shown.
          </p>
          {items.length === 0 ? (
            <p className="text-sm text-navy/80" data-testid="gallery-empty">
              No photos yet. Add pictures from the library or upload new ones.
            </p>
          ) : (
            <ol
              aria-label="Photos in this gallery"
              className="flex flex-col gap-3"
            >
              {items.map((item, i) => {
                const url = item.url && isSafeUrl(item.url) ? item.url : null;
                return (
                  <li
                    key={item.id}
                    className="flex flex-col gap-3 rounded-lg border border-beige bg-white p-3 sm:flex-row sm:items-center"
                    data-testid="gallery-item"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="w-6 shrink-0 text-right text-sm font-semibold text-navy/70">
                        {i + 1}.
                      </span>
                      <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-beige">
                        {url ? (
                          <SiteImage
                            src={url}
                            alt=""
                            fill
                            sizes="4rem"
                            className="object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="flex min-w-0 flex-col gap-1">
                        <Link
                          href={`/admin/media/${item.id}`}
                          className="font-semibold break-words text-navy underline decoration-gold underline-offset-4"
                        >
                          {item.titleEn}
                        </Link>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={item.status} />
                          {item.status === "DRAFT" ? (
                            <span className="text-sm text-navy/75">
                              Draft photos are not shown
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {i === 0 ? (
                        <EdgeButton label="Move up" />
                      ) : (
                        <InlineAction
                          action={moveGalleryItemAction}
                          fields={{
                            galleryId: gallery.id,
                            mediaId: item.id,
                            direction: "up",
                          }}
                          label="Move up"
                          accessibleLabel={`Move up: ${item.titleEn}`}
                        />
                      )}
                      {i === items.length - 1 ? (
                        <EdgeButton label="Move down" />
                      ) : (
                        <InlineAction
                          action={moveGalleryItemAction}
                          fields={{
                            galleryId: gallery.id,
                            mediaId: item.id,
                            direction: "down",
                          }}
                          label="Move down"
                          accessibleLabel={`Move down: ${item.titleEn}`}
                        />
                      )}
                      {item.status === "DRAFT" ? (
                        <InlineAction
                          action={setMediaStatusAction}
                          fields={{ id: item.id, status: "PUBLISHED" }}
                          label="Publish"
                          accessibleLabel={`Publish ${item.titleEn}`}
                        />
                      ) : null}
                      <InlineAction
                        action={removeGalleryItemAction}
                        fields={{ galleryId: gallery.id, mediaId: item.id }}
                        label="Remove from gallery"
                        accessibleLabel={`Remove from gallery: ${item.titleEn}`}
                        variant="ghost"
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <div className="flex flex-wrap gap-3">
            <GalleryAddPictures
              galleryId={gallery.id}
              currentIds={items.map((i) => i.id)}
            />
          </div>
          {mode !== "disabled" ? (
            <details
              className="rounded-lg border border-beige bg-ivory p-4"
              data-testid="gallery-upload"
            >
              <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-navy">
                Upload new pictures
              </summary>
              <div className="mt-4">
                <MediaUploader
                  mode={mode}
                  accept="image"
                  multiple
                  galleryId={gallery.id}
                  defaultPublish
                  refreshOnSuccess
                />
              </div>
            </details>
          ) : null}
        </EditorSection>
      </div>
      <div className="mt-8 flex justify-end">
        <ConfirmDialog
          action={deleteGalleryAction}
          fields={{ id: gallery.id }}
          triggerLabel="Delete gallery"
          title={`Delete "${gallery.titleEn}"?`}
          description="The pictures stay in the media library. This can't be undone."
        />
      </div>
    </>
  );
}
