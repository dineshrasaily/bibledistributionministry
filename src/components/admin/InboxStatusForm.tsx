import { SelectField } from "./fields";
import { FormShell, type FormAction } from "./FormShell";
import { SubmitButton } from "./SubmitButton";

/** Status select + Save for a prayer request or message. */
export function InboxStatusForm({
  action,
  id,
  status,
  options,
}: {
  action: FormAction;
  id: string;
  status: string;
  options: { value: string; label: string }[];
}) {
  return (
    <FormShell action={action} label="Change status" className="gap-4">
      <input type="hidden" name="id" value={id} />
      <SelectField
        name="status"
        label="Status"
        options={options}
        defaultValue={status}
        className="max-w-xs"
      />
      <div>
        <SubmitButton>Save</SubmitButton>
      </div>
    </FormShell>
  );
}
