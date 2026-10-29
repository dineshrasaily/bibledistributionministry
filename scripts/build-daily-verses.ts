/**
 * Builds src/content/daily-verses.ts (the automatic "verse of the day" list)
 * from public-domain Bible files downloaded from eBible.org.
 *
 *   npm run verses:build                   # download, extract, write, clean up
 *   npm run verses:build -- --cross-check  # also compare with second sources
 *   npm run verses:build -- --keep-cache   # keep .local/bible-sources/
 *
 * Verse text is NEVER typed by hand: it is read from the VPL files below,
 * normalized (whitespace, KJV "¶" and italics brackets, edge quotes), and
 * written to a small committed data file. The downloads go to the git-ignored
 * .local/bible-sources/ directory, which is deleted afterwards.
 *
 * Fails (exit 1) when any curated reference is missing or empty in either
 * translation, when a psalm title is left at the start of a verse, or when
 * the curated list breaks its rules (366 entries, no duplicates/overlaps,
 * at most 3 verses per entry).
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import prettier from "prettier";
import { BOOKS, bookByName, parseReference } from "./daily-verses/books";
import { PSALM_TITLE_RE, normalizeEntry } from "./daily-verses/normalize";
import { consecutiveSameBook, orderForDays } from "./daily-verses/order";
import {
  CURATED_REFERENCES,
  LONG_RANGE_ALLOW_LIST,
  type CuratedReference,
} from "./daily-verses/references";
import { readZipEntry, listZipEntries } from "./lib/read-zip-entry";

const ROOT = process.cwd();
export const CACHE_DIR = path.join(ROOT, ".local", "bible-sources");
const OUTPUT = path.join(ROOT, "src", "content", "daily-verses.ts");

export const SOURCES = {
  WEB: {
    url: "https://ebible.org/Scriptures/eng-web_vpl.zip",
    details: "https://ebible.org/find/details.php?id=eng-web",
    entry: "eng-web_vpl.txt",
  },
  KJV: {
    url: "https://ebible.org/Scriptures/eng-kjv2006_vpl.zip",
    details: "https://ebible.org/find/details.php?id=eng-kjv2006",
    entry: "eng-kjv2006_vpl.txt",
  },
} as const;

/** Second sources, only for `--cross-check` (never shipped). */
const CROSS_CHECK = {
  KJV: {
    url: "https://ebible.org/Scriptures/eng-kjv_vpl.zip",
    entry: "eng-kjv_vpl.txt",
  },
  WEB_USFM: { url: "https://ebible.org/Scriptures/eng-web_usfm.zip" },
} as const;

export const EXPECTED_DAYS = 366;
const MAX_VERSES = 3;

type VerseMap = Map<string, string>;

async function download(url: string): Promise<Buffer> {
  await mkdir(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, path.basename(new URL(url).pathname));
  if (existsSync(file)) return readFile(file);
  console.log(`Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  const data = Buffer.from(await res.arrayBuffer());
  await writeFile(file, data);
  return data;
}

/** "JOH 3:16 For God so loved..." lines -> Map("JOH 3:16" -> text). */
export function parseVpl(text: string): VerseMap {
  const map: VerseMap = new Map();
  for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const m = /^(\w{3}) (\d+):(\d+) (.*)$/.exec(line);
    if (m) map.set(`${m[1]} ${m[2]}:${m[3]}`, m[4]!);
  }
  return map;
}

async function loadVpl(source: { url: string; entry: string }) {
  const zip = await download(source.url);
  const { data } = readZipEntry(zip, (n) => n.endsWith(source.entry));
  return parseVpl(data.toString("utf8"));
}

/** Checks the curated list rules; returns the error messages. */
export function validateCurated(entries: readonly CuratedReference[]) {
  const errors: string[] = [];
  if (entries.length !== EXPECTED_DAYS) {
    errors.push(
      `Expected ${EXPECTED_DAYS} references, found ${entries.length}`,
    );
  }
  const seenRefs = new Set<string>();
  const covered = new Map<string, string>();
  for (const { reference } of entries) {
    let parsed;
    try {
      parsed = parseReference(reference);
    } catch (e) {
      errors.push((e as Error).message);
      continue;
    }
    if (seenRefs.has(reference)) errors.push(`Duplicate: ${reference}`);
    seenRefs.add(reference);
    const count = parsed.verseEnd - parsed.verseStart + 1;
    if (count > MAX_VERSES && !LONG_RANGE_ALLOW_LIST.includes(reference)) {
      errors.push(`More than ${MAX_VERSES} verses: ${reference}`);
    }
    for (let v = parsed.verseStart; v <= parsed.verseEnd; v++) {
      const key = `${parsed.book} ${parsed.chapter}:${v}`;
      const other = covered.get(key);
      if (other && other !== reference) {
        errors.push(`Overlap: ${reference} and ${other}`);
      }
      covered.set(key, reference);
    }
  }
  return errors;
}

type Resolved = {
  reference: string;
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
  kjv: string;
  web: string;
};

function rawVerses(map: VerseMap, entry: CuratedReference): string[] | null {
  const p = parseReference(entry.reference);
  const code = bookByName(p.book).vpl;
  const out: string[] = [];
  for (let v = p.verseStart; v <= p.verseEnd; v++) {
    const text = map.get(`${code} ${p.chapter}:${v}`);
    if (text === undefined || text.trim() === "") return null;
    out.push(text);
  }
  return out;
}

export function resolveAll(
  entries: readonly CuratedReference[],
  sources: { KJV: VerseMap; WEB: VerseMap },
): { resolved: Resolved[]; errors: string[] } {
  const errors: string[] = [];
  const resolved: Resolved[] = [];
  for (const entry of entries) {
    const p = parseReference(entry.reference);
    const texts: Partial<Record<"KJV" | "WEB", string>> = {};
    for (const t of ["KJV", "WEB"] as const) {
      const raw = rawVerses(sources[t], entry);
      if (!raw) {
        errors.push(`${t}: missing or empty ${entry.reference}`);
        continue;
      }
      try {
        const text = normalizeEntry(raw, entry.stripPrefix?.[t]);
        if (p.book === "Psalms" && p.verseStart === 1) {
          if (PSALM_TITLE_RE.test(text)) {
            errors.push(
              `${t}: psalm title left in ${entry.reference}; add stripPrefix`,
            );
          }
        }
        texts[t] = text;
      } catch (e) {
        errors.push(`${t}: ${entry.reference}: ${(e as Error).message}`);
      }
    }
    if (texts.KJV && texts.WEB) {
      resolved.push({
        reference: entry.reference,
        ...p,
        kjv: texts.KJV,
        web: texts.WEB,
      });
    }
  }
  return { resolved, errors };
}

function header(date: string): string {
  return `/**
 * GENERATED by \`npm run verses:build\` (scripts/build-daily-verses.ts).
 * Do not edit by hand: change scripts/daily-verses/references.ts and run the
 * generator again.
 *
 * ${EXPECTED_DAYS} curated, well-known verses, one per day of a leap year (index 0 = Jan 1,
 * 59 = Feb 29, 365 = Dec 31; non-leap years skip index 59). The text was
 * extracted programmatically from these eBible.org downloads on ${date}:
 *
 * - WEB: World English Bible, standard eBible "eng-web" edition ("World
 *   English Bible Classic", 2020 stable text, American English; uses the name
 *   "Yahweh" in the Old Testament).
 *   ${SOURCES.WEB.url}
 *   (${SOURCES.WEB.details})
 *   Public domain (not copyrighted). "World English Bible" is a trademark of
 *   eBible.org; only whitespace and edge quote marks were normalized, the
 *   words are unchanged.
 * - KJV: King James Version (Authorized Version, 1769 standardized text),
 *   eBible "eng-kjv2006".
 *   ${SOURCES.KJV.url}
 *   (${SOURCES.KJV.details})
 *   Public domain, except in the United Kingdom where Crown letters patent
 *   restrict printing. The KJV italics brackets ("[is]") and paragraph marks
 *   ("¶") were removed; the words are unchanged.
 *
 * Psalm superscriptions (titles inside verse 1 in these files) are removed.
 */
`;
}

async function writeDataFile(resolved: Resolved[], date: string) {
  const body = `${header(date)}
export type DailyVerse = {
  reference: string;
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
  kjv: string;
  web: string;
};

export const DAILY_VERSES: readonly DailyVerse[] = ${JSON.stringify(resolved, null, 2)};
`;
  const options = (await prettier.resolveConfig(OUTPUT)) ?? {};
  const formatted = await prettier.format(body, {
    ...options,
    filepath: OUTPUT,
  });
  await writeFile(OUTPUT, formatted, "utf8");
}

// ---------- cross-check (second sources) ----------

const USFM_DROP_LINE =
  /^\\(id|ide|h|toc\d|mt\d?|mte\d?|ms\d?|mr|s\d?|sr|r|d|sp|cl|rem|ip|is\d?|io\d?|iot|imt\d?|sd\d?)\b/;

/** USFM book text -> Map("CODE C:V" -> plain text). */
export function parseUsfm(text: string, vplCode: string): VerseMap {
  const lines = text
    .split(/\r?\n/)
    .filter((l) => !USFM_DROP_LINE.test(l.trim()));
  const joined = lines
    .join(" ")
    .replace(/\\f\s.*?\\f\*/g, "")
    .replace(/\\x\s.*?\\x\*/g, "")
    .replace(/\\\+?w\s([^|\\]*)(?:\|[^\\]*)?\\\+?w\*/g, "$1");
  const map: VerseMap = new Map();
  let chapter = 0;
  const tokens = joined.split(/(\\c\s+\d+|\\v\s+\d+)/);
  let current: string | null = null;
  for (const token of tokens) {
    const c = /^\\c\s+(\d+)$/.exec(token);
    const v = /^\\v\s+(\d+)$/.exec(token);
    if (c) {
      chapter = Number(c[1]);
      current = null;
    } else if (v) {
      current = `${vplCode} ${chapter}:${v[1]}`;
      map.set(current, "");
    } else if (current) {
      // Markers vanish: closing ones ("\wj*") and opening ones together with
      // their one delimiter space ("\wj "); lines were joined with spaces.
      const plain = token
        .replace(/\\\+?[a-z0-9]+\*/gi, "")
        .replace(/\\\+?[a-z0-9]+\s?/gi, "");
      map.set(current, `${map.get(current)} ${plain}`);
    }
  }
  return map;
}

async function crossCheck(resolved: Resolved[]) {
  const kjv = await loadVpl(CROSS_CHECK.KJV);
  const zip = await download(CROSS_CHECK.WEB_USFM.url);
  const web: VerseMap = new Map();
  const entries = listZipEntries(zip);
  for (const book of BOOKS) {
    const entry = entries.find((e) =>
      new RegExp(`^\\d+-${book.usfm}eng-web\\.usfm$`).test(e.name),
    );
    if (!entry) throw new Error(`USFM book missing: ${book.usfm}`);
    for (const [k, t] of parseUsfm(entry.read().toString("utf8"), book.vpl)) {
      web.set(k, t);
    }
  }
  const diffs: string[] = [];
  let kjvSame = 0;
  let webSame = 0;
  for (const r of resolved) {
    const entry = CURATED_REFERENCES.find((c) => c.reference === r.reference)!;
    const kjvRaw = rawVerses(kjv, entry);
    // USFM keeps psalm titles out of the verse (\d), so no prefix to strip.
    const webRaw = rawVerses(web, entry);
    const kjvText = kjvRaw
      ? normalizeEntry(kjvRaw, entry.stripPrefix?.KJV)
      : null;
    const webText = webRaw ? normalizeEntry(webRaw) : null;
    if (kjvText === r.kjv) kjvSame++;
    else
      diffs.push(`KJV ${r.reference}\n  ours:  ${r.kjv}\n  other: ${kjvText}`);
    if (webText === r.web) webSame++;
    else
      diffs.push(`WEB ${r.reference}\n  ours:  ${r.web}\n  other: ${webText}`);
  }
  console.log(
    `Cross-check: KJV identical ${kjvSame}/${resolved.length} (eng-kjv VPL), WEB identical ${webSame}/${resolved.length} (eng-web USFM).`,
  );
  for (const d of diffs) console.log(d);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const errors = validateCurated(CURATED_REFERENCES);
  if (errors.length) {
    for (const e of errors) console.error(`✗ ${e}`);
    process.exit(1);
  }
  const ordered = orderForDays(CURATED_REFERENCES);
  const [WEB, KJV] = await Promise.all([
    loadVpl(SOURCES.WEB),
    loadVpl(SOURCES.KJV),
  ]);
  const { resolved, errors: missing } = resolveAll(ordered, { KJV, WEB });
  const repeats = consecutiveSameBook(resolved);
  for (const i of repeats) {
    missing.push(`Same book on days ${i} and ${i + 1}: ${resolved[i]!.book}`);
  }
  if (missing.length) {
    for (const e of missing) console.error(`✗ ${e}`);
    process.exit(1);
  }
  const date = new Date().toISOString().slice(0, 10);
  await writeDataFile(resolved, date);
  console.log(
    `Wrote ${resolved.length} verses to ${path.relative(ROOT, OUTPUT)}`,
  );

  if (args.has("--cross-check")) await crossCheck(resolved);

  if (args.has("--keep-cache")) {
    console.log(`Kept ${path.relative(ROOT, CACHE_DIR)}`);
  } else {
    await rm(CACHE_DIR, { recursive: true, force: true });
    console.log(`Deleted ${path.relative(ROOT, CACHE_DIR)}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
