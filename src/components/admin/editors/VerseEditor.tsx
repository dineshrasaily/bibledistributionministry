import { EditorSection } from "@/components/admin/EditorSection";
import {
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/admin/fields";
import { FormShell } from "@/components/admin/FormShell";
import {
  isoDay,
  optionsOf,
  TRANSLATION_LABELS,
} from "@/components/admin/labels";
import { PublishControls } from "@/components/admin/PublishControls";
import type { BibleVerse } from "@/generated/prisma/client";
import { createVerseAction, updateVerseAction } from "@/server/actions/verses";

/** Create / edit form for a Bible verse (English text only). */
export function VerseEditor({ verse }: { verse?: BibleVerse }) {
  return (
    <FormShell
      action={verse ? updateVerseAction : createVerseAction}
      label={verse ? "Edit verse" : "New verse"}
    >
      {verse ? <input type="hidden" name="id" value={verse.id} /> : null}
      <EditorSection title="Verse">
        <TextField
          name="reference"
          label="Reference"
          defaultValue={verse?.reference ?? ""}
          placeholder="John 3:16"
          maxLength={60}
          required
        />
        <TextAreaField
          name="text"
          label="Verse text (English)"
          lang="en"
          rows={4}
          defaultValue={verse?.text ?? ""}
          hint="Copy the text exactly from the chosen translation. A Nepali translation is not stored."
          required
        />
        <SelectField
          name="translation"
          label="Translation"
          options={optionsOf(TRANSLATION_LABELS)}
          defaultValue={verse?.translation ?? "WEB"}
          required
        />
        <TextField
          name="featuredOn"
          label="Verse of the day on (optional)"
          type="date"
          defaultValue={isoDay(verse?.featuredOn)}
          hint="A date in the ministry time zone (Settings). It replaces the automatic verse for that day. Only published verses can be featured."
        />
      </EditorSection>
      <PublishControls status={verse?.status ?? null} />
    </FormShell>
  );
}
