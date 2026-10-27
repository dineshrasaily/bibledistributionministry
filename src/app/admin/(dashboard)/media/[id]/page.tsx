import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { MediaEditor } from "@/components/admin/editors/MediaEditor";
import { formatDate, type IdParams } from "@/components/admin/labels";
import { PageHeader } from "@/components/admin/PageHeader";
import { RecordMeta } from "@/components/admin/RecordMeta";
import { deleteMediaAction } from "@/server/actions/media";
import { requireAdminPage } from "@/server/auth/guards";
import { listEventOptions } from "@/server/services/events";
import { getMedia } from "@/server/services/media";

export const metadata: Metadata = { title: "Edit media" };

export default async function EditMediaPage({ params }: { params: IdParams }) {
  const { id } = await params;
  await requireAdminPage(`/admin/media/${id}`);
  const [media, events] = await Promise.all([getMedia(id), listEventOptions()]);
  if (!media) notFound();

  return (
    <>
      <PageHeader
        title={media.titleEn}
        description={
          <RecordMeta status={media.status} updatedAt={media.updatedAt} />
        }
      />
      <MediaEditor
        media={media}
        events={events.map((e) => ({
          id: e.id,
          label: `${e.titleEn} (${formatDate(e.startsAt)})`,
        }))}
      />
      <div className="mt-8 flex justify-end">
        <ConfirmDialog
          action={deleteMediaAction}
          fields={{ id: media.id }}
          triggerLabel="Delete media"
          title={`Delete "${media.titleEn}"?`}
        />
      </div>
    </>
  );
}
