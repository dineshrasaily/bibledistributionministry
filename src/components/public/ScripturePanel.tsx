import type { VerseView } from "@/lib/content";

/**
 * Highlighted list of a post's scripture references. When a published
 * verse with exactly that reference exists, its English (WEB/KJV) text is
 * shown with lang="en". Nepali Bible text is never shown.
 */
export function ScripturePanel({
  refs,
  verses,
  heading,
  note,
}: {
  refs: string[];
  verses: VerseView[];
  heading: string;
  /** Shown on Nepali pages when English verse text is displayed. */
  note?: string;
}) {
  const byRef = new Map(verses.map((v) => [v.reference, v]));
  const anyText = refs.some((r) => byRef.has(r));

  return (
    <aside
      aria-labelledby="scripture-heading"
      data-testid="scripture-panel"
      className="rounded-lg border-l-4 border-gold bg-beige/50 px-5 py-5 sm:px-6"
    >
      <h2
        id="scripture-heading"
        className="mb-3 font-sans text-sm font-semibold tracking-[0.16em] text-navy uppercase"
      >
        {heading}
      </h2>
      <ul className="flex flex-col gap-4">
        {refs.map((ref) => {
          const verse = byRef.get(ref);
          return (
            <li key={ref}>
              {verse ? (
                <figure className="flex flex-col gap-1.5">
                  <blockquote
                    lang="en"
                    className="font-serif text-lg leading-relaxed text-navy italic"
                  >
                    <p>{verse.text}</p>
                  </blockquote>
                  <figcaption className="text-sm font-semibold text-navy">
                    <cite className="not-italic">
                      {verse.reference} ({verse.translation})
                    </cite>
                  </figcaption>
                </figure>
              ) : (
                <p className="font-serif text-lg font-semibold text-navy">
                  {ref}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {note && anyText ? (
        <p className="mt-4 text-sm text-navy/80">{note}</p>
      ) : null}
    </aside>
  );
}
