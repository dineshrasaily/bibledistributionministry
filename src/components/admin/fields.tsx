"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Checkbox } from "@/components/ui/Checkbox";
import { FieldError } from "@/components/ui/FieldError";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";
import { errorIdFor, fieldId, useFieldError } from "./FormShell";

export const hintIdFor = (name: string) => `${fieldId(name)}-hint`;

export function Hint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 text-sm text-navy/75">
      {children}
    </p>
  );
}

type BaseProps = {
  name: string;
  label: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
};

function describedByHint(name: string, hint: ReactNode | undefined) {
  return hint ? hintIdFor(name) : undefined;
}

/** Labelled text input wired to the surrounding FormShell's field errors. */
export function TextField({
  name,
  label,
  hint,
  required,
  className,
  ...rest
}: BaseProps &
  Omit<ComponentPropsWithoutRef<"input">, "name" | "id" | "required">) {
  const error = useFieldError(name);
  const id = fieldId(name);
  return (
    <div className={className}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <Input
        id={id}
        name={name}
        className="mt-1.5"
        aria-required={required || undefined}
        invalid={!!error}
        errorId={errorIdFor(name)}
        aria-describedby={describedByHint(name, hint)}
        {...rest}
      />
      {hint ? <Hint id={hintIdFor(name)}>{hint}</Hint> : null}
      <FieldError id={errorIdFor(name)} message={error} />
    </div>
  );
}

export function TextAreaField({
  name,
  label,
  hint,
  required,
  className,
  ...rest
}: BaseProps &
  Omit<ComponentPropsWithoutRef<"textarea">, "name" | "id" | "required">) {
  const error = useFieldError(name);
  const id = fieldId(name);
  return (
    <div className={className}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <Textarea
        id={id}
        name={name}
        className="mt-1.5"
        aria-required={required || undefined}
        invalid={!!error}
        errorId={errorIdFor(name)}
        aria-describedby={describedByHint(name, hint)}
        {...rest}
      />
      {hint ? <Hint id={hintIdFor(name)}>{hint}</Hint> : null}
      <FieldError id={errorIdFor(name)} message={error} />
    </div>
  );
}

export type Option = { value: string; label: string };

export function SelectField({
  name,
  label,
  hint,
  required,
  className,
  options,
  ...rest
}: BaseProps & { options: readonly Option[] } & Omit<
    ComponentPropsWithoutRef<"select">,
    "name" | "id" | "required" | "children"
  >) {
  const error = useFieldError(name);
  const id = fieldId(name);
  return (
    <div className={className}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <Select
        id={id}
        name={name}
        className="mt-1.5"
        aria-required={required || undefined}
        invalid={!!error}
        errorId={errorIdFor(name)}
        aria-describedby={describedByHint(name, hint)}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      {hint ? <Hint id={hintIdFor(name)}>{hint}</Hint> : null}
      <FieldError id={errorIdFor(name)} message={error} />
    </div>
  );
}

export function CheckboxField({
  name,
  label,
  hint,
  className,
  ...rest
}: Omit<BaseProps, "required"> &
  Omit<ComponentPropsWithoutRef<"input">, "name" | "id" | "type">) {
  const error = useFieldError(name);
  const id = fieldId(name);
  return (
    <div className={cn("flex flex-col", className)}>
      <Checkbox
        id={id}
        name={name}
        label={label}
        invalid={!!error}
        errorId={errorIdFor(name)}
        aria-describedby={describedByHint(name, hint)}
        {...rest}
      />
      {hint ? (
        <div className="pl-8">
          <Hint id={hintIdFor(name)}>{hint}</Hint>
        </div>
      ) : null}
      <FieldError id={errorIdFor(name)} message={error} />
    </div>
  );
}

/** Field-level error for inputs without their own wrapper (checkbox groups). */
export function GroupError({ name }: { name: string }) {
  const error = useFieldError(name);
  return <FieldError id={errorIdFor(name)} message={error} />;
}
