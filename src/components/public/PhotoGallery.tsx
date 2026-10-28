"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState, type KeyboardEvent } from "react";
import { SiteImage } from "@/components/ui/SiteImage";

export type GalleryPhoto = {
  id: string;
  url: string;
  alt: string;
  /** Shown as the dialog title; falls back to the alt text. */
  caption: string | null;
  /** Accessible name of the thumbnail button, e.g. "Open photo: ...". */
  openLabel: string;
  /** Stored pixel size (uploaded pictures), used for the lightbox layout. */
  width?: number | null;
  height?: number | null;
};

export type GalleryLabels = {
  close: string;
  previous: string;
  next: string;
  /** Template with {current} and {total}. */
  counter: string;
  hint: string;
};

const navButton =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-white/60 px-4 text-sm font-medium text-white hover:bg-white/10 focus-visible:outline-gold";

/**
 * Thumbnail grid with an accessible lightbox (Radix Dialog: focus trap,
 * Escape closes, focus returns to the thumbnail that opened it).
 * ArrowLeft / ArrowRight and the buttons cycle with wrap-around.
 */
export function PhotoGallery({
  photos,
  labels,
}: {
  photos: GalleryPhoto[];
  labels: GalleryLabels;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const total = photos.length;
  const current = index === null ? null : photos[index];

  const go = (delta: number) =>
    setIndex((i) => (i === null ? i : (i + delta + total) % total));

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(-1);
    }
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, i) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={(e) => {
                opener.current = e.currentTarget;
                setIndex(i);
              }}
              className="group relative block aspect-[3/2] w-full cursor-pointer overflow-hidden rounded-md border border-beige bg-beige"
              data-testid="gallery-thumb"
            >
              <SiteImage
                src={photo.url}
                alt=""
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
              <span className="sr-only">{photo.openLabel}</span>
            </button>
          </li>
        ))}
      </ul>

      <Dialog.Root
        open={current != null}
        onOpenChange={(open) => {
          if (!open) setIndex(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-navy-deep/[0.97]" />
          <Dialog.Content
            onKeyDown={onKeyDown}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              opener.current?.focus();
            }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 p-4 focus:outline-none sm:p-8"
            data-testid="lightbox"
          >
            {current ? (
              <>
                <div className="flex w-full max-w-5xl items-center justify-between gap-4">
                  <Dialog.Title className="min-w-0 font-serif text-lg font-semibold break-words text-white sm:text-xl">
                    {current.caption ?? current.alt}
                  </Dialog.Title>
                  <Dialog.Close className={navButton}>
                    <span aria-hidden="true">✕</span>
                    {labels.close}
                  </Dialog.Close>
                </div>
                <Dialog.Description className="sr-only">
                  {labels.hint}
                </Dialog.Description>
                {current.width && current.height ? (
                  <SiteImage
                    src={current.url}
                    alt={current.alt}
                    width={current.width}
                    height={current.height}
                    sizes="100vw"
                    loading="eager"
                    className="h-auto max-h-[70dvh] w-auto max-w-full rounded-md object-contain sm:max-h-[80dvh]"
                  />
                ) : (
                  <SiteImage
                    src={current.url}
                    alt={current.alt}
                    loading="eager"
                    className="max-h-[70dvh] w-auto max-w-full rounded-md object-contain sm:max-h-[80dvh]"
                  />
                )}
                <div className="grid w-full max-w-5xl grid-cols-2 items-center gap-3 sm:flex sm:justify-between">
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    className={`${navButton} justify-center`}
                  >
                    <span aria-hidden="true">←</span>
                    {labels.previous}
                  </button>
                  <p
                    aria-live="polite"
                    className="order-first col-span-2 text-center text-sm text-white/85 sm:order-none"
                    data-testid="lightbox-counter"
                  >
                    {labels.counter
                      .replace("{current}", String((index ?? 0) + 1))
                      .replace("{total}", String(total))}
                  </p>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    className={`${navButton} justify-center`}
                  >
                    {labels.next}
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
