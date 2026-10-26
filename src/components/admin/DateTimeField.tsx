"use client";

import { useState, useSyncExternalStore } from "react";
import { FieldError } from "@/components/ui/FieldError";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { errorIdFor, fieldId, useFieldError } from "./FormShell";
import { Hint, hintIdFor } from "./fields";

const pad = (n: number) => String(n).padStart(2, "0");
const noopSubscribe = () => () => {};

/** Date -> "YYYY-MM-DDTHH:mm" in the browser's time zone. */
export function toLocalInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "YYYY-MM-DDTHH:mm" (local) -> ISO with the browser's offset, or "". */
export function localInputToIso(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${value.length === 16 ? `${value}:00` : value}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/**
 * datetime-local input plus a hidden ISO value carrying the browser offset.
 * The visible value is filled after mount (server and browser time zones
 * differ), and the hidden input keeps the stored value until then.
 */
export function DateTimeField({
  name,
  label,
  defaultValue,
  required,
  hint,
}: {
  name: string;
  label: string;
  /** ISO string or null. */
  defaultValue?: string | null;
  required?: boolean;
  hint?: string;
}) {
  const id = fieldId(name);
  const error = useFieldError(name);
  const [iso, setIso] = useState(defaultValue ?? "");
  // false during SSR and hydration, true afterwards (no setState in an effect).
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const local = mounted && iso ? toLocalInput(new Date(iso)) : "";
  const zone = mounted ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";

  return (
    <div>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <Input
        id={id}
        type="datetime-local"
        value={local}
        onChange={(e) => setIso(localInputToIso(e.target.value))}
        className="mt-1.5"
        aria-required={required || undefined}
        invalid={!!error}
        errorId={errorIdFor(name)}
        aria-describedby={hintIdFor(name)}
      />
      <input type="hidden" name={name} value={iso} />
      <Hint id={hintIdFor(name)}>
        {hint ? `${hint} ` : ""}
        {zone ? `Time zone: ${zone}.` : ""}
      </Hint>
      <FieldError id={errorIdFor(name)} message={error} />
    </div>
  );
}
