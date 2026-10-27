import { TextAreaField } from "./fields";
import { FormShell, type FormAction } from "./FormShell";
import { SubmitButton } from "./SubmitButton";

/** Private admin note on a prayer request or message. */
export function InboxNoteForm({
  action,
  id,
  note,
}: {
  action: FormAction;
  id: string;
  note: string | null;
}) {
  return (
    <FormShell action={action} label="Edit private note" className="gap-4">
      <input type="hidden" name="id" value={id} />
      <TextAreaField
        name="adminNote"
        label="Private note"
        rows={4}
        maxLength={2000}
        defaultValue={note ?? ""}
        hint="Only admins can see this. Never copy it to public text."
      />
      <div>
        <SubmitButton>Save note</SubmitButton>
      </div>
    </FormShell>
  );
}
