"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { SiteImage } from "@/components/ui/SiteImage";
import { cn } from "@/lib/cn";
import type { StorageMode } from "@/lib/storage-mode";
import { isSafeUrl } from "@/lib/validation/common";
import { Hint, hintIdFor } from "./fields";
import { errorIdFor, fieldId, useFieldError } from "./FormShell";
import { MediaUploader } from "./uploads/MediaUploader";

export type LibraryPicture = {
  id: string;
  title: string;
  url: string;
  alt: string | null;
  altNe?: string | null;
  status: "DRAFT" | "PUBLISHED";
  uploaded: boolean;
};

type LoadState = "idle" | "loading" | "error" | "unauthenticated";

/**
 * Picture field: a preview, "Choose from library" (search + grid dialog,
 * with an "Upload new picture" tab) and a plain text input as the link
 * fallback. Submits the same field name as before, so the server-side
 * validation (optionalSafeUrl) is unchanged.
 */
export function MediaPickerField({
  name,
  label,
  defaultValue,
  hint,
  mode,
  altFields,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  hint?: string;
  mode: StorageMode;
  /** Empty alt-text inputs (by name) to fill when a picture is chosen. */
  altFields?: { en: string; ne?: string };
}) {
  const id = fieldId(name);
  const error = useFieldError(name);
  const searchId = useId();
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"library" | "upload">("library");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<LibraryPicture[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [state, setState] = useState<LoadState>("idle");

  const load = useCallback(async (query: string, nextPage: number) => {
    setState("loading");
    try {
      const params = new URLSearchParams({
        kind: "image",
        page: String(nextPage),
      });
      if (query.trim() !== "") params.set("q", query.trim());
      const res = await fetch(`/api/admin/media/library?${params}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (res.status === 401) return setState("unauthenticated");
      if (!res.ok) return setState("error");
      const body = (await res.json()) as {
        items: LibraryPicture[];
        page: number;
        pageCount: number;
      };
      setItems((prev) =>
        nextPage === 1 ? body.items : [...prev, ...body.items],
      );
      setPage(body.page);
      setPageCount(body.pageCount);
      setState("idle");
    } catch {
      setState("error");
    }
  }, []);

  function fillAlt(
    alt: string | null | undefined,
    altNe: string | null | undefined,
  ) {
    const form = (document.getElementById(id) as HTMLInputElement | null)?.form;
    if (!form || !altFields) return;
    const fill = (
      field: string | undefined,
      text: string | null | undefined,
    ) => {
      if (!field || !text) return;
      const el = form.elements.namedItem(field);
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        if (el.value.trim() === "") el.value = text;
      }
    };
    fill(altFields.en, alt);
    fill(altFields.ne, altNe);
  }

  function choose(url: string, alt: string | null, altNe?: string | null) {
    setValue(url);
    fillAlt(alt, altNe);
    setOpen(false);
  }

  const preview =
    value.trim() !== "" && isSafeUrl(value.trim()) ? value.trim() : null;
  const tabClass = (active: boolean) =>
    cn(
      "min-h-11 rounded-full px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-dark",
      active
        ? "bg-navy text-white"
        : "border border-navy text-navy hover:bg-navy/5",
    );

  return (
    <div data-testid={`picker-${name}`}>
      <Label htmlFor={id}>{label}</Label>
      <div className="mt-1.5 flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-beige bg-beige/60">
          {preview ? (
            <SiteImage
              src={preview}
              alt=""
              className="size-full object-contain"
            />
          ) : (
            <span className="px-2 text-center text-xs text-navy/70">
              No picture
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Input
            id={id}
            name={name}
            type="text"
            inputMode="url"
            placeholder="https://"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            invalid={!!error}
            errorId={errorIdFor(name)}
            aria-describedby={hint ? hintIdFor(name) : undefined}
          />
          <div className="flex flex-wrap gap-3">
            <Dialog.Root
              open={open}
              onOpenChange={(next) => {
                setOpen(next);
                if (next) {
                  setTab("library");
                  setQ("");
                  void load("", 1);
                }
              }}
            >
              <Dialog.Trigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="min-h-11"
                  aria-label={`Choose from library: ${label}`}
                >
                  Choose from library
                </Button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-navy/40" />
                <Dialog.Content
                  className="fixed top-1/2 left-1/2 z-50 flex max-h-[min(90dvh,48rem)] w-[min(56rem,calc(100%-1.5rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg border border-beige bg-white p-4 shadow-2xl focus:outline-none sm:p-6"
                  data-testid="media-picker"
                >
                  <div className="flex items-start justify-between gap-4">
                    <Dialog.Title className="font-serif text-xl font-semibold text-navy">
                      Choose a picture
                    </Dialog.Title>
                    <Dialog.Close asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-11"
                      >
                        Close
                      </Button>
                    </Dialog.Close>
                  </div>
                  <Dialog.Description className="text-sm text-navy/80">
                    For: {label}. Draft pictures can be used too; they are shown
                    wherever you put them.
                  </Dialog.Description>
                  <div
                    className="flex flex-wrap gap-2"
                    role="group"
                    aria-label="Picture source"
                  >
                    <button
                      type="button"
                      aria-pressed={tab === "library"}
                      className={tabClass(tab === "library")}
                      onClick={() => {
                        setTab("library");
                        void load(q, 1);
                      }}
                    >
                      Media library
                    </button>
                    {mode !== "disabled" ? (
                      <button
                        type="button"
                        aria-pressed={tab === "upload"}
                        className={tabClass(tab === "upload")}
                        onClick={() => setTab("upload")}
                      >
                        Upload new picture
                      </button>
                    ) : null}
                  </div>

                  {tab === "upload" ? (
                    <MediaUploader
                      mode={mode}
                      accept="image"
                      multiple={false}
                      onUploaded={(item) => choose(item.url, item.altTextEn)}
                    />
                  ) : (
                    <>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <div className="min-w-0 flex-1">
                          <Label htmlFor={searchId}>Search pictures</Label>
                          <Input
                            id={searchId}
                            type="search"
                            value={q}
                            maxLength={100}
                            onChange={(e) => setQ(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void load(q, 1);
                              }
                            }}
                            className="mt-1.5"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => void load(q, 1)}
                        >
                          Search
                        </Button>
                      </div>
                      <div aria-live="polite" aria-busy={state === "loading"}>
                        {state === "unauthenticated" ? (
                          <p
                            role="alert"
                            className="text-sm font-medium text-red-800"
                          >
                            Your session has expired. Please sign in again.
                          </p>
                        ) : state === "error" ? (
                          <div
                            role="alert"
                            className="flex flex-wrap items-center gap-3 text-sm text-red-800"
                          >
                            <p className="font-medium">
                              The library could not be loaded.
                            </p>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => void load(q, 1)}
                            >
                              Try again
                            </Button>
                          </div>
                        ) : state === "loading" && items.length === 0 ? (
                          <p className="text-sm text-navy/80">
                            Loading pictures…
                          </p>
                        ) : items.length === 0 ? (
                          <p
                            className="text-sm text-navy/80"
                            data-testid="picker-empty"
                          >
                            {q.trim() !== ""
                              ? "No pictures match your search."
                              : "No pictures in the library yet. Upload one first."}
                          </p>
                        ) : null}
                      </div>
                      {items.length > 0 ? (
                        <ul
                          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
                          aria-label="Pictures"
                        >
                          {items.map((item) => (
                            <li key={item.id}>
                              <button
                                type="button"
                                onClick={() =>
                                  choose(item.url, item.alt, item.altNe)
                                }
                                aria-label={`Use picture: ${item.title}${item.status === "DRAFT" ? " (draft)" : ""}`}
                                className={cn(
                                  "flex w-full cursor-pointer flex-col overflow-hidden rounded-md border text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-dark",
                                  item.url === value
                                    ? "border-navy ring-2 ring-navy"
                                    : "border-beige hover:border-navy/40",
                                )}
                              >
                                <span className="relative block aspect-[4/3] w-full bg-beige">
                                  <SiteImage
                                    src={item.url}
                                    alt=""
                                    fill
                                    sizes="12rem"
                                    className="object-cover"
                                  />
                                </span>
                                <span className="block px-2 py-1.5 text-sm break-words text-navy">
                                  {item.title}
                                  {item.status === "DRAFT" ? (
                                    <span className="block text-xs text-navy/70">
                                      Draft
                                    </span>
                                  ) : null}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {items.length > 0 && page < pageCount ? (
                        <div>
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={state === "loading"}
                            onClick={() => void load(q, page + 1)}
                          >
                            {state === "loading" ? "Loading…" : "Load more"}
                          </Button>
                        </div>
                      ) : null}
                    </>
                  )}
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
            {value !== "" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11"
                aria-label={`Remove picture: ${label}`}
                onClick={() => {
                  setValue("");
                  document.getElementById(id)?.focus();
                }}
              >
                Remove picture
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      {hint ? <Hint id={hintIdFor(name)}>{hint}</Hint> : null}
      <FieldError id={errorIdFor(name)} message={error} />
    </div>
  );
}
