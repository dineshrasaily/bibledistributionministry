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
import { MediaPickerField } from "@/components/admin/MediaPickerField";
import { MediaTypeFields } from "@/components/admin/MediaTypeFields";
import { PublishControls } from "@/components/admin/PublishControls";
import { StoredFilePanel } from "@/components/admin/StoredFilePanel";
import { THUMBNAIL_HINT, UploadNoteCard } from "@/components/admin/UploadHint";
import type { MediaItem } from "@/generated/prisma/client";
import type { StorageMode } from "@/lib/storage-mode";
import { createMediaAction, updateMediaAction } from "@/server/actions/media";

/** Create / edit form for a media item (pasted link, YouTube link or uploaded file). */
export function MediaEditor({
  media,
  mode,
}: {
  media?: MediaItem;
  mode: StorageMode;
}) {
  const uploaded = media?.storageKey != null;
  return (
    <FormShell
      action={media ? updateMediaAction : createMediaAction}
      label={media ? "Edit media" : "New media"}
    >
      {uploaded ? null : <UploadNoteCard mode={mode} />}
      {media ? <input type="hidden" name="id" value={media.id} /> : null}

      <EditorSection title="Media">
        {uploaded && media ? <StoredFilePanel media={media} /> : null}
        <MediaTypeFields
          defaultType={media?.type ?? "IMAGE"}
          url={media?.url}
          embedUrl={media?.embedUrl}
          altTextEn={media?.altTextEn}
          altTextNe={media?.altTextNe}
          locked={uploaded}
        />
        <SelectField
          name="category"
          label="Category"
          options={optionsOf(MEDIA_CATEGORY_LABELS)}
          defaultValue={media?.category ?? "GENERAL"}
          required
        />
        <TextField
          name="sortOrder"
          label="Order in gallery"
          type="number"
          inputMode="numeric"
          min={0}
          max={9999}
          defaultValue={media?.sortOrder ?? 0}
          hint="Lower numbers come first inside its gallery. Manage galleries under Galleries."
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
        <MediaPickerField
          name="thumbnailUrl"
          label="Thumbnail picture (optional)"
          defaultValue={media?.thumbnailUrl}
          hint={THUMBNAIL_HINT}
          mode={mode}
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
