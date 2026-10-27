# Phase 3 verification (core public pages)

Run on 2026-10-27, master, working tree uncommitted (the finalize step commits after approval). Windows + PowerShell, Node 24.22.1. Local Postgres was already running (not started by me, left running). The user's `npm run dev` on port 3000 (PID 31116) was not touched.

## Commands and results (final run, in order)

| # | Command | Exit | Result |
|---|---------|------|--------|
| 1 | `npm run lint` | 0 | no warnings/errors |
| 2 | `npm run typecheck` (prisma generate + next typegen + tsc) | 0 | clean |
| 3 | `npm run format:check` (after `npm run format`) | 0 | "All matched files use Prettier code style!" |
| 4 | `npm run build` (reads mission_dev, read-only) | 0 | `/[locale]/devotionals` dynamic (ƒ); `/[locale]/about`, `/media`, `/missions`, `/privacy`, `/terms` static; `/[locale]/devotionals/[slug]` and `/[locale]/missions/[slug]` prerendered via generateStaticParams |
| 5 | `npm test` | 0 | **48 files, 474 tests passed** (baseline 388, +86) |
| 6 | `npm run test:e2e` | 0 | **179 passed, 0 failed, 0 flaky** (baseline 78, +101) |

`npm test` and `npm run test:e2e` were never run at the same time.

### New / extended tests
- Unit: `public-query.test.ts`, `share-links.test.ts`, `sitemap-entries.test.ts`, `donation-wording.test.ts`, `about-mappers.test.ts`, `content/legal/legal.test.ts`, extended `content-mappers.test.ts` (post detail ne->en body fallback, event detail, `toMediaView` rejecting `youtube.com/embed`, short ids and `http:` audio, image alt rules, `groupPhotoGalleries`), extended `validation/admin.test.ts` (About photo alt required, unsafe photo URL, testimony length, media `eventId` / `sortOrder`), rewritten `sitemap.test.ts` (async, `@/lib/content` mocked), `PURE_MODULES` extended. Components (jsdom): `YouTubeFacade`, `PhotoGallery` (open, counter, arrow wrap, Escape + focus return), `CopyLinkButton` (success + failure), `PublicPagination`.
- DB: `content.db.test.ts` (list: all types, drafts excluded, en/ne/body search, type + category filters, 9-per-page + clamping; categories with published posts only; slug reads incl. drafts/unknown/invalid; verses by exact reference; missions split/order, cancelled + draft excluded from lists, cancelled detail resolves; gallery = published images of that event in sortOrder; event delete sets `eventId` null; Media Center grouping, unsafe embed dropped, photos of draft events ungrouped; `getPublishedSlugs` excludes drafts), `seed.db.test.ts` (new counts incl. 9 media / 2 categories / 5 post-category links, gallery links, no seeded YouTube embed, re-seed does not overwrite body or category links), `actions.db.test.ts` (OWNER saves About fields + audit `changed`; photo without alt = field error, no audit; nonexistent `eventId` = VALIDATION field error, no row; valid `eventId` + order persist).
- E2E: `public-pages.spec.ts` (8 pages × en/ne: 200, exactly one visible h1, `<html lang>`; draft/unknown/invalid slugs 404; template notice; About demo fallbacks + DemoBadge; hreflang + canonical + `og:type=article`; sitemap has detail pages and no draft/admin; visitor cookies; home links to detail pages), `devotionals.spec.ts` (search "shepherd" -> 1 card + `q=shepherd`, ne search भजनसंग्रह, type BIBLE_STUDY, category filter + clear, no-match state, invalid params ignored, pagination 9/3 with disabled Previous and `aria-current`, scripture panel with "Isaiah 6:8 (WEB)" text, share hrefs contain the encoded canonical URL, copy link announces "Link copied" and clipboard holds the URL, ne verse note + `lang="en"`, XSS fixture: no script, no `javascript:` link, no `onerror`, `window.__xss` undefined, `strong` visible), `missions.spec.ts` (Upcoming 3 / Completed 1, detail location/date/description/report/3 thumbnails, lightbox 1->2->(←←)3 and Escape returns focus, volunteer info + contact link in ne), `media-center.spec.ts` (zero YouTube requests and zero iframes before click; after "Play video: E2E fixture video" one iframe `https://www.youtube-nocookie.com/embed/aaaaaaaaaaa?autoplay=1`, only nocookie requests, all stubbed; sections, `audio[controls][preload=none]`, placeholders, gallery link; lightbox), axe loop in `a11y.spec.ts` (26 new scans: 8 pages × en/ne @1280, 4 list pages × en/ne @375, lightbox open, video loaded) — all 38 axe scans in the run report serious/critical=0; admin: testimony saved -> shown on /en/about without DemoBadge, ne shows it with `lang="en"`, then restored; photo link without description = field error; IMAGE media linked to "Sample mission trip…" shows in its gallery, then deleted and gone.

### Fixes made during verification
- E2E run 1: `getByLabel("Search")` also matched the `role=search` form -> use `getByRole("searchbox")`; duplicate text from sr-only "Read more: title" -> heading locators; existing `mobile-menu.spec.ts` expects the Missions h1 to equal the nav label -> Missions title is now "Missions" (eyebrow "Where we serve"), the other pages keep their descriptive titles; `NEXT_LOCALE` cookie IS set by next-intl (session cookie) -> privacy text now discloses it and the E2E asserts it is the only visitor cookie and session-only.
- E2E runs 2-4: the admin gallery test raced: `toHaveURL(/\/admin\/media\/[a-z0-9]+$/)` already matched `/admin/media/new`, so the test left before the server action finished. Fixed by excluding `new` and waiting for the "Created." toast. (Debugging confirmed revalidation of the prerendered `[slug]` pages works: first visit after the mutation was a cache MISS with the new photo.)
- Screenshots: lightbox at 375 px had cramped controls and a see-through overlay -> overlay 97% opaque, counter on its own centred row, Previous/Next as two equal buttons.

## Migration
`npx prisma migrate dev --create-only --name phase3_about_fields_media_event` -> `prisma/migrations/20261027014222_phase3_about_fields_media_event/migration.sql`. Reviewed before applying; contains only:
- `ALTER TABLE "MediaItem" ADD COLUMN "eventId" TEXT, ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0`
- `ALTER TABLE "SiteSettings" ADD COLUMN` aboutImageAltEn/Ne, aboutImageUrl, goalsEn/Ne, testimonyEn/Ne (all nullable TEXT)
- `CREATE INDEX "MediaItem_eventId_status_sortOrder_idx"`
- `ADD CONSTRAINT "MediaItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE`

No DROP, no data change. Applied with `npm run db:migrate` (assert-local-db fence + `prisma migrate dev`), exit 0, no drift/reset prompt. `npx prisma migrate status`: "2 migrations found … Database schema is up to date!". mission_dev was NOT seeded or reset.

## mission_dev read-only check (SELECT only, via a temp pg script outside the repo)
| | Before migration | After migration + all runs |
|---|---|---|
| OWNER accounts | 1 (d***@gmail.com) | 1 (same) |
| ministryName | Bible Distribution Ministry | Bible Distribution Ministry |
| logoUrl | /brand/logo-mark.png | /brand/logo-mark.png |
| isDemo | true | true |
| posts / events / media / admins | 6 / 4 / 3 / 1 | 6 / 4 / 3 / 1 |
| migrations | init | init + phase3_about_fields_media_event |

## Hygiene
- `git grep -n -i -E "aws|amazon|\bs3\b|cognito|\bses\b"` (new files included via `git add -N`, then `git reset`): matches only in `.agents/tasks/**` workflow docs, the guard assertion in `src/content/legal/legal.test.ts` (it asserts "no AWS"), a false positive in `src/lib/validation/media.ts` (`z.ZodR**awS**hape`) and the binary `public/brand/logo-full.png`. No real references.
- Secret-pattern scan (`sk_live|sk_test|re_…|BEGIN … PRIVATE|AUTH_SECRET=.+|TOTP_ENCRYPTION_KEY=.+`): only docs/placeholders (README `$env:TOTP_ENCRYPTION_KEY="<exactly the same value as in Vercel>"`). No secrets in the diff.
- `git check-ignore .env` -> `.env`; `git status --short` shows no `.env`. Only intended Phase 3 files are modified/added.
- No dependency changes (package.json untouched).
- Temp files (`%TEMP%` logs and debug scripts, `.agents/tasks/phase3/tmp-debug.ts`) deleted.

## Screenshots (`.agents/screenshots/phase3/`, all opened with read_file)
Every file is produced by `e2e/phase3-screenshots.spec.ts` / `e2e/admin-screenshots.spec.ts`, and each public capture asserts `scrollWidth <= viewport width` (no horizontal overflow). 41 files: `{about,devotionals,devotionals-filtered,devotional-detail,missions,mission-detail,media,privacy,terms}-{en,ne}-{375,1280}.png` (36), `mission-detail-lightbox-en-{375,1280}.png`, `media-video-loaded-en-1280.png`, `admin-settings-about-1280.png`, `admin-media-editor-1280.png`.

Images I opened and checked:
- `about-en-1280.png`: beige hero "Our story and calling" with the tagline; story with the decorative cross panel; testimony/vision/values/faith/goals as dashed "Sample text:" boxes with DemoBadges; navy mission quote band; CTA row. On-brand, header unchanged (logo + name far left, nav centre, gold CTA right).
- `about-ne-375.png`: all Devanagari renders (Noto Sans/Serif Devanagari), no tofu, hamburger header unchanged, no overflow.
- `devotionals-en-1280.png`: featured verse with "Isaiah 6:8 (WEB)", filter card (search, type, category, Apply), "12 results", 3×3 cards with type badge/date/refs/DemoBadge, pagination "← Previous (disabled) 1 2 Next →", "Page 1 of 2".
- `devotional-detail-ne-375.png`: back link, badges, Devanagari h1, category chip, scripture panel (English WEB text + Nepali note), Markdown body with h2s and list, share buttons wrap cleanly.
- `missions-ne-375.png`: Upcoming (3 cards) and Completed (1 card) with date tiles and Devanagari dates.
- `mission-detail-en-1280.png`: When/Where card, About, Trip report, 3-photo gallery, Pray / Back buttons.
- `media-en-1280.png`: Sermons/Worship/Podcasts/Videos/Photo galleries; "Video coming soon" placeholders, the fixture play button, native audio player, gallery grouped "From: Sample past gathering" + "Other photos".
- `mission-detail-lightbox-en-375.png` (after fix): near-opaque navy overlay, caption title + Close, image contained, "Photo 2 of 3" centred, two equal buttons.
- `terms-en-1280.png`: TEMPLATE notice, last updated, contents list, sections; donations reads "Gifts are not tax-deductible." (from `donationTaxNote`, flag off).
- `privacy-ne-375.png`: template notice, 10 sections in Devanagari, bullets, NEXT_LOCALE cookie wording.
- `admin-settings-about-1280.png`: "About page" section with hint, story fields, photo link with image-specific hint, photo description, testimony editor.

## Decisions taken during implementation (beyond plan.md)
- Missions page h1 is "Missions"/"मिसनहरू" (matches the nav label, required by the existing mobile-menu E2E); eyebrow "Where we serve".
- The privacy policy discloses next-intl's session-only `NEXT_LOCALE` cookie (it is set even with `localeDetection: false`); an E2E keeps policy and behaviour in sync.
- `About.photoAltFallback` was not added: an About photo without English alt text is never rendered (mapper drops it, Zod rejects it).
- Demo post-6 also lists "John 3:16" so the Bible study shows a resolved WEB verse in the scripture panel.
- PublicPagination shows page numbers (windowed) in addition to Previous/Next, so `aria-current="page"` is meaningful.

## Known limitations
- Missions lists are capped at 24 each with no pagination; Media Center sections at 12.
- Galleries are MediaItem-based (`eventId` + `sortOrder`) until Phase 7 adds gallery management.
- Images use `<img>` (with `isSafeUrl`) until Phase 7 moves to next/image + Blob.
- No default Open Graph image until Phase 9.
- Privacy/Terms are templates and describe Phase 6/8 features; re-check after those phases and have them reviewed.
- mission_dev's existing demo rows have no bodies, categories, gallery photos or audio unless the user runs `npm run db:seed` (create-only; existing posts are not updated).
- The user must restart `npm run dev` after the migration so the dev server loads the regenerated Prisma client.
