"use client";

import { useEffect, useRef, useState } from "react";
import { FieldError } from "@/components/ui/FieldError";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { errorIdFor, fieldId, useFieldError } from "./FormShell";
import { Hint, hintIdFor } from "./fields";

/** "Hello, World!" -> "hello-world" (ASCII only; Nepali titles need a manual slug). */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** URL slug that follows the English title until the user edits it. */
export function SlugField({
  name = "slug",
  sourceName = "titleEn",
  defaultValue,
}: {
  name?: string;
  /** Field name whose value seeds the slug. */
  sourceName?: string;
  defaultValue?: string | null;
}) {
  const id = fieldId(name);
  const error = useFieldError(name);
  const [value, setValue] = useState(defaultValue ?? "");
  // Existing records keep their slug unless the user edits it.
  const touched = useRef(Boolean(defaultValue));

  useEffect(() => {
    const source = document.getElementById(fieldId(sourceName));
    if (!(source instanceof HTMLInputElement)) return;
    const onInput = () => {
      if (!touched.current) setValue(slugify(source.value));
    };
    const form = source.form;
    const onReset = () => {
      touched.current = Boolean(defaultValue);
      setValue(defaultValue ?? "");
    };
    source.addEventListener("input", onInput);
    form?.addEventListener("reset", onReset);
    return () => {
      source.removeEventListener("input", onInput);
      form?.removeEventListener("reset", onReset);
    };
  }, [sourceName, defaultValue]);

  return (
    <div>
      <Label htmlFor={id} required>
        URL slug
      </Label>
      <Input
        id={id}
        name={name}
        value={value}
        onChange={(e) => {
          touched.current = true;
          setValue(e.target.value);
        }}
        className="mt-1.5 font-mono text-sm"
        aria-required
        invalid={!!error}
        errorId={errorIdFor(name)}
        aria-describedby={hintIdFor(name)}
        autoComplete="off"
        spellCheck={false}
      />
      <Hint id={hintIdFor(name)}>
        Lowercase letters, numbers and hyphens, for example my-first-post.
      </Hint>
      <FieldError id={errorIdFor(name)} message={error} />
    </div>
  );
}
