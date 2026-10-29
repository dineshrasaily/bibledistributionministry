# Implementation Plan: Automatic Verse of the Day

Work directly on `master` in `c:/Users/rasaily/Downloads/mission app` (quote the path; Windows + PowerShell). No new runtime or dev dependency. Never reset/reseed `mission_dev`; leave `.vscode/settings.json` untracked; never stop the user's dev server (:3000) or Postgres.

## Decisions (with rationale)

- **Sources, all from eBible.org, all verified to exist (HTTP 200) during planning:**
  - WEB: `https://ebible.org/Scriptures/eng-web_vpl.zip` (details: https://ebible.org/find/details.php?id=eng-web). eBible says the World English Bible is in the public domain (not copyrighted); "World English Bible" is an eBible.org trademark, and changed text must not be called WEB. Our normalization only touches whitespace, pilcrows and edge quote marks, so the words stay the same.
  - KJV: `https://ebible.org/Scriptures/eng-kjv2006_vpl.zip` (details: https://ebible.org/find/details.php?id=eng-kjv2006). The KJV (1769 text) is public domain everywhere except the UK, where Crown letters patent apply. Record that caveat.
  - Second sources (cross-check only, never shipped): `https://ebible.org/Scriptures/eng-kjv_vpl.zip` (a separate eBible KJV build) and `https://ebible.org/Scriptures/eng-web_usfm.zip` (the same WEB text in USFM format).
- **WEB edition: standard eBible `eng-web` ("World English Bible Classic", 2020 stable text, American English).** The brief asks for this one. It is the canonical, stable WEB and it uses "Yahweh" in the Old Testament (for example Psalm 23:1 reads "Yahweh is my shepherd"). We do not use the British/"LORD" variants (eng-webbe and others). Document this in the plan, the file header, and an admin hint ("WEB uses the name Yahweh in the Old Testament").
- **Download format: VPL (`*_vpl.txt` inside the zip).** It has one verse per line, `CODE C:V text`, using BibleWorks-style codes (GEN … PSA, PRO, SOL, ISA, JER, EZE, JOE, MAT, MAR, LUK, JOH, ACT, ROM, 1CO, 2CO, GAL, EPH, PHI, COL, 1TH, 2TH, 1TI, 2TI, TIT, PHM, HEB, JAM, 1PE, 2PE, 1JO, 2JO, 3JO, JUD, REV). The KJV file has 66 codes. The WEB file has 81 because it includes the Apocrypha, so only the 66 canonical codes are mapped. What we saw in the source:
  - KJV marks italics with `[...]` brackets and paragraphs with `¶`.
  - WEB has no footnote or Strong's markers in canonical books. Brackets appear only in the Apocrypha (ESG).
  - WEB uses curly quotes, which can be unbalanced across verse boundaries.
- **Unzipping without a dependency:** a small zip reader, `scripts/lib/read-zip-entry.ts`. It parses the central directory and uses `node:zlib.inflateRawSync` for deflated entries (stored entries are read as-is). This is cross-platform, unlike `tar`/`Expand-Archive`.
- **Normalization (generator):**
  1. Drop `¶`.
  2. Unwrap KJV italics `[word]` to `word`.
  3. Collapse whitespace, then trim.
  4. Join the verses of a range with one space.
  5. Balance curly double quotes at the edges: if a `”` appears before any `“`, prepend `“`; if a `“` is left open at the end, append `”`. Single quotes are left alone because they double as apostrophes.
  6. Assert the final text contains none of `[ ] \ < > { } | ¶` and is not empty.
- **Psalm titles:** WEB and KJV both put superscriptions inside verse 1 (for example "A Psalm by David. Yahweh is my shepherd…").
  - A curated entry may declare `stripPrefix: { KJV: "A Psalm of David. ", WEB: "A Psalm by David. " }`. The generator fails if the source text does not start with exactly that string.
  - The generator also fails if any curated Psalm verse 1 still starts with a title pattern (`/^(A Psalm|A Song|For the Chief Musician|To the chief Musician|Maschil|Michtam|A Prayer|Of David)/i`) after the prefix is removed.
- **Curated references:**
  - File: `scripts/daily-verses/references.ts`. The coder writes reference strings only; no text is ever typed by hand.
  - Exactly 366 entries, in day order: index 0 = Jan 1, index 59 = Feb 29, index 365 = Dec 31.
  - Content: well-known, encouraging verses. Each is a single verse or a same-chapter range of at most 3 verses (`1 Corinthians 13:4-7` is the only allowed 4-verse exception, because the brief cites it; it is listed explicitly as an allowed exception).
  - Mix: roughly 30% Psalms, 10% Proverbs, 10% Isaiah plus other prophets, 15% Gospels, 30% Epistles, and the rest from Torah, Joshua, Lamentations, Revelation, and others. Order it so no book appears on two consecutive days more than occasionally (aim for none).
  - Generator failure checks: duplicate references, overlapping verse coverage (for example `Romans 8:28` together with `Romans 8:28-29`), cross-chapter ranges, unknown books, or any missing or empty verse in either translation.
- **Reference format:**
  - `Book C:V` or `Book C:V-W`.
  - Use "Psalm" (singular) for one psalm, and Arabic-numeral book prefixes: "1 Corinthians", "1 John", "Song of Solomon".
  - Store `book`, `chapter`, `verseStart`, `verseEnd`, and `reference`.
- **Data file: `src/content/daily-verses.ts` (generated, committed).**
  - TypeScript rather than JSON so it can carry the required comment header (source URLs, license/PD status, WEB edition, download date, "generated by `npm run verses:build`, do not edit"), and so the pure module needs no JSON import config.
  - Shape: `export const DAILY_VERSES: readonly DailyVerse[] = [...]`, with `type DailyVerse = { reference; book; chapter; verseStart; verseEnd; kjv; web }`. Do not use `as const`, which keeps tsc fast.
  - The generator formats the file through the `prettier` API (already a devDependency), so `format:check` passes.
  - Expected size is about 150–250 KB (limit 500 KB).
- **Cache/temp:** downloads go to `.local/bible-sources/` (already git-ignored by `.local/`). The generator deletes the directory after success unless `--keep-cache` is passed. `--cross-check` downloads the second sources, compares all 366 entries after the same normalization, and prints differences. It only reports; KJV editions legitimately differ in spelling.
- **Non-leap-year rule:** the slot is the calendar month/day in a leap-year calendar. In non-leap years Feb 29 (index 59) is simply skipped, so Mar 1 is always index 60 and Dec 31 always index 365. Every calendar date maps to the same verse every year.
- **Timezone day:**
  - `siteDay(now, tz)` gets the local Y/M/D with `Intl.DateTimeFormat("en-CA", { timeZone, year, month, day }).formatToParts`.
  - It returns `{ y, m, d, iso: "YYYY-MM-DD", utcDate: new Date(Date.UTC(y, m-1, d)) }`. `utcDate` is the key for `BibleVerse.featuredOn` (a `@db.Date`), which from now on means "calendar date in the site time zone". Admin copy changes from "UTC" to the site time zone.
- **Timezone validation:**
  - Node 24's `Intl.supportedValuesOf("timeZone")` returns 418 zones but uses legacy names ("Asia/Katmandu", "Asia/Calcutta") and leaves out "UTC" (checked during planning).
  - `isValidTimeZone(tz)` is true when tz is in that list or in our `COMMON_TIME_ZONES`, and `new Intl.DateTimeFormat("en-US", { timeZone: tz })` does not throw.
  - Stored default: `"America/New_York"`. We store `"Asia/Kathmandu"` (the modern name; Intl accepts it).
- **Timezone select:**
  - Plain `SelectField` (existing component).
  - Common zones first, with friendly labels: America/New_York (Eastern), America/Chicago (Central), America/Denver (Mountain), America/Phoenix (Arizona), America/Los_Angeles (Pacific), America/Anchorage (Alaska), Pacific/Honolulu (Hawaii), Asia/Kathmandu (Nepal), UTC.
  - Then every other `supportedValuesOf` zone alphabetically, excluding duplicates and the aliases `Asia/Katmandu` and `Etc/UTC`.
  - It lives in `src/config/time-zones.ts`, which is pure.
- **Settings fields (one additive migration `verse_of_the_day`):**
  - `autoVerseEnabled Boolean @default(true)`.
  - `autoVerseTranslation BibleTranslation @default(WEB)` reuses the existing enum `WEB | KJV`.
  - `siteTimezone String @default("America/New_York")`.
  - Expected SQL: one `ALTER TABLE "SiteSettings" ADD COLUMN …` per column, all `NOT NULL DEFAULT …`. Nothing else: no DROP, no ALTER TYPE, no data change.
  - The fields go into the existing OWNER-only `settingsSchema` / `updateSiteSettingsAction`. That gives us `runAdminAction` guard + Zod + audit (`changed` field names) + `revalidatePath("/[locale]", "layout")` for free.
- **Selection precedence (`getDailyVerse(now)` in `src/lib/content.ts`):**
  1. A PUBLISHED verse with `featuredOn` = today in the site tz → source `"override"`.
  2. Otherwise, if `autoVerseEnabled` → the curated verse in `autoVerseTranslation` → source `"auto"`, with `isDemo: false` and id `auto-<index>`.
  3. Otherwise → the existing `getFeaturedVerse` fallback (most recent past featured, else newest), computed with the site-tz day → source `"fallback"`.
  
  `getFeaturedVerse(now, timeZone = "UTC")` keeps its default so the existing db tests stay valid.
- **Caching/freshness (Next 16.4.3, no `cacheComponents` in `next.config.ts`):**
  - The home page already has `export const revalidate = 3600` (ISR). Keep it and update the comment to "the site-time-zone verse of the day rolls over within an hour of midnight".
  - Admin saves already call `revalidatePath("/[locale]", "layout")`, so overrides and settings show at once.
  - The devotionals page reads `searchParams`, so it is already rendered per request and needs no change.
  - The page is not made fully dynamic, and no `unstable_cache` is added (`getSiteSettings` is per-request `react.cache`).
  - Freshness is proven by unit/db tests that inject a fixed `now` around midnight in the site tz.
- **Display:**
  - `FeaturedVerse` is unchanged structurally: `VerseBlock` with text and "— Ref (WEB|KJV)".
  - The `DemoBadge` stays only when `verse.isDemo`; auto verses are `isDemo: false`.
  - Change `Home.verseNoteNe` to take `{translation}` in en and ne. en: "A Nepali translation will be added later; the English {translation} text is shown for now." ne: "नेपाली अनुवाद पछि थपिनेछ; हाल अंग्रेजी {translation} पाठ देखाइएको छ।"
  - `textLang="en"` on ne is unchanged.
  - Header, layout and colours are untouched.
- **Admin preview:**
  - Replace `FeaturedToday` in `src/app/admin/(dashboard)/verses/page.tsx` with a read-only "Today's verse" card. It shows:
    - today's date in the site tz plus the tz name;
    - "Override active today" (the override reference + translation, which visitors see) or "No override today";
    - "Automatic verse: <ref> (<translation>)" or "Automatic verse is off (turn it on in Settings)" (link shown only for OWNER);
    - the fallback note when auto is off and there is no override.
  - The list's "today" badge and `FeatureVerseDialog` default date use the site-tz day, passed from the server as a `today` prop.

## Steps

- [ ] 1. **Generator infrastructure + curated references.**
      Add `scripts/lib/read-zip-entry.ts` (minimal zip reader) and `scripts/daily-verses/books.ts`. `books.ts` holds the 66 VPL codes, display names, a parser for "1 Corinthians 13:4-7" (to `{bookCode, chapter, verseStart, verseEnd}`), and a `formatReference` helper.
      Add `scripts/daily-verses/references.ts` with exactly 366 curated entries (optional `stripPrefix`).
      Add `scripts/daily-verses/normalize.ts` with the normalization rules above.
      Add unit tests:
      - `scripts/daily-verses/books.test.ts`: parse/format round-trip, "Psalm" singular, rejects cross-chapter ranges and unknown books.
      - `scripts/daily-verses/normalize.test.ts`: ¶ removal, `[is]` unwrap, quote balancing on the Jer 29:11 / Mat 11:28 shapes, whitespace.
      - `scripts/daily-verses/references.test.ts`: 366 entries, unique, no overlaps, ≤3 verses except the 1 Cor 13:4-7 allow-list, parses all.
      Files: scripts/lib/read-zip-entry.ts, scripts/daily-verses/{books,normalize,references}.ts plus the 3 tests.
      Verify: `npx vitest run --project unit scripts/daily-verses`; the new tests pass. `npm run typecheck`, then `npm run lint` exits 0.

- [ ] 2. **Generator script + generated data file** (depends on 1).
      Add `scripts/build-daily-verses.ts` and the `"verses:build": "tsx scripts/build-daily-verses.ts"` script in package.json. The script:
      1. Downloads both VPL zips to `.local/bible-sources/`.
      2. Extracts `*_vpl.txt`.
      3. Builds a `Map<"CODE C:V", text>`.
      4. Resolves each curated entry for KJV and WEB, then applies `stripPrefix` and normalization. It exits non-zero listing every missing or empty reference.
      5. Writes `src/content/daily-verses.ts` (header comment with source URLs, PD/license text incl. the KJV UK Crown-patent caveat, eng-web "Classic, uses Yahweh" choice, download date, regenerate command), formatted with prettier.
      6. Deletes the cache (`--keep-cache` keeps it). `--cross-check` compares against eng-kjv VPL and eng-web USFM (strip `\f…\f*`, `\x…\x*`, `\w word|…\w*` → word, other `\tag`) and prints differences.
      Run `npm run verses:build -- --cross-check`. Record the cross-check summary in verification.md and explain any KJV spelling diffs. Commit only the script and the data file.
      Files: scripts/build-daily-verses.ts, package.json, src/content/daily-verses.ts.
      Verify: `npm run verses:build` exits 0 and `.local/bible-sources` is gone afterwards. Data file size < 500 KB (`(Get-Item "src/content/daily-verses.ts").Length`). `npm run format:check` exits 0.

- [ ] 3. **Data accuracy tests** (depends on 2).
      Add `src/content/daily-verses.test.ts`. It checks:
      - length 366, unique `reference`, non-empty `kjv`/`web`, no forbidden markers, reference matches the format regex, `chapter`/`verse` fields agree with `reference`, file size < 500 KB via `fs.statSync`.
      - At least 12 exact spot checks (KJV + WEB) for curated entries. Copy each expected string from the downloaded VPL (after normalization) and cross-check it against the second source / ebible.org HTML (e.g. https://ebible.org/eng-web/JHN03.htm).
      Strings seen in the source during planning (re-confirm against the generated file):
      - John 3:16. KJV: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life." WEB: "For God so loved the world, that he gave his only born Son, that whoever believes in him should not perish, but have eternal life."
      - Psalm 23:1 (title stripped). KJV: "The LORD is my shepherd; I shall not want." WEB: "Yahweh is my shepherd; I shall lack nothing."
      - Philippians 4:13. KJV: "I can do all things through Christ which strengtheneth me." WEB: "I can do all things through Christ who strengthens me."
      - Jeremiah 29:11. KJV: "For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end." WEB: "“For I know the thoughts that I think toward you,” says Yahweh, “thoughts of peace, and not of evil, to give you hope and a future.”"
      - Proverbs 3:5. KJV: "Trust in the LORD with all thine heart; and lean not unto thine own understanding."
      - Isaiah 40:31, Romans 8:28, 2 Corinthians 5:17, Matthew 11:28, Psalm 23:4, 1 Corinthians 13:4-7, Joshua 1:9.
      So `references.ts` must include all of these.
      Files: src/content/daily-verses.test.ts.
      Verify: `npx vitest run --project unit src/content/daily-verses.test.ts`; all pass.

- [ ] 4. **Pure selection logic + time zones** (depends on 2; independent of 3).
      Add `src/config/time-zones.ts` (`DEFAULT_SITE_TIME_ZONE`, `COMMON_TIME_ZONES` with labels, `isValidTimeZone`, `timeZoneOptions()`).
      Add `src/lib/verse-of-the-day.ts` with `siteDay`, `dayOfYearIndex(m, d)`, `getVerseOfTheDay(date, timeZone)` (falls back to the default tz when invalid), and `toAutoVerseView(entry, index, translation): VerseView`.
      Use only relative imports in the pure modules (`../content/daily-verses`, `../config/time-zones`, `import type` for `VerseView`) so e2e specs can import them.
      Add tests:
      - `src/lib/verse-of-the-day.test.ts`:
        - `2026-03-10T03:30:00Z` is 23:30 on Mar 9 in America/New_York but Mar 10 in Asia/Kathmandu → indices 68 vs 69 and different verses.
        - Jan 1 → 0, Dec 31 → 365 in both 2027 and 2028.
        - 2028-02-29 → 59; 2027-03-01 and 2028-03-01 → 60; no date in 2027 maps to 59.
        - Determinism (same day, different hours → same verse); next day differs.
        - Invalid tz falls back.
        - KJV/WEB view text and translation, `isDemo === false`.
      - `src/config/time-zones.test.ts`: accepts America/New_York, Asia/Kathmandu, Asia/Katmandu, UTC; rejects "", "Mars/Base", "UTC+5", "<script>". Options start with the common zones, have no duplicates, and include every `supportedValuesOf` zone except the aliases.
      Files: src/config/time-zones.ts, src/lib/verse-of-the-day.ts plus the 2 tests.
      Verify: `npx vitest run --project unit src/lib/verse-of-the-day.test.ts src/config/time-zones.test.ts`; pass. `npm run typecheck` exits 0.

- [ ] 5. **Additive migration + settings defaults** (independent of 1–4).
      Add the 3 fields to `SiteSettings` in `prisma/schema.prisma` (after `offlineGivingNoteNe`, with comments). Run `npm run db:migrate -- --create-only --name verse_of_the_day` (local guard → mission_dev).
      Review `prisma/migrations/<ts>_verse_of_the_day/migration.sql`: it must contain only `ALTER TABLE "SiteSettings" ADD COLUMN … NOT NULL DEFAULT …` lines. Then run `npm run db:migrate` to apply it. Paste the SQL into verification.md.
      Add `autoVerseEnabled: true, autoVerseTranslation: "WEB", siteTimezone: "America/New_York"` to `defaultSiteSettings` in `src/config/site.ts` (`satisfies` forces this). Fix any other compile errors from the new required fields (seed, test factories).
      Files: prisma/schema.prisma, prisma/migrations/*_verse_of_the_day/migration.sql, src/config/site.ts.
      Verify: `npm run typecheck`; `npm test` (db project migrates mission_unit) passes at the baseline. `npm run db:status`; read-only `prisma migrate status` shows up to date.

- [ ] 6. **Validation + settings UI** (depends on 4, 5).
      In `src/lib/validation/settings.ts`, add:
      - `autoVerseEnabled: checkbox()`
      - `autoVerseTranslation: z.enum(["WEB","KJV"]).default("WEB")`
      - `siteTimezone: z.string().trim().refine(isValidTimeZone, TIMEZONE_MSG)`, where `TIMEZONE_MSG = "Choose a time zone from the list."`
      In the settings page, add `<EditorSection title="Verse of the day">` after "Home page". It contains:
      - `CheckboxField autoVerseEnabled` ("Show an automatic verse every day"), with hint: "Each day the home page shows a different well-known verse from a list of 366."
      - `SelectField autoVerseTranslation`: "World English Bible (WEB)" / "King James Version (KJV)", with hint "WEB uses the name Yahweh in the Old Testament; KJV uses LORD."
      - `SelectField siteTimezone` ("Ministry time zone"), using `timeZoneOptions()`, with hint "The verse changes at midnight in this time zone."
      - A `role="note"` box: "A verse you pick for a specific date under Bible Verses always replaces the automatic verse for that day."
      Make sure existing settings e2e/db tests that post the form still pass. Those that build FormData by hand must include `siteTimezone`, or treat an absent value as the default: use `.optional().default(DEFAULT_SITE_TIME_ZONE)` before the refine, so partial posts keep working.
      Add `src/lib/validation/settings-verse.test.ts`, following `settings-offline.test.ts`: defaults, KJV accepted, "Mars/Base" rejected with TIMEZONE_MSG, checkbox off → false.
      In `src/server/actions/actions.db.test.ts` (or the closest settings db test) add: OWNER save persists the 3 fields and the audit `changed` lists them; EDITOR call is rejected (forbidden) and the row is unchanged.
      Files: src/lib/validation/settings.ts, src/app/admin/(dashboard)/settings/page.tsx, the new/extended tests.
      Verify: `npx vitest run src/lib/validation src/server/actions`; pass.

- [ ] 7. **Data access + public pages** (depends on 4, 6).
      In `src/lib/content.ts`, add `getDailyVerse(now = new Date()): Promise<{ verse: VerseView; source: "override"|"auto"|"fallback" } | null>`, using `getSiteSettings()` from `./site-settings` and the precedence above. Give `getFeaturedVerse` an optional `timeZone` parameter (default "UTC").
      Use `getDailyVerse()` in `src/app/[locale]/page.tsx` and `src/app/[locale]/devotionals/page.tsx`, and update the revalidate comment.
      In `FeaturedVerse`, pass `t("verseNoteNe", { translation: verse.translation })`. Update `messages/en.json` and `messages/ne.json` with the `{translation}` placeholder. Grep other `verseNoteNe` users and pass the param there too.
      Add db tests in `src/lib/content.db.test.ts`, all with a fixed `now` and settings rows set and restored per test:
      - Override for today in the site tz wins, including when the UTC date differs. For example `now = 2026-03-10T03:30Z`, tz New York, override on 2026-03-09 → override.
      - No override → auto verse in WEB, and the index matches `getVerseOfTheDay`.
      - KJV setting → KJV text.
      - A past-dated featured verse does not beat the auto verse.
      - Disabled → existing fallback (most recent past featured verse).
      - Midnight rollover: 23:59 vs 00:01 in New York gives different auto verses.
      Update `e2e/routing.spec.ts:38-40`. The home no longer shows the past-featured "Isaiah 6:8 (WEB)". Instead assert the `cite` in `section[aria-labelledby="verse-heading"]` equals the expected auto reference + " (WEB)", computed via `getVerseOfTheDay(new Date(), "America/New_York")` imported relatively from `../src/lib/verse-of-the-day`.
      Files: src/lib/content.ts, src/app/[locale]/page.tsx, src/app/[locale]/devotionals/page.tsx, src/components/home/FeaturedVerse.tsx, messages/en.json, messages/ne.json, src/lib/content.db.test.ts, e2e/routing.spec.ts.
      Verify: `npm test` passes (including `src/lib/messages.test.ts` placeholder parity). `npm run build` exits 0 and still lists `/[locale]` with `revalidate 1h` in the route table.

- [ ] 8. **Admin Bible Verses preview** (depends on 7).
      In `src/server/services/verses.ts`, add `siteToday()` (reads settings tz, returns `siteDay`), make `getVerseFeaturedOn` default to the site-tz day, and keep `utcDay` for compatibility.
      Replace `FeaturedToday` with the "Today's verse" card described above. Use `data-testid="today-verse-preview"`, gold-dark small text, and the existing card classes.
      Switch the list's `today` to the site-tz ISO day. Give `FeatureVerseDialog` a `today` prop (site tz) instead of computing a UTC date client-side, and change its copy from "(UTC)" to "(<tz>)".
      Update any unit/e2e text assertions on "Verse of the day (today, UTC)".
      Files: src/server/services/verses.ts, src/app/admin/(dashboard)/verses/page.tsx, src/components/admin/FeatureVerseDialog.tsx, plus affected tests.
      Verify: `npm run typecheck`, `npm test` pass. Manually load http://localhost:3000/admin/verses only if the user's dev server is running; otherwise rely on the e2e in step 9.

- [ ] 9. **E2E + screenshots** (depends on 6–8).
      Add `e2e/verse-of-day.spec.ts` to the `admin-mutations` project list in `playwright.config.ts`. It uses OWNER_STATE, restores all changes in `finally` blocks like `e2e/admin-settings.spec.ts`, and covers:
      1. `/en` verse section shows the expected auto reference + "(WEB)" and has no demo badge inside the section.
      2. Owner creates a published verse, uses "Feature on…" with today (site tz) → home shows that verse. In `finally`, clear the feature and delete the verse.
      3. Settings → translation KJV → home cite ends with "(KJV)". In `finally`, restore WEB.
      4. `/ne` shows `blockquote[lang="en"]` and the note containing "WEB".
      5. EDITOR_STATE: `/admin/settings` is forbidden and the "Verse of the day" section is absent. The server-side rejection is covered by the step 6 db test, and the existing admin-access test checks the forbidden page.
      6. axe (helpers/axe.ts) on `/en` and `/admin/settings`: no serious or critical violations.
      Add `e2e/verse-of-day-screenshots.spec.ts` (mutations project, pattern from `e2e/zelle-bank-screenshots.spec.ts`). It saves to `.agents/screenshots/verse-of-day/`: home verse section en+ne at 375 and 1280, the admin Settings "Verse of the day" section at 1280, and the Bible Verses preview at 1280.
      Open every image and confirm: no overflow, header unchanged, gold-dark small text.
      Files: e2e/verse-of-day.spec.ts, e2e/verse-of-day-screenshots.spec.ts, playwright.config.ts.
      Verify: `npm run test:e2e` passes (baseline 407 + new). Note that a run crossing midnight in New York can flake on the expected reference.

- [ ] 10. **Full verification + commit.**
      Run, in order: `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build`, `npm test` (≥1045 + new), `npm run test:e2e` (≥407 + new). Record outputs, counts, the migration SQL, the cross-check summary and the data file size in `.agents/tasks/verse-of-day/verification.md`.
      Run a read-only check against mission_dev (for example a `tsx` one-liner, or `psql` through the local URL, with SELECT only) that the OWNER account exists and `SiteSettings.ministryName = 'Bible Distribution Ministry'`.
      Stage the specific files and commit `feat(verses): automatic verse of the day with KJV/WEB and site time zone`.
      Verify: `git status --short` shows only `?? .vscode/settings.json`; `git show --stat HEAD` contains no zip/VPL files.

## Known gaps / assumptions
- `featuredOn` semantics move from a UTC date to a site-tz calendar date. Existing rows keep their date values; only the meaning of "today" changes, with no data migration.
- The KJV text ships without the KJV italics brackets; the words are unchanged.
- E2E settings changes rely on the existing `revalidatePath` in `runAdminAction`. No extra cache tag is needed.
