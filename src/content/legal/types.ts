/**
 * Legal page text (Privacy, Terms). Pure module. `{name}`, `{email}` and
 * (Terms only) `{taxNote}` are filled in by the page.
 */
export type LegalSection = {
  id: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type LegalDocument = {
  /** ISO date (YYYY-MM-DD) shown as "Last updated". */
  lastUpdated: string;
  en: LegalSection[];
  ne: LegalSection[];
};

/** Replaces `{key}` placeholders. */
export function fillLegalText(
  text: string,
  values: Record<string, string>,
): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? values[key]! : match,
  );
}
