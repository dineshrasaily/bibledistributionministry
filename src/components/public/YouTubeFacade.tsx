"use client";

import { useEffect, useRef, useState } from "react";

const EMBED_PREFIX = "https://www.youtube-nocookie.com/embed/";

/**
 * Click-to-load YouTube player. Nothing is requested from YouTube (not even
 * a thumbnail) until the visitor presses play; then a youtube-nocookie
 * iframe replaces the button and receives focus.
 */
export function YouTubeFacade({
  embedUrl,
  title,
  thumbnailUrl,
  playLabel,
}: {
  /** Already validated https://www.youtube-nocookie.com/embed/<id>. */
  embedUrl: string;
  title: string;
  /** Safe site/https image (never i.ytimg.com), else a drawn placeholder. */
  thumbnailUrl: string | null;
  /** e.g. "Play video: {title}" already filled in. */
  playLabel: string;
}) {
  const [playing, setPlaying] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (playing) frame.current?.focus();
  }, [playing]);

  // Defence in depth: the mapper already rejects anything else.
  if (!embedUrl.startsWith(EMBED_PREFIX)) return null;

  if (playing) {
    return (
      <div className="relative aspect-video bg-navy-deep">
        <iframe
          ref={frame}
          src={`${embedUrl}?autoplay=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
          className="absolute inset-0 size-full border-0"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="group relative flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden bg-[linear-gradient(135deg,var(--color-navy)_0%,var(--color-navy-deep)_100%)] focus-visible:outline-offset-[-4px]"
    >
      {thumbnailUrl ? (
        // TODO(Phase 7): next/image + Blob
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover opacity-80"
        />
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-3 rounded-sm border border-gold/30"
        />
      )}
      <span
        aria-hidden="true"
        className="relative flex size-16 items-center justify-center rounded-full border border-gold/80 bg-navy/70 text-gold transition-transform group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      >
        <svg viewBox="0 0 24 24" className="ml-1 size-7" fill="currentColor">
          <path d="M8 5.5v13l10.5-6.5z" />
        </svg>
      </span>
      <span className="sr-only">{playLabel}</span>
    </button>
  );
}
