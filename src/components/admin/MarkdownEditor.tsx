"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { FieldError } from "@/components/ui/FieldError";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { previewMarkdownAction } from "@/server/actions/markdown";
import { cn } from "@/lib/cn";
import { errorIdFor, fieldId, useFieldError } from "./FormShell";
import { Hint, hintIdFor } from "./fields";

type Tab = "write" | "preview";

/** Markdown textarea with Write/Preview tabs; preview is sanitized server-side. */
export function MarkdownEditor({
  name,
  label,
  defaultValue,
  lang,
  rows = 10,
  required,
  hint,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  lang?: "en" | "ne";
  rows?: number;
  required?: boolean;
  hint?: string;
}) {
  const id = fieldId(name);
  const error = useFieldError(name);
  const [tab, setTab] = useState<Tab>("write");
  const [html, setHtml] = useState<string>("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const writeTab = useRef<HTMLButtonElement>(null);
  const previewTab = useRef<HTMLButtonElement>(null);

  async function select(next: Tab) {
    setTab(next);
    if (next !== "preview") return;
    setLoading(true);
    setPreviewError(null);
    const textarea = document.getElementById(id);
    const markdown =
      textarea instanceof HTMLTextAreaElement ? textarea.value : "";
    try {
      const result = await previewMarkdownAction(markdown);
      if (result.ok) setHtml(result.html);
      else setPreviewError(result.formError);
    } catch {
      setPreviewError("Preview unavailable");
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next: Tab = tab === "write" ? "preview" : "write";
    void select(next);
    (next === "write" ? writeTab : previewTab).current?.focus();
  }

  const helpId = hintIdFor(name);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Label htmlFor={id} required={required}>
          {label}
        </Label>
        <div
          role="tablist"
          aria-label={`${label} editor`}
          className="flex gap-1"
        >
          {(["write", "preview"] as const).map((t) => (
            <button
              key={t}
              ref={t === "write" ? writeTab : previewTab}
              type="button"
              role="tab"
              id={`${id}-tab-${t}`}
              aria-selected={tab === t}
              aria-controls={`${id}-panel-${t}`}
              tabIndex={tab === t ? 0 : -1}
              onClick={() => void select(t)}
              onKeyDown={onKeyDown}
              className={cn(
                "min-h-11 rounded-md px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-dark",
                tab === t
                  ? "bg-navy text-white"
                  : "text-navy hover:bg-beige/60",
              )}
            >
              {t === "write" ? "Write" : "Preview"}
            </button>
          ))}
        </div>
      </div>
      <div
        id={`${id}-panel-write`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-write`}
        hidden={tab !== "write"}
      >
        <Textarea
          id={id}
          name={name}
          lang={lang}
          rows={rows}
          defaultValue={defaultValue ?? ""}
          className="mt-1.5 font-mono text-sm"
          aria-required={required || undefined}
          invalid={!!error}
          errorId={errorIdFor(name)}
          aria-describedby={helpId}
        />
      </div>
      <div
        id={`${id}-panel-preview`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-preview`}
        hidden={tab !== "preview"}
        className="mt-1.5 min-h-32 rounded-md border border-navy/25 bg-white p-4"
      >
        {loading ? (
          <p className="text-navy/75">Loading preview…</p>
        ) : previewError ? (
          <p className="text-red-800">{previewError}</p>
        ) : html ? (
          <div
            lang={lang}
            className="space-y-3 text-navy/85 [&_a]:underline [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
            // Sanitized by the server (same pipeline as the public site).
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p className="text-navy/75">Nothing to preview yet.</p>
        )}
      </div>
      <Hint id={helpId}>
        {hint ? `${hint} ` : ""}Markdown: **bold**, *italic*, [link](https://…),
        &quot;- &quot; for lists, &quot;## &quot; for headings.
      </Hint>
      <FieldError id={errorIdFor(name)} message={error} />
    </div>
  );
}
