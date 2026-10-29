/**
 * Spreads the curated (book-grouped) list over the 366 days of a leap year.
 * Pure and deterministic: the same input always gives the same order.
 *
 * Each book's entries get evenly spaced target positions ((i + 0.5) / k for
 * entry i of k), so Psalms appear about every third day and small books are
 * scattered across the year. A repair pass then moves entries so that no
 * book appears on two consecutive days.
 */
import { parseReference } from "./books";
import type { CuratedReference } from "./references";

const bookOf = (entry: CuratedReference) =>
  parseReference(entry.reference).book;

export function orderForDays(
  entries: readonly CuratedReference[],
): CuratedReference[] {
  const byBook = new Map<string, CuratedReference[]>();
  for (const entry of entries) {
    const book = bookOf(entry);
    const list = byBook.get(book) ?? [];
    list.push(entry);
    byBook.set(book, list);
  }
  const keyed = [...byBook.values()].flatMap((list, bookIndex) => {
    // A fixed per-book phase (golden ratio) keeps books with one or two
    // entries from all landing on the same days.
    const phase = (bookIndex * 0.618033988749895) % 1;
    return list.map((entry, i) => ({
      entry,
      book: bookOf(entry),
      key: (i + phase) / list.length,
      bookIndex,
      i,
    }));
  });
  keyed.sort((a, b) => a.key - b.key || a.bookIndex - b.bookIndex || a.i - b.i);

  const out = keyed.map((k) => ({ entry: k.entry, book: k.book }));
  for (let p = 1; p < out.length; p++) {
    if (out[p]!.book !== out[p - 1]!.book) continue;
    // Pull the next entry that fits here forward to position p.
    let moved = false;
    for (let q = p + 1; q < out.length; q++) {
      const candidate = out[q]!;
      // After the move, the entry before q's old slot meets out[q + 1].
      const before = q === p + 1 ? out[p]! : out[q - 1]!;
      const gapOk = q + 1 >= out.length || before.book !== out[q + 1]!.book;
      if (candidate.book !== out[p - 1]!.book && gapOk) {
        out.splice(q, 1);
        out.splice(p, 0, candidate);
        moved = true;
        break;
      }
    }
    if (!moved) {
      // Otherwise move out[p] back to the first slot between two other books.
      // (out[p - 1] has the same book, so it then meets out[p + 1].)
      const item = out[p]!;
      const gapOk = p + 1 >= out.length || out[p + 1]!.book !== item.book;
      for (let q = 1; q < p - 1 && gapOk; q++) {
        if (out[q - 1]!.book !== item.book && out[q]!.book !== item.book) {
          out.splice(p, 1);
          out.splice(q, 0, item);
          moved = true;
          break;
        }
      }
    }
    if (!moved) {
      throw new Error(
        `Cannot avoid two consecutive days from ${out[p]!.book}; add verses from other books.`,
      );
    }
  }
  return out.map((o) => o.entry);
}

/** Index pairs (day, day + 1) that share a book; [] when the order is good. */
export function consecutiveSameBook(
  entries: readonly { book: string }[],
): number[] {
  const hits: number[] = [];
  for (let i = 1; i < entries.length; i++) {
    if (entries[i]!.book === entries[i - 1]!.book) hits.push(i - 1);
  }
  return hits;
}
