# Verification: Automatic Verse of the Day (iteration 1)

This is the first iteration (there was no review.json). Work is on `master`, uncommitted, as the step brief asks; a later step commits.
Environment: Windows, PowerShell, Node 24.22.1. Local Postgres is embedded on 127.0.0.1:54329. No dev server was running on :3000 when I resumed, and I did not start or stop one.

## Results

| Command | Exit | Result |
|---|---|---|
| `npm run lint` | 0 | clean |
| `npm run typecheck` | 0 | clean |
| `npm run format:check` | 0 | "All matched files use Prettier code style!" |
| `npm run build` | 0 | `/[locale]` → `/en`, `/ne` ● ISR **Revalidate 1h**; `/[locale]/devotionals` is ƒ (dynamic, it reads searchParams) |
| `npm test` | 0 | **107 files, 1116 tests passed** (baseline 1045, so 71 new) |
| `npm run test:e2e` | 0 | **416 passed** in 9.6 min (baseline 407, so 9 new) |
| `npm run verses:build` (final, no cache) | 0 | Downloaded both zips and wrote 366 verses, byte-identical to the committed file (same SHA-256). Deleted `.local/bible-sources`. |
| `npm run verses:build -- --cross-check --keep-cache` | 0 | `KJV identical 366/366 (eng-kjv VPL), WEB identical 366/366 (eng-web USFM)` |

E2E history: the first full run after the overnight restart had 411 passed, 1 failed and 4 did not run. The failing test was the override test, and the cause was in my spec: the admin form labels read "Reference (required)", so `getByLabel("Reference", {exact:true})` timed out. I changed it to `getByLabel(/^Reference/)` and re-ran the whole suite: 416/416 passed.

`.agents/tasks/phase9/perf.json` is rewritten by the existing `phase9-public-sweep` spec on every e2e run, so I restored it with `git checkout`. It is not part of this change.

## New tests
- Unit, `scripts/daily-verses/{books,normalize,references}.test.ts`:
  - reference parse/format round trip, singular "Psalm", and rejection of cross-chapter, backwards and unknown references;
  - removal of ¶ and KJV italics brackets, quote balancing (Jeremiah 29:11 and Matthew 11:28 shapes), and exact psalm-title stripping;
  - 366 unique entries with no overlaps and at most 3 verses each (1 Cor 13:4-7 is the one allow-listed exception);
  - day order that never puts the same book on consecutive days and is deterministic.
- Unit, `src/content/daily-verses.test.ts`:
  - 366 unique references, each with non-empty KJV and WEB text;
  - no markers (`[ ] \ < > { } | ¶`, Strong's numbers, double spaces);
  - structured fields that match the reference;
  - no psalm titles left in the text;
  - file size under 500 KB;
  - **13 exact KJV + WEB spot checks**: John 3:16, Psalm 23:1, Psalm 23:4, Philippians 4:13, Jeremiah 29:11, Proverbs 3:5, Isaiah 40:31, Romans 8:28, 2 Corinthians 5:17, Matthew 11:28, 1 Corinthians 13:4-7, Joshua 1:9, Psalm 46:1.
- Unit, `src/lib/verse-of-the-day.test.ts`:
  - `2026-03-10T03:30Z` falls on Mar 9 in New York (index 68) but Mar 10 in Kathmandu (index 69), giving different verses;
  - Jan 1 → 0 and Dec 31 → 365 in both 2027 and 2028;
  - 2028-02-29 → 59, Mar 1 → 60 in both years, and no 2027 date maps to 59;
  - 366 distinct verses across a leap year;
  - the same verse all day, changing at local midnight;
  - an invalid time zone falls back to the default;
  - KJV and WEB views, with `isDemo: false`.
- Unit, `src/config/time-zones.test.ts`:
  - accepts New York, Kathmandu, Katmandu and UTC;
  - rejects `""`, `Mars/Base`, `UTC+5`, `<script>`, null and 42;
  - the option list puts common zones first, has no duplicates, and includes every supported zone except the hidden aliases.
- Unit, `src/lib/validation/settings-verse.test.ts`: defaults on a partial post, KJV and a trimmed zone accepted, NIV rejected, bad zones rejected with "Choose a time zone from the list."
- DB, `src/lib/content.db.test.ts` (`getDailyVerse`, all with a fixed `now`):
  - default is the WEB auto verse, not demo;
  - the KJV setting shows KJV text;
  - an override on the site-tz date wins even when the UTC date differs, and switching the zone to Kathmandu changes which override applies;
  - a draft or past featured verse does not beat the auto verse;
  - when disabled, the fallback is the latest past featured verse, or null if there is none;
  - New York rollover between 23:59 and 00:01, and UTC versus New York at the same instant.
- DB, `src/server/actions/actions.db.test.ts`:
  - an OWNER save persists the 3 fields, writes a `settings.update` audit whose `changed` contains them, and revalidates `/[locale]` layout;
  - a bad zone is a field error and nothing is saved or audited;
  - an **EDITOR gets FORBIDDEN server-side**, the row is unchanged and there is no audit.
- E2E, `e2e/verse-of-day.spec.ts` (in admin-mutations; every change is restored in `finally`):
  1. `/en` shows the expected auto reference with "(WEB)", the exact WEB text, and no `[data-demo-badge]`. The admin preview matches.
  2. The owner creates a published verse featured today (site tz). The home page shows it, and the preview says "Override active today". In `finally` the verse is deleted.
  3. Settings → KJV changes the suffix to "(KJV)" and shows the KJV text, and `/ne` mentions KJV. In `finally` it is restored to WEB.
  4. Auto turned off falls back to "Isaiah 6:8 (WEB)", and the preview says it is off. Restored afterwards.
  5. `/ne` has `blockquote[lang="en"]` with the WEB text, the note "अंग्रेजी WEB पाठ", and no demo badge.
  6. axe: 0 serious/critical violations on `/en`, `/ne`, `/admin/settings` and `/admin/verses`.
  7. **EDITOR server-side:** the owner's real Settings server-action POST (with KJV) is captured and aborted, then replayed with the editor's cookies. The response contains `FORBIDDEN`, the editor's `/admin/settings` redirects to `/admin/forbidden`, and the setting is still WEB.
  8. The section heading is the localized eyebrow.
- `e2e/routing.spec.ts`: the old "Isaiah 6:8 (WEB)" home assertion became `cite` = `getVerseOfTheDay(now, "America/New_York")` + " (WEB)".

## Migration (mission_dev, additive only)
`prisma migrate status` reported up to date before I started. I created the migration with `npm run db:migrate -- --create-only --name verse_of_the_day`, reviewed it, then applied it with `npm run db:migrate`. Prisma proposed no reset.
`prisma/migrations/20261029011436_verse_of_the_day/migration.sql`:
```sql
-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "autoVerseEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoVerseTranslation" "BibleTranslation" NOT NULL DEFAULT 'WEB',
ADD COLUMN     "siteTimezone" TEXT NOT NULL DEFAULT 'America/New_York';
```
It reuses the existing `BibleTranslation` enum, so there is no CREATE TYPE.

**Read-only check of mission_dev** (pg client with `SET default_transaction_read_only = on`, SELECT only):
`{"activeOwners":1,"settings":{"ministryName":"Bible Distribution Ministry","autoVerseEnabled":true,"autoVerseTranslation":"WEB","siteTimezone":"America/New_York"}}`

## Sources, accuracy and data file
- WEB: https://ebible.org/Scriptures/eng-web_vpl.zip (https://ebible.org/find/details.php?id=eng-web). This is the standard eBible "eng-web" edition, "World English Bible Classic", the 2020 stable text, which uses "Yahweh". The bundled about/copr pages say it is in the public domain, and "World English Bible" is an eBible.org trademark.
- KJV: https://ebible.org/Scriptures/eng-kjv2006_vpl.zip (https://ebible.org/find/details.php?id=eng-kjv2006). It is public domain except in the UK, where Crown letters patent apply. I recorded that caveat in the file header.
- Second sources used only for the cross-check:
  - `eng-kjv_vpl.zip`: 366/366 identical.
  - `eng-web_usfm.zip`, with `\w …|strong…\w*`, `\f…\f*`, `\x…\x*` and markers stripped: 366/366 identical. One early mismatch on Revelation 1:8 came from my USFM marker stripping, not from the data, and was fixed.
- Third check against bible-api.com for the 12 brief spot-check references:
  - **KJV: 12/12 identical.**
  - WEB: 6 identical. The other differences are all bible-api using a different WEB revision, not our extraction: "one and only" vs. our eBible "only born" (John 3:16; ebible.org/eng-web/JHN03.htm confirms "only born"), "shepherd:" vs. "shepherd;", "Christ, who", a capitalised "But", and "kind; love…endures". One request was rate-limited.
- The text is always extracted by `scripts/build-daily-verses.ts` (`npm run verses:build`). I typed none of it. The generator fails if any reference is missing or empty, if a stripPrefix does not match, if a psalm title is left, on duplicates or overlaps, on more than 3 verses, or if the same book lands on consecutive days.
- `src/content/daily-verses.ts`: **146,364 bytes**, 366 entries. Its header records the sources, the PD/license status, the edition choice, the download date and the regenerate command.
- Book mix: 92 Psalms (25%), 31 Proverbs, 25 Isaiah, plus other prophets, Gospels, Acts, 9 Torah/history books, and a broad set of Epistles and Revelation. That is 55 books in total.
- Downloads went only to the git-ignored `.local/bible-sources/`, which has been deleted (`Test-Path` → False). `git check-ignore` confirms `.local/` is ignored. My temporary scratch files in `.local/` were removed.

## Screenshots (`.agents/screenshots/verse-of-day/`, opened and checked)
Files: `home-verse-{en,ne}-{1280,375}.png`, `home-top-{en,ne}-{1280,375}.png`, `admin-settings-verse-1280.png`, `admin-verses-preview-1280.png`.
- Every spec asserts `scrollWidth <= viewport`, so there is no horizontal overflow.
- The header (logo, nav, language switch, Support button) is unchanged.
- The verse section: gold-dark eyebrow, navy italic serif text, "— Psalm 121:7-8 (WEB)", no demo badge. On ne, the small note sits under the citation.
- The admin Settings section and the Bible verses "Today's verse" card match the existing card styles, with gold-dark small headings.
- Minor: at 375px the Nepali note wraps its last word ("छ।") onto a second line. This is normal text wrapping, not overflow.

## Decisions (made without prompting, as instructed)
- **Day order:** the curated list in `scripts/daily-verses/references.ts` is grouped by book. `order.ts` spreads it evenly across the year (with a golden-ratio phase per book) and repairs runs, so no book appears on consecutive days.
- **Non-leap years:** slots follow the leap-year calendar and slot 59 (Feb 29) is skipped, so a calendar date always gets the same verse.
- **`featuredOn` meaning:** it is now the calendar date in the Settings time zone. Admin copy says so: the dialog shows "(America/New_York)", and the VerseEditor hint changed from "UTC date" to the ministry time zone. Existing rows are unchanged. `getFeaturedVerse(now, timeZone = "UTC")` keeps its default, so the old tests still hold.
- **Caching:** the home page keeps `export const revalidate = 3600` (ISR, shown as "1h" in the build table), so the verse rolls over within an hour of local midnight with no redeploy. Admin saves already call `revalidatePath("/[locale]", "layout")`. Devotionals is already per-request. Nothing was made fully dynamic.
- **Validation:**
  - `autoVerseTranslation` and `siteTimezone` default when absent, so older partial posts and tests keep working.
  - Present values are validated: the zone with `isValidTimeZone`, which checks `Intl.supportedValuesOf` or the common list plus a formatter probe.
  - The stored default is "America/New_York". Asia/Kathmandu is stored under its modern name.
- **Nepali note:** `Home.verseNoteNe` now takes `{translation}` in both en and ne. No Nepali Bible text is shown anywhere.
- **Admin preview:** it shows the date and zone, the override state, and the auto verse (or "off", with a Settings link for the OWNER only).
- **Other:** no new dependencies. Zips are read with a small built-in reader, `scripts/lib/read-zip-entry.ts`, based on `node:zlib`.

## Git state
`.vscode/settings.json` is untouched. It is hidden from `git status` by `.git/info/exclude`, which already existed. HEAD is still `cd652b9`, nothing is staged and nothing was committed, as this step requires. Downloaded archives are not in the tree.

## Unresolved
- E2E runs that cross midnight in New York could flake on the expected reference, because the spec computes it with `new Date()`.

## Commit (release step)
- Branch: `master`. Commit: **`f0dda16e3c2b3d424c6056e5eccbe7891a3740a5`**, `feat: automatic verse of the day (KJV/WEB, timezone-aware)`. 43 files, 6480 insertions, 69 deletions. No hook failures, no push or amend.
- Before staging: `.local/bible-sources` was absent (`Test-Path` → False), and `.local/` is ignored (`.gitignore:25`). No archives were staged.
- Data file `src/content/daily-verses.ts`: **146,364 bytes** (under 500 KB).
- `package-lock.json` was not changed. `.gitignore` was not changed. Screenshots are not tracked.
- Final `git status --porcelain -uall`: empty. `--ignored` lists only `!! .vscode/settings.json`, which is excluded by `.git/info/exclude` and left untracked and unstaged.
- Read-only DB check after commit (pg, `default_transaction_read_only = on`, SELECT only; temp script deleted):
  `{"activeOwners":1,"settings":{"ministryName":"Bible Distribution Ministry","autoVerseEnabled":true,"autoVerseTranslation":"WEB","siteTimezone":"America/New_York"}}`
- Note: this appended section leaves `verification.md` modified after the commit.
