/**
 * The 66 canonical books: display name, the eBible.org VPL code (BibleWorks
 * style, used by `eng-web_vpl.txt` / `eng-kjv2006_vpl.txt`) and the USFM code
 * (used by the `eng-web_usfm` cross-check). Pure module.
 */

export type Book = { name: string; vpl: string; usfm: string };

export const BOOKS: readonly Book[] = [
  { name: "Genesis", vpl: "GEN", usfm: "GEN" },
  { name: "Exodus", vpl: "EXO", usfm: "EXO" },
  { name: "Leviticus", vpl: "LEV", usfm: "LEV" },
  { name: "Numbers", vpl: "NUM", usfm: "NUM" },
  { name: "Deuteronomy", vpl: "DEU", usfm: "DEU" },
  { name: "Joshua", vpl: "JOS", usfm: "JOS" },
  { name: "Judges", vpl: "JDG", usfm: "JDG" },
  { name: "Ruth", vpl: "RUT", usfm: "RUT" },
  { name: "1 Samuel", vpl: "1SA", usfm: "1SA" },
  { name: "2 Samuel", vpl: "2SA", usfm: "2SA" },
  { name: "1 Kings", vpl: "1KI", usfm: "1KI" },
  { name: "2 Kings", vpl: "2KI", usfm: "2KI" },
  { name: "1 Chronicles", vpl: "1CH", usfm: "1CH" },
  { name: "2 Chronicles", vpl: "2CH", usfm: "2CH" },
  { name: "Ezra", vpl: "EZR", usfm: "EZR" },
  { name: "Nehemiah", vpl: "NEH", usfm: "NEH" },
  { name: "Esther", vpl: "EST", usfm: "EST" },
  { name: "Job", vpl: "JOB", usfm: "JOB" },
  // One psalm is "Psalm 23:1"; the book is "Psalms" (see formatReference).
  { name: "Psalms", vpl: "PSA", usfm: "PSA" },
  { name: "Proverbs", vpl: "PRO", usfm: "PRO" },
  { name: "Ecclesiastes", vpl: "ECC", usfm: "ECC" },
  { name: "Song of Solomon", vpl: "SOL", usfm: "SNG" },
  { name: "Isaiah", vpl: "ISA", usfm: "ISA" },
  { name: "Jeremiah", vpl: "JER", usfm: "JER" },
  { name: "Lamentations", vpl: "LAM", usfm: "LAM" },
  { name: "Ezekiel", vpl: "EZE", usfm: "EZK" },
  { name: "Daniel", vpl: "DAN", usfm: "DAN" },
  { name: "Hosea", vpl: "HOS", usfm: "HOS" },
  { name: "Joel", vpl: "JOE", usfm: "JOL" },
  { name: "Amos", vpl: "AMO", usfm: "AMO" },
  { name: "Obadiah", vpl: "OBA", usfm: "OBA" },
  { name: "Jonah", vpl: "JON", usfm: "JON" },
  { name: "Micah", vpl: "MIC", usfm: "MIC" },
  { name: "Nahum", vpl: "NAH", usfm: "NAM" },
  { name: "Habakkuk", vpl: "HAB", usfm: "HAB" },
  { name: "Zephaniah", vpl: "ZEP", usfm: "ZEP" },
  { name: "Haggai", vpl: "HAG", usfm: "HAG" },
  { name: "Zechariah", vpl: "ZEC", usfm: "ZEC" },
  { name: "Malachi", vpl: "MAL", usfm: "MAL" },
  { name: "Matthew", vpl: "MAT", usfm: "MAT" },
  { name: "Mark", vpl: "MAR", usfm: "MRK" },
  { name: "Luke", vpl: "LUK", usfm: "LUK" },
  { name: "John", vpl: "JOH", usfm: "JHN" },
  { name: "Acts", vpl: "ACT", usfm: "ACT" },
  { name: "Romans", vpl: "ROM", usfm: "ROM" },
  { name: "1 Corinthians", vpl: "1CO", usfm: "1CO" },
  { name: "2 Corinthians", vpl: "2CO", usfm: "2CO" },
  { name: "Galatians", vpl: "GAL", usfm: "GAL" },
  { name: "Ephesians", vpl: "EPH", usfm: "EPH" },
  { name: "Philippians", vpl: "PHI", usfm: "PHP" },
  { name: "Colossians", vpl: "COL", usfm: "COL" },
  { name: "1 Thessalonians", vpl: "1TH", usfm: "1TH" },
  { name: "2 Thessalonians", vpl: "2TH", usfm: "2TH" },
  { name: "1 Timothy", vpl: "1TI", usfm: "1TI" },
  { name: "2 Timothy", vpl: "2TI", usfm: "2TI" },
  { name: "Titus", vpl: "TIT", usfm: "TIT" },
  { name: "Philemon", vpl: "PHM", usfm: "PHM" },
  { name: "Hebrews", vpl: "HEB", usfm: "HEB" },
  { name: "James", vpl: "JAM", usfm: "JAS" },
  { name: "1 Peter", vpl: "1PE", usfm: "1PE" },
  { name: "2 Peter", vpl: "2PE", usfm: "2PE" },
  { name: "1 John", vpl: "1JO", usfm: "1JN" },
  { name: "2 John", vpl: "2JO", usfm: "2JN" },
  { name: "3 John", vpl: "3JO", usfm: "3JN" },
  { name: "Jude", vpl: "JUD", usfm: "JUD" },
  { name: "Revelation", vpl: "REV", usfm: "REV" },
];

const BY_NAME = new Map(BOOKS.map((b) => [b.name, b]));

export type ParsedReference = {
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
};

const REF_RE = /^(.+?) (\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?$/;

/** "1 Corinthians 13:4-7" -> parts. Throws on unknown books or bad ranges. */
export function parseReference(reference: string): ParsedReference {
  const m = REF_RE.exec(reference);
  if (!m) throw new Error(`Bad reference format: "${reference}"`);
  const name = m[1] === "Psalm" ? "Psalms" : m[1]!;
  if (m[1] === "Psalms") {
    throw new Error(`Use "Psalm" for one psalm: "${reference}"`);
  }
  if (!BY_NAME.has(name)) throw new Error(`Unknown book: "${reference}"`);
  const chapter = Number(m[2]);
  const verseStart = Number(m[3]);
  const verseEnd = m[4] === undefined ? verseStart : Number(m[4]);
  if (chapter < 1 || verseStart < 1 || verseEnd <= verseStart - 1) {
    throw new Error(`Bad chapter/verse range: "${reference}"`);
  }
  if (m[4] !== undefined && verseEnd === verseStart) {
    throw new Error(`Range must span two or more verses: "${reference}"`);
  }
  return { book: name, chapter, verseStart, verseEnd };
}

/** Parts -> "John 3:16", "Psalm 23:1", "1 Corinthians 13:4-7". */
export function formatReference(ref: ParsedReference): string {
  const name = ref.book === "Psalms" ? "Psalm" : ref.book;
  const verses =
    ref.verseEnd === ref.verseStart
      ? `${ref.verseStart}`
      : `${ref.verseStart}-${ref.verseEnd}`;
  return `${name} ${ref.chapter}:${verses}`;
}

export function bookByName(name: string): Book {
  const book = BY_NAME.get(name);
  if (!book) throw new Error(`Unknown book: "${name}"`);
  return book;
}
