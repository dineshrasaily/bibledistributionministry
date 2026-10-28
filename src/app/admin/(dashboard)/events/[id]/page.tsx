import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { EventEditor } from "@/components/admin/editors/EventEditor";
import type { IdParams } from "@/components/admin/labels";
import { PageHeader } from "@/components/admin/PageHeader";
import { RecordMeta } from "@/components/admin/RecordMeta";
import { deleteEventAction } from "@/server/actions/events";
import { requireAdminPage } from "@/server/auth/guards";
import { getEvent } from "@/server/services/events";
import { listGalleriesForEvent } from "@/server/services/galleries";

export const metadata: Metadata = { title: "Edit event" };

export default async function EditEventPage({ params }: { params: IdParams }) {
  const { id } = await params;
  await requireAdminPage(`/admin/events/${id}`);
  const [event, galleries] = await Promise.all([
    getEvent(id),
    listGalleriesForEvent(id),
  ]);
  if (!event) notFound();

  return (
    <>
      <PageHeader
        title={event.titleEn}
        description={
          <RecordMeta
            status={event.publishStatus}
            updatedAt={event.updatedAt}
          />
        }
      />
      <EventEditor event={event} galleries={galleries} />
      <div className="mt-8 flex justify-end">
        <ConfirmDialog
          action={deleteEventAction}
          fields={{ id: event.id }}
          triggerLabel="Delete event"
          title={`Delete "${event.titleEn}"?`}
        />
      </div>
    </>
  );
}
