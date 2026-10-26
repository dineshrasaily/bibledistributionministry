"use client";

import { FieldError } from "@/components/ui/FieldError";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { errorIdFor, fieldId, useFieldError } from "./FormShell";
import { Hint, hintIdFor } from "./fields";

export const NE_HINT = "Leave empty to show the English text.";

/**
 * A field with English and Nepali inputs side by side (md+) or stacked.
 * Field names are `<name>En` and `<name>Ne`; the Nepali input has lang="ne".
 */
export function BilingualField({
  name,
  label,
  multiline = false,
  rows,
  required = false,
  defaultEn,
  defaultNe,
  maxLength,
  hint,
}: {
  /** Base name, e.g. "title" -> titleEn / titleNe. */
  name: string;
  label: string;
  multiline?: boolean;
  rows?: number;
  /** Whether the English value is required (Nepali never is). */
  required?: boolean;
  defaultEn?: string | null;
  defaultNe?: string | null;
  maxLength?: number;
  hint?: string;
}) {
  const enName = `${name}En`;
  const neName = `${name}Ne`;
  const enError = useFieldError(enName);
  const neError = useFieldError(neName);
  const Control = multiline ? Textarea : Input;
  const extra = multiline ? { rows } : {};

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-serif text-lg font-semibold text-navy">
        {label}
      </legend>
      {hint ? <Hint>{hint}</Hint> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor={fieldId(enName)} required={required}>
            {label} (English)
          </Label>
          <Control
            id={fieldId(enName)}
            name={enName}
            lang="en"
            defaultValue={defaultEn ?? ""}
            maxLength={maxLength}
            aria-required={required || undefined}
            invalid={!!enError}
            errorId={errorIdFor(enName)}
            className="mt-1.5"
            {...extra}
          />
          <FieldError id={errorIdFor(enName)} message={enError} />
        </div>
        <div>
          <Label htmlFor={fieldId(neName)}>{label} (नेपाली, Nepali)</Label>
          <Control
            id={fieldId(neName)}
            name={neName}
            lang="ne"
            defaultValue={defaultNe ?? ""}
            maxLength={maxLength}
            invalid={!!neError}
            errorId={errorIdFor(neName)}
            aria-describedby={hintIdFor(neName)}
            className="mt-1.5"
            {...extra}
          />
          <Hint id={hintIdFor(neName)}>{NE_HINT}</Hint>
          <FieldError id={errorIdFor(neName)} message={neError} />
        </div>
      </div>
    </fieldset>
  );
}
