import { BilingualField } from "@/components/admin/BilingualField";
import { EditorSection } from "@/components/admin/EditorSection";
import { SelectField } from "@/components/admin/fields";
import { FormShell } from "@/components/admin/FormShell";
import { formatDate } from "@/components/admin/labels";
import { PublishControls } from "@/components/admin/PublishControls";
import type { Gallery } from "@/generated/prisma/client";
import {
  createGalleryAction,
  updateGalleryAction,
} from "@/server/actions/galleries";
import { listEventOptions } from "@/server/services/events";

/** Create / edit form for a photo gallery (server component; loads the events). */
export async function GalleryEditor({
  gallery,
  defaultEventId,
}: {
  gallery?: Gallery;
  defaultEventId?: string | null;
}) {
  const events = await listEventOptions();
  return (
    <FormShell
      action={gallery ? updateGalleryAction : createGalleryAction}
      label={gallery ? "Edit gallery" : "New gallery"}
    >
      {gallery ? <input type="hidden" name="id" value={gallery.id} /> : null}
      <EditorSection title="Gallery">
        <BilingualField
          name="title"
          label="Title"
          required
          maxLength={160}
          defaultEn={gallery?.titleEn}
          defaultNe={gallery?.titleNe}
        />
        <BilingualField
          name="description"
          label="Description (optional)"
          multiline
          rows={3}
          maxLength={1000}
          defaultEn={gallery?.descriptionEn}
          defaultNe={gallery?.descriptionNe}
        />
        <SelectField
          name="eventId"
          label="Linked mission/event (optional)"
          options={[
            { value: "", label: "None" },
            ...events.map((e) => ({
              value: e.id,
              label: `${e.titleEn} (${formatDate(e.startsAt)})`,
            })),
          ]}
          defaultValue={gallery?.eventId ?? defaultEventId ?? ""}
          hint="A published gallery linked to a published event is shown on that event's page and in the Media Center."
        />
      </EditorSection>
      <PublishControls status={gallery?.status ?? null} />
    </FormShell>
  );
}
