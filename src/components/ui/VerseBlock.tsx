import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Elegant scripture pull quote. Always shows the reference and the
 * translation, e.g. "Isaiah 6:8 (WEB)".
 */
export function VerseBlock({
  text,
  reference,
  translation,
  note,
  badge,
  textLang,
  className,
}: {
  text: string;
  reference: string;
  translation: string;
  note?: string;
  badge?: ReactNode;
  /** Language of the verse text when it differs from the page language. */
  textLang?: string;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "relative mx-auto flex max-w-3xl flex-col items-center gap-6 text-center",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="font-serif text-7xl leading-none text-gold select-none"
      >
        &ldquo;
      </span>
      <blockquote
        lang={textLang}
        className="-mt-6 font-serif text-2xl leading-relaxed text-navy italic sm:text-3xl sm:leading-relaxed"
      >
        <p>{text}</p>
      </blockquote>
      <span aria-hidden="true" className="gold-rule" />
      <figcaption className="text-base font-medium tracking-wide text-navy">
        <span aria-hidden="true">— </span>
        <cite className="not-italic">
          {reference} ({translation})
        </cite>
      </figcaption>
      {note ? <p className="max-w-xl text-sm text-navy/75">{note}</p> : null}
      {badge}
    </figure>
  );
}
