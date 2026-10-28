"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SiteImage } from "@/components/ui/SiteImage";
import { addGalleryItemsAction } from "@/server/actions/galleries";
import type { LibraryPicture } from "./MediaPickerField";
import { useToast } from "./ToastProvider";

/** "Add pictures from library": multi-select grid -> addGalleryItemsAction. */
export function GalleryAddPictures({
  galleryId,
  currentIds,
}: {
  galleryId: string;
  currentIds: string[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<LibraryPicture[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const all: LibraryPicture[] = [];
      for (let page = 1; page <= 5; page++) {
        const res = await fetch(
          `/api/admin/media/library?kind=image&page=${page}`,
          {
            cache: "no-store",
          },
        );
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as {
          items: LibraryPicture[];
          pageCount: number;
        };
        all.push(...body.items);
        if (page >= body.pageCount) break;
      }
      setItems(
        all.filter(
          (i) => !currentIds.includes(i.id) && (i.alt ?? "").trim() !== "",
        ),
      );
      setState("idle");
    } catch {
      setState("error");
    }
  }, [currentIds]);

  async function add() {
    setSaving(true);
    setError(null);
    const form = new FormData();
    form.set("galleryId", galleryId);
    for (const id of selected) form.append("mediaIds", id);
    const result = await addGalleryItemsAction(null, form);
    setSaving(false);
    if (result.ok) {
      toast.show(result.message);
      setOpen(false);
      router.refresh();
    } else if (result.code === "UNAUTHENTICATED") {
      router.push("/admin/login");
    } else {
      setError(result.formError ?? "Something went wrong.");
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setSelected(new Set());
          setError(null);
          void load();
        }
      }}
    >
      <Dialog.Trigger asChild>
        <Button type="button" variant="secondary">
          Add pictures from library
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-navy/40" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[min(90dvh,48rem)] w-[min(56rem,calc(100%-1.5rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg border border-beige bg-white p-4 shadow-2xl focus:outline-none sm:p-6"
          data-testid="gallery-add-dialog"
        >
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="font-serif text-xl font-semibold text-navy">
              Add pictures to this gallery
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
            Only pictures with a description are listed. A picture can be in one
            gallery; choosing one from another gallery moves it here.
          </Dialog.Description>
          <div aria-live="polite">
            {state === "loading" ? (
              <p className="text-sm text-navy/80">Loading pictures…</p>
            ) : state === "error" ? (
              <p role="alert" className="text-sm font-medium text-red-800">
                The library could not be loaded. Close and try again.
              </p>
            ) : items.length === 0 ? (
              <p className="text-sm text-navy/80">
                No other pictures in the library. Upload new ones instead.
              </p>
            ) : null}
          </div>
          {items.length > 0 ? (
            <fieldset>
              <legend className="sr-only">Pictures</legend>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {items.map((item) => {
                  const id = `add-${item.id}`;
                  const checked = selected.has(item.id);
                  return (
                    <li key={item.id}>
                      <label
                        htmlFor={id}
                        className={`flex cursor-pointer flex-col overflow-hidden rounded-md border ${checked ? "border-navy ring-2 ring-navy" : "border-beige"}`}
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
                        <span className="flex items-start gap-2 px-2 py-1.5 text-sm text-navy">
                          <input
                            id={id}
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(item.id);
                                else next.delete(item.id);
                                return next;
                              })
                            }
                            className="mt-0.5 size-5 shrink-0 accent-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-dark"
                          />
                          <span className="break-words">{item.title}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm font-medium text-red-800">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={add}
              disabled={selected.size === 0 || saving}
            >
              {saving
                ? "Adding…"
                : selected.size > 0
                  ? `Add ${selected.size} selected`
                  : "Add selected"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
