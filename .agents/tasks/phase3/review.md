# Bilingual About, Devotionals, Missions, Media Center and legal pages (Phase 3)

Phase 3 replaces the placeholder About, Devotionals, Missions, Media, Privacy and Terms pages with real, DB-driven pages in English and Nepali. All filtering happens on the server: Devotionals reads `q`/`type`/`category`/`page` from the URL, and a lenient Zod parser turns them into a paginated Prisma query. New detail routes `/devotionals/[slug]` and `/missions/[slug]` are prerendered from published slugs. They carry per-page OG metadata and hreflang, and they now appear in an async sitemap. Media gets a click-to-load youtube-nocookie facade, native audio and a Radix-based lightbox. One additive migration adds the About fields plus `MediaItem.eventId`/`sortOrder` for mission galleries. The header is untouched, and every sample row is still marked demo.

Watch for: an admin-entered video thumbnail is rendered before the click with no host check, so an `i.ytimg.com` link would contact YouTube before play, which contradicts the new privacy text (confirmed, LOW). Two screenshots have capture artifacts, so a couple of visual states were judged from neighbouring images (confirmed, LOW).

**Verdict**: APPROVED

## High-level view

The data layer follows the existing split. Pure mappers in `content-mappers.ts` / `about-mappers.ts` handle locale fallback and URL safety (`safeUrlOrNull`, `safeEmbedUrl`). `content.ts` adds PUBLISHED-only reads, and the detail getters are wrapped in `cache()` so metadata and the page share one query. Paging and clamping reuse `paginate`, moved into the pure `src/lib/pagination.ts`.

Devotionals is the only dynamic page. It's a plain GET form, so it works without JS, with a `role="status"` result count, page links that keep the filters and set `aria-current`, and separate "nothing published" and "no match" empty states. Its canonical drops the query string. Detail pages render Markdown only through the existing sanitizing `MarkdownContent`. When Nepali text is missing they fall back to English with `lang="en"` and a note. The scripture panel shows only stored English WEB/KJV verse text.

Sharing uses plain links (Facebook sharer, `x.com/intent/post`, `wa.me`, `mailto:`) with `noopener noreferrer`, plus a clipboard button with a polite live region. There are no SDKs or scripts. The YouTube facade renders a button and no iframe until clicked, and re-checks the `youtube-nocookie.com/embed/` prefix. Its one gap is the thumbnail described below.

Mission galleries are the PUBLISHED IMAGE `MediaItem`s linked to an event by the new nullable FK (`ON DELETE SET NULL`), so Phase 7 can build real gallery management later. The admin side gets a guarded "Linked mission/event" select with an existence check that returns a field error. Settings get the About fields, and Zod requires alt text whenever a photo is set.

About shows each empty section as an obviously dashed "Sample text: … will be written here" box with a DemoBadge, but only while `isDemo` is on. When `isDemo` is off, empty sections are hidden. No testimony, doctrine or statistics are invented. Privacy and Terms are typed TS modules with a TEMPLATE notice. Terms takes its tax wording from `donationTaxNote` and currently reads "Gifts are not tax-deductible." The privacy text discloses the `NEXT_LOCALE` session cookie that E2E confirmed.

Evidence is complete. lint, typecheck, format and build all exit 0. Unit+DB tests: 474 (baseline 388). E2E: 179 (baseline 78), including XSS, facade request-interception, lightbox keyboard tests and 26 new axe scans with zero serious/critical violations. The migration is additive only, and mission_dev was checked read-only before and after.

<details>
<summary>Issues (4)</summary>

1. **Pre-click YouTube thumbnail request** (LOW, confirmed): `toMediaSummary` lets any https `thumbnailUrl` through, and `YouTubeFacade`/`FeaturedContent` render it before the click. Reject `ytimg.com`/`youtube.com`/`youtube-nocookie.com`/`ggpht.com` hosts in the mapper, or note the restriction in the admin field hint.
2. **Media anchor missing for featured photos** (LOW, confirmed): home featured cards link to `/media#media-<id>`, but gallery photos render as lightbox thumbnails without that id, so a featured IMAGE item scrolls nowhere. Add `id="media-<id>"` to the thumbnail `<li>`, or link featured photos to their gallery group.
3. **Privacy note missing on Worship videos** (LOW, confirmed): the "nothing loads until you press play" note appears under Sermons and Videos but not Worship, which also holds video embeds. Add the note to the Worship section too.
4. **Screenshot capture artifacts** (LOW, confirmed): in `media-en-375.png` the lazy gallery thumbnails are blank beige, and in `media-video-loaded-en-1280.png` the sticky header is drawn mid-page with an empty band at the top. Scroll before capture (or use eager loading in the screenshot spec) so both states are actually shown.

</details>

<details><summary>Details</summary>

## YouTube facade and the thumbnail hole

The facade does what the brief asks. Before the click it renders a `<button>` with an sr-only "Play video: {title}" and no iframe. After the click it renders `youtube-nocookie.com/embed/<id>?autoplay=1`, moves focus into the iframe, and the E2E test intercepts and counts YouTube requests. `safeEmbedUrl` only accepts a value that `toYouTubeEmbed()` normalises to itself, so a stored `youtube.com/embed/...` is treated as "no video" instead of being loaded.

The gap is the thumbnail (confirmed). `thumbnailUrl` is validated only by `optionalSafeUrl()` / `safeUrlOrNull`, which accept any https host:

```tsx
// YouTubeFacade, pre-click
{thumbnailUrl ? <img src={thumbnailUrl} alt="" loading="lazy" … /> : …}
```

The admin field is a free "Thumbnail image link", and the obvious thing to paste for a YouTube video is `https://i.ytimg.com/vi/<id>/hqdefault.jpg`. Once that happens, every visitor to `/media` (and to the home page if the item is featured) requests from Google before pressing play. That breaks plan decision 12 and the published privacy line "YouTube receives nothing from you before that". Demo data has `thumbnailUrl: null`, so nothing is wrong today. This becomes Phase 7's picker problem too, but a host deny-list in the mapper is a one-line fix now.

## Media Center grouping and anchors

Home featured cards now deep-link to `/media#media-<id>`. Only `MediaCard` (videos and audio) has that id. A featured IMAGE item, which the admin "Feature on the home page" checkbox allows, links to an anchor that doesn't exist (confirmed, LOW). Separately, the privacy note sits under Sermons and Videos, while Worship (category WORSHIP, VIDEO_EMBED in demo data) gets no note.

## Visual check

I opened about-en-1280, about-ne-375, devotionals-ne-1280, devotionals-en-375, devotional-detail-en-1280, devotional-detail-ne-375, missions-en-1280, missions-ne-375, mission-detail-ne-1280, mission-detail-en-375, media-ne-1280, media-en-375, privacy-en-1280, terms-ne-375, mission-detail-lightbox-en-375 and media-video-loaded-en-1280. The layout is consistent: beige radial hero, serif headings with a gold rule, navy mission band, ivory/white alternating sections and a navy footer. Devanagari renders throughout with no tofu, including dates and numerals. There is no horizontal overflow, and cards stack cleanly at 375. The header matches the user's layout (logo + name far left, nav and language switcher centred, gold CTA right, hamburger on mobile). It shows "Demo Ministry" because the E2E database is seeded, which is expected.

Two captures are not faithful (confirmed): the lazy-loaded gallery thumbnails are blank in `media-en-375.png`, and the full-page stitch in `media-video-loaded-en-1280.png` draws the sticky header mid-page. The thumbnails render correctly in media-ne-1280 and mission-detail-en-375, and the loaded-video card itself is visible, so this is an evidence-quality nit and not a product defect.

The privacy text already describes Phase 6 and 8 behaviour (forms, Resend, Turnstile, Stripe) that isn't built yet. verification.md records this as a known limitation and a go-live re-check, so the later phases have to keep it accurate.

</details>

<details>
<summary>File map</summary>

- `prisma/schema.prisma`, `prisma/migrations/20261027014222_phase3_about_fields_media_event/` — About fields on SiteSettings; MediaItem `eventId` (SET NULL FK) + `sortOrder` + index.
- `src/lib/content.ts`, `content-mappers.ts`, `about-mappers.ts`, `pagination.ts` — public reads, mappers, URL/embed safety, paging moved to a pure module.
- `src/lib/validation/public-query.ts`, `share-links.ts`, `sitemap-entries.ts`, `donation-wording.ts`, `metadata.ts` — query parsing/hrefs, share URLs, sitemap builder, tax wording, article OG.
- `src/app/[locale]/{about,devotionals,devotionals/[slug],missions,missions/[slug],media,privacy,terms}` — the pages.
- `src/components/public/*` — PageHero, PostCard/EventCard, PostFilters, PublicPagination, ScripturePanel, ShareButtons/CopyLinkButton, YouTubeFacade, AudioPlayer, PhotoGallery, TemplateNotice, LegalPage (+ jsdom tests).
- `src/content/legal/*` — privacy/terms template text en+ne with a test.
- `src/content/demo/*`, `public/demo/*`, `prisma/seed-lib.ts` — demo bodies, categories, gallery SVGs, silent audio; create-only seed.
- Admin: `settings/page.tsx`, `validation/settings.ts`, `MediaEditor.tsx`, `media/{new,[id]}/page.tsx`, `validation/media.ts`, `services/media.ts`, `services/events.ts` — About fields, event link + order with existence check.
- `Footer.tsx`, `layout.tsx`, `FeaturedContent.tsx`, `UpcomingEvents.tsx`, `sitemap.ts` — demo-aware copyright/description, detail links, async sitemap.
- `messages/{en,ne}.json` — Phase 3 strings.
- `e2e/*`, `scripts/e2e-prepare.ts`, `playwright.config.ts`, unit/db tests — coverage listed in verification.md.

Full diff: `git -C "c:/Users/rasaily/Downloads/mission app" diff` plus the untracked files in `git status`.

</details>
