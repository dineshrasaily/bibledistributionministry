# Automatic verse of the day from a curated public-domain list

The home and Devotionals pages now show a different well-known verse every day without the owner doing anything. A committed generator (`npm run verses:build`) downloads the eBible.org `eng-web` and `eng-kjv2006` VPL zips into the git-ignored `.local/bible-sources/` folder, pulls out 366 curated references, strips markers and psalm titles, and writes a 146 KB data file. That file's header records the source URLs, the public-domain status and the UK Crown caveat for KJV. A pure `getVerseOfTheDay(date, timeZone)` picks the verse by leap-year day slot in the configured time zone. `getDailyVerse` puts a published verse featured on today's date first, then the automatic verse when it is turned on, then the old fallback. Three additive `SiteSettings` columns hold the settings, and only the OWNER can edit them in a new Settings section.

Watch for: the E2E expected reference is computed with `new Date()` in the test process, so a run that crosses midnight in New York can flake (likely, and the coder already notes it). `getVerseFeaturedOn` and `utcDay` are now dead code, and `getVerseFeaturedOn` skips the PUBLISHED filter that the live paths use (confirmed, not blocking).

**Verdict**: APPROVED

## High-level view

The verse text is generated, not typed. The generator stops with an error when a reference is missing or empty, when a strip prefix does not match, when a psalm title is left in, and on duplicates, overlaps or a range longer than 3 verses. The coder's cross-check against a second eBible KJV file and the WEB USFM edition matched 366/366 for both. I re-ran `src/content/daily-verses.test.ts`, and all 18 tests passed, including 13 exact KJV + WEB spot checks with KJV John 3:16. I also read the other Psalm verse-1 entries and a sample of day slots: the KJV says "LORD", the WEB says "Yahweh", and no superscriptions are left.

The day is picked by calendar date in `siteTimezone`, using leap-year slots, and non-leap years skip slot 59. `featuredOn` now means a calendar date in the site time zone instead of a UTC date. The admin dialog and editor hint say so, and existing rows keep their dates. The home page keeps `revalidate = 3600` ISR, so the verse changes within an hour of local midnight, and admin saves revalidate the `/[locale]` layout.

The OWNER-only Settings section validates the time zone against `Intl.supportedValuesOf('timeZone')` plus a short list of common zones (US zones, Kathmandu, UTC) shown first. The DB tests cover the audit entry and the EDITOR rejection. The Bible verses admin page now has a read-only "Today's verse" card that shows the date, the zone, whether an override is active, and the automatic reference and translation. The screenshots show the existing design system and an unchanged header. On Nepali pages the English verse is marked `lang="en"` and the note names the translation.

<details>
<summary>Issues (3)</summary>

1. **E2E midnight flake** (minor, `e2e/verse-of-day.spec.ts`, `e2e/routing.spec.ts`): the expected reference is computed from the test process's clock, so a run that crosses midnight in New York can fail. A possible fix is to retry the assertion once with the reference for the next day.
2. **Dead verse helpers** (nit, `src/server/services/verses.ts`): nothing calls `utcDay` or `getVerseFeaturedOn` anymore. `getVerseFeaturedOn` also leaves out `status: "PUBLISHED"`. Remove both, or add the status filter.
3. **Partial-sentence verse slices** (nit, `scripts/daily-verses/references.ts`): a few entries start in lowercase or end mid-sentence, for example WEB "2 Corinthians 4:8-9" ends with ";" and WEB "Proverbs 24:16" starts with "for". The text matches the source, but on the home page it looks cut off. Consider widening or replacing those references.

</details>

<details><summary>Details</summary>

### Generator and data accuracy

`scripts/build-daily-verses.ts` reads the VPL lines from the zips with a small `node:zlib` reader, so no runtime dependency was added and `package-lock.json` is unchanged. `resolveAll` collects an error for every reference whose text is missing or empty in either translation, and `main` exits 1 if there are any errors. `.local/` is git-ignored (`.gitignore:25`). Only the 146 KB TS file is committed, and the tests check it stays under 500 KB.

The references use the right formats: "Psalm 23:1" is singular, and ranges look like "1 Corinthians 13:4-7". The tests check the structured fields against the reference string. Spot-check plausibility: KJV Genesis 1:1 "heaven", WEB "heavens"; Exodus 15:2 WEB "Yah is my strength"; Matthew 28:19-20 keeps the closing "Amen."; Psalm 23:1, 27:1, 91:1-2 and 121:1-2 start with the verse text, not the title. The psalm-title test only checks a few title openings ("A Psalm", "To the chief", "By David"). The generator's `PSALM_TITLE_RE` is the actual safeguard, and the Psalm verse-1 entries I listed are clean. Some slices are faithful to the source but do not start or end a sentence (issue 3).

### Selection, precedence and caching

```
getDailyVerse(now)
  settings.siteTimezone -> siteDay(now) -> utcDate key
  1. BibleVerse PUBLISHED, featuredOn == utcDate  -> override
  2. autoVerseEnabled -> DAILY_VERSES[slot] in autoVerseTranslation (isDemo:false)
  3. getFeaturedVerse(now, tz)  (old behaviour)
```

The DB tests use a fixed `now`. They cover an override chosen by the site-zone date when the UTC date differs, Kathmandu choosing a different override, draft or past-featured verses not beating the automatic verse, the disabled fallback, and New York rollover. The unit tests cover 23:30 New York vs the next day in Kathmandu, Dec 31/Jan 1 in 2027 and 2028, and Feb 29. ISR is stale-while-revalidate, so the first request after the hour can still get yesterday's page while the new one is regenerated. That fits the "≤1h" requirement. Devotionals was already rendered per request.

The E2E specs can't fix the server's clock, so they compute the expected reference from the wall clock (issue 1).

### Settings, permissions and admin preview

The migration only adds three `NOT NULL DEFAULT` columns and reuses the `BibleTranslation` enum. The verification note shows a read-only check of mission_dev: one active owner, "Bible Distribution Ministry", and the new defaults. The Zod schema defaults the translation and zone when they are absent. Only the full Settings form posts to `updateSiteSettingsAction`, so a partial post can't reset these fields. Both e2e and the DB tests cover EDITOR rejection on the server. The preview card shows "Override active today" next to the automatic reference, and it links to Settings only for the OWNER.

### Screenshots

I opened all ten. Home en/ne at 1280 and 375 show the gold eyebrow, the italic serif verse and "— Psalm 121:7-8 (WEB)", with no demo badge on the verse. The Nepali note wraps one word at 375, which is normal wrapping. The header (logo, nav, language switch, Support pill, mobile menu button) is unchanged. The admin Settings crop and the Bible verses card match the existing card styles, and nothing overflows.

</details>

<details>
<summary>File map</summary>

- `scripts/build-daily-verses.ts`, `scripts/daily-verses/*`, `scripts/lib/read-zip-entry.ts`: generator, curated references, normalization, day order, zip reader, plus their tests
- `src/content/daily-verses.ts` (+ test): generated 366-verse data file and accuracy tests
- `src/lib/verse-of-the-day.ts` (+ test): pure day-slot selection and auto VerseView
- `src/config/time-zones.ts` (+ test): zone list and validation
- `src/lib/content.ts`, `src/server/services/verses.ts`: `getDailyVerse`, site-zone `featuredOn`, admin preview
- `src/lib/validation/settings.ts`, `src/config/site.ts`, `prisma/schema.prisma`, migration: three new settings
- `src/app/admin/(dashboard)/settings/page.tsx`, `verses/page.tsx`, `FeatureVerseDialog.tsx`, `VerseEditor.tsx`: admin UI and copy
- `src/app/[locale]/page.tsx`, `devotionals/page.tsx`, `FeaturedVerse.tsx`, `messages/*.json`: public rendering and the `{translation}` note
- `e2e/verse-of-day*.spec.ts`, `e2e/helpers/verse-of-day.ts`, `e2e/routing.spec.ts`, `playwright.config.ts`: E2E and screenshots
- Full diff: `git -C "c:/Users/rasaily/Downloads/mission app" diff` plus the untracked files

</details>
