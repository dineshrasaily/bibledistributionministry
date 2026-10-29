/**
 * Text normalization for verses extracted from the eBible.org VPL files.
 * Pure module. Only punctuation/whitespace changes, never the words:
 * 1. drop the KJV paragraph mark "¶";
 * 2. unwrap KJV italics (supplied words) "[is]" -> "is";
 * 3. collapse whitespace and trim;
 * 4. (ranges) verses are joined with one space;
 * 5. balance curly double quotes at the edges: a closing ” before any “
 *    gets a “ prepended, an unclosed “ gets a ” appended. Single quotes are
 *    left alone (they double as apostrophes).
 */

/** Characters that must never survive normalization (markup/markers). */
export const FORBIDDEN_CHARS = /[[\]\\<>{}|¶]/;

export function normalizeVerseText(raw: string): string {
  return raw
    .replace(/¶/g, " ")
    .replace(/\[([^\]]*)\]/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function joinVerses(texts: readonly string[]): string {
  return texts
    .map((t) => normalizeVerseText(t))
    .join(" ")
    .trim();
}

export function balanceDoubleQuotes(text: string): string {
  let depth = 0;
  let missingOpen = 0;
  for (const ch of text) {
    if (ch === "“") depth++;
    else if (ch === "”") {
      if (depth === 0) missingOpen++;
      else depth--;
    }
  }
  return "“".repeat(missingOpen) + text + "”".repeat(depth);
}

/** Psalm superscriptions left at the start of verse 1 (after stripping). */
export const PSALM_TITLE_RE =
  /^(A Psalm|A Song|A Prayer|A contemplation|A Michtam|A Maschil|Maschil|Michtam|For the Chief Musician|To the chief Musician|Of David|By David|By the sons|By Solomon|By Asaph|By Moses)/i;

/**
 * Full pipeline for one curated entry (one or more raw verse texts).
 * `stripPrefix` is removed from the normalized first verse and must match
 * exactly (otherwise the source changed and a human must look).
 */
export function normalizeEntry(
  rawVerses: readonly string[],
  stripPrefix?: string,
): string {
  const verses = rawVerses.map((t) => normalizeVerseText(t));
  if (stripPrefix !== undefined) {
    const first = verses[0] ?? "";
    if (!first.startsWith(stripPrefix)) {
      throw new Error(
        `Verse does not start with the expected title "${stripPrefix}": ${first}`,
      );
    }
    verses[0] = first.slice(stripPrefix.length).trim();
  }
  const text = balanceDoubleQuotes(joinVerses(verses));
  if (text === "") throw new Error("Empty verse text");
  if (FORBIDDEN_CHARS.test(text)) {
    throw new Error(`Unexpected marker left in verse text: ${text}`);
  }
  return text;
}
