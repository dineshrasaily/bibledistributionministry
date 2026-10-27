import { BilingualField } from "@/components/admin/BilingualField";
import { DateTimeField } from "@/components/admin/DateTimeField";
import { EditorSection } from "@/components/admin/EditorSection";
import {
  CheckboxField,
  SelectField,
  TextField,
} from "@/components/admin/fields";
import { FormShell } from "@/components/admin/FormShell";
import { MEDIA_CATEGORY_LABELS, optionsOf } from "@/components/admin/labels";
import { MediaTypeFields } from "@/components/admin/MediaTypeFields";
import { PublishControls } from "@/components/admin/PublishControls";
import { UPLOAD_HINT, UploadNoteCard } from "@/components/admin/UploadHint";
import type { MediaItem } from "@/generated/prisma/client";
import { createMediaAction, updateMediaAction } from "@/server/actions/media";

/** Create / edit form for a media item (image, audio or YouTube link). */
export function MediaEditor({
  media,
  events,
}: {
  media?: MediaItem;
  /** Options for the linked mission/event select. */
  events: { id: string; label: string }[];
}) {
  return (
    <FormShell
      action={media ? updateMediaAction : createMediaAction}
      label={media ? "Edit media" : "New media"}
    >
      <UploadNoteCard />
      {media ? <input type="hidden" name="id" value={media.id} /> : null}

      <EditorSection title="Media">
        <MediaTypeFields
          defaultType={media?.type ?? "IMAGE"}
          url={media?.url}
          embedUrl={media?.embedUrl}
          altTextEn={media?.altTextEn}
          altTextNe={media?.altTextNe}
        />
        <SelectField
          name="category"
          label="Category"
          options={optionsOf(MEDIA_CATEGORY_LABELS)}
          defaultValue={media?.category ?? "GENERAL"}
          required
        />
        {/* TODO(Phase 7): proper galleries (create, order, link to an event). */}
        <SelectField
          name="eventId"
          label="Linked mission/event (optional)"
          options={[
            { value: "", label: "None" },
            ...events.map((e) => ({ value: e.id, label: e.label })),
          ]}
          defaultValue={media?.eventId ?? ""}
          hint="Photos linked to an event appear in its gallery on the Missions page."
        />
        <TextField
          name="sortOrder"
          label="Order in gallery"
          type="number"
          inputMode="numeric"
          min={0}
          max={9999}
          defaultValue={media?.sortOrder ?? 0}
          hint="Lower numbers come first."
        />
      </EditorSection>

      <EditorSection title="Details">
        <BilingualField
          name="title"
          label="Title"
          required
          maxLength={160}
          defaultEn={media?.titleEn}
          defaultNe={media?.titleNe}
        />
        <BilingualField
          name="description"
          label="Description"
          multiline
          rows={3}
          maxLength={1000}
          defaultEn={media?.descriptionEn}
          defaultNe={media?.descriptionNe}
        />
        <TextField
          name="durationMinutes"
          label="Length in minutes (optional)"
          type="number"
          inputMode="numeric"
          min={0}
          max={1440}
          defaultValue={media?.durationMinutes ?? ""}
        />
        {/* TODO(Phase 7): replace with an image upload. */}
        <TextField
          name="thumbnailUrl"
          label="Thumbnail image link (optional)"
          type="url"
          inputMode="url"
          defaultValue={media?.thumbnailUrl ?? ""}
          placeholder="https://"
          hint={UPLOAD_HINT}
        />
        <DateTimeField
          name="publishedAt"
          label="Date"
          defaultValue={media?.publishedAt.toISOString() ?? null}
          hint="Leave empty to use now."
        />
        <CheckboxField
          name="isFeatured"
          label="Feature on the home page"
          defaultChecked={media?.isFeatured ?? false}
        />
      </EditorSection>

      <PublishControls status={media?.status ?? null} />
    </FormShell>
  );
}
