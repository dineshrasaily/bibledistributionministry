# Phase 3 implementation plan: core public pages

Scope: About, Devotionals (list + detail), Missions (list + detail), Media Center, Privacy, Terms. All bilingual (en + ne), DB-driven, with SEO metadata, hreflang and sitemap entries. Prayer, Support and Contact stay placeholders (Phases 6 and 8). The header is not touched.

Root: `c:\Users\rasaily\Downloads\mission app` (it has a space, so quote every path in shell commands). Windows + PowerShell. Work on `master`, no worktree. **Do not commit.** The finalize step makes the one Phase 3 commit after review approval.

Baselines: `npm test` 388 tests, `npm run test:e2e` 78 tests. Both must stay green, plus the new tests below.

## Ground rules (from the brief and the codebase)

- **mission_dev holds the user's real data.** Never run `db:reset`, `db:seed`, `prisma migrate reset`, `prisma db push` or any TRUNCATE against it. Schema changes go only through `prisma migrate dev` (see item 1). Tests use `mission_unit` (Vitest) and `mission_test` (Playwright), and both are recreated automatically.
- Don't stop the local Postgres unless you started it. Don't kill the user's `npm run dev` on port 3000. After the schema change the user has to restart their dev server; say so in the final notes.
- Never run `npm test` and `npm run test:e2e` at the same time (both manage Postgres).
- Patterns to follow:
  - **Data access:** `src/lib/content.ts` holds DB reads that return PUBLISHED rows only. Pure locale mappers live in `src/lib/content-mappers.ts`, and `pick()` from `src/lib/localize.ts` does the ne->en fallback.
  - **Pages:** follow the `setRequestLocale` + `hasLocale` + `notFound()` pattern of `src/app/[locale]/page.tsx`.
  - **Metadata:** use `localizedPageMetadata` / `buildPageMetadata` in `src/lib/metadata.ts`.
  - **Markdown:** render it only through `MarkdownContent` (`src/components/ui/MarkdownContent.tsx`, which uses `renderMarkdown`).
  - **Admin mutations:** they go only through `runAdminAction`.
  - **Messages:** keys must be identical in `messages/en.json` and `messages/ne.json`, which `src/lib/messages.test.ts` enforces. That test also forbids the regex `/tax[- ]deductible|501\(c\)|registered charity/i` and the literal "Demo Ministry" anywhere in the message files.
  - **Pure modules:** they must not import `server-only` or `@/lib/db`, and new ones get listed in `PURE_MODULES` in `src/test/script-imports.test.ts`.
- Colours: navy, ivory, beige and gold. Gold `#B8924A` is decorative only. Text on light surfaces uses `text-gold-dark`. Badges use `Badge` / `DemoBadge` from `src/components/ui/Badge.tsx`.
- Images in Phase 3 use `<img>` with `// eslint-disable-next-line @next/next/no-img-element` and a `TODO(Phase 7): next/image + Blob` comment, matching `Footer.tsx`. Every rendered URL goes through `isSafeUrl` (`src/lib/validation/common.ts`) in the mapper. Unsafe URLs become `null`, which renders a placeholder.

## Decisions (the brief left these open; per the standing directive I picked them without pausing)

1. **About content fields.** `missionStatement*`, `vision*`, `values*`, `statementOfFaith*` and `aboutIntro*` already exist on `SiteSettings`. I'm adding the following:
   - `testimonyEn/Ne` (Markdown, faith journey)
   - `goalsEn/Ne` (Markdown, goals and outreach)
   - `aboutImageUrl` (safe URL)
   - `aboutImageAltEn/Ne` (plain text, at most 300 characters; English is required when an image is set)

   The photo/story section uses `aboutIntro` as the story text plus the optional image. With no image it shows the existing decorative panel (the MinistryIntro style, no stock photos). This is the smallest set that covers every About section in the brief.
2. **Demo fallbacks.** If an About field is empty and `SiteSettings.isDemo` is true, the section shows clearly placeholder text from messages (`About.demo.*`, phrased as "Sample text: the ministry's ... will be written here") plus a `DemoBadge`. If `isDemo` is false, the empty section is hidden. The fallbacks describe what belongs there and never invent doctrine, testimony or statistics.
3. **"Linked gallery" for missions.** I'm adding a nullable `MediaItem.eventId` (FK -> Event, `onDelete: SetNull`) and `MediaItem.sortOrder Int @default(0)`. A mission's gallery is its PUBLISHED IMAGE media ordered by `sortOrder`, then `publishedAt`. The admin MediaEditor gets a "Linked mission/event" select and an "Order in gallery" number. I'm not adding a `Gallery` model now: Phase 7 owns gallery management ("create, order items, link to an event") and can add a `Gallery` model on top of this column or migrate it. That keeps Phase 3 from building Phase 7's admin UI.
4. **Rendering and caching.** I'm keeping the established approach: static pages plus `revalidatePath("/[locale]", "layout")` from admin actions.
   - About, Missions, Media, Privacy and Terms are static.
   - The Devotionals list reads `searchParams`, so it renders dynamically. This is acceptable because it's a single paginated query.
   - The detail pages (`devotionals/[slug]`, `missions/[slug]`) use `generateStaticParams` over published slugs with `dynamicParams` left at its default `true`. Unknown or draft slugs call `notFound()`. Slugs that fail `SLUG_RE` go to `notFound()` before any DB call.
   - The detail getters are wrapped in React `cache()` so `generateMetadata` and the page share one query.
   - `src/app/sitemap.ts` becomes async and reads published slugs, with `export const revalidate = 3600`.
5. **Devotionals list rules.**
   - It covers every PostType (the home "Recent updates" link already points to `/devotionals`).
   - Filters come from URL params: `q`, `type` (PostType enum), `category` (category slug) and `page`. Parsing is lenient like the admin `parseListQuery`: invalid values are ignored and never cause an error.
   - Page size is 9 (a 3x3 grid).
   - Search uses case-insensitive `contains` over titleEn/Ne, excerptEn/Ne and bodyEn/Ne.
   - The category select lists only categories that have at least one published post.
   - Results are sorted by `publishedAt` desc, then `id`.
   - The filter form is a plain GET `<form>`, so it works without JS, with "Apply" and "Clear filters" buttons.
   - A result count paragraph uses `role="status"`.
   - Pagination is Previous/Next plus "Page X of Y". Links keep the other params and use `aria-current`.
6. **Scripture references.** The detail page lists every `scriptureRefs` entry in a highlighted "Scripture" panel. If a PUBLISHED `BibleVerse` has exactly that `reference`, its English text is shown with "(WEB)" / "(KJV)" and `lang="en"`. No Nepali Bible text is ever shown. On `/ne` pages the panel uses the existing note style ("A Nepali translation will be added later...").
7. **Nepali body fallback.** If the `ne` body is empty, the English body is rendered with `lang="en"` and a short note (`PostDetail.englishOnlyNote`). An empty body in both languages (the current demo rows in mission_dev) renders the excerpt instead.
8. **Share buttons.**
   - These are plain links only, built by a pure `buildShareLinks(absoluteUrl, title)`:
     - Facebook: `https://www.facebook.com/sharer/sharer.php?u=`
     - X: `https://x.com/intent/post?url=&text=`
     - WhatsApp: `https://wa.me/?text=`
     - Email: `mailto:?subject=&body=`
   - Links use `target="_blank" rel="noopener noreferrer"`, except email.
   - A small client "Copy link" button uses `navigator.clipboard.writeText` and announces "Link copied" or a failure message in a polite live region.
   - There are no SDKs, no scripts and no tracking parameters. The absolute URL comes from `getSiteConfig().siteUrl` + `localizedHref`.
9. **Per-post OG metadata.**
   - `buildPageMetadata` gains optional `type: "article"`, `publishedTime`, `modifiedTime` and `images`.
   - The title is `seoTitle ?? title` and the description is `seoDescription ?? excerpt` (both per locale through `pick`).
   - `og:image` is `coverImageUrl` when it is safe (site paths resolve against `metadataBase`). Otherwise there is no image, and Phase 9 adds a default OG image.
   - Event detail pages get the same treatment: description from the location/date summary, image from `coverImageUrl`.
   - hreflang for detail pages uses the same slug in both locales.
10. **Missions list.** The page has two sections:
    - "Upcoming": `status=UPCOMING`, soonest first, at most 24.
    - "Completed": `status=COMPLETED`, newest first, at most 24.

    CANCELLED events stay out of the lists, but their detail page still renders, with a "This event was cancelled" notice. No pagination is needed at this scale; that's recorded as a known limitation.
11. **Media Center layout.**
    - The page has sections in this order: Sermons (`category=SERMON`), Worship (`WORSHIP`), Podcasts & audio (`type=AUDIO` or `category=PODCAST`), Videos (other `VIDEO_EMBED`) and Photo galleries (`type=IMAGE`). Each section shows at most 12 items, newest first, and empty sections show `EmptyState`.
    - Photo galleries are grouped by linked event (the group title links to `/missions/[slug]` when that event is published), plus an "Other photos" group.
    - Audio uses native `<audio controls preload="none">`. YouTube uses a click-to-load facade (decision 12). An item with no usable URL shows a "coming soon" placeholder card.
    - In-page anchors are `id="media-<id>"`, and home featured media cards link to `/media#media-<id>`.
12. **YouTube facade.**
    - Before the click it renders a `<button>` named "Play video: {title}" over `thumbnailUrl` when safe, else the existing navy/gold placeholder. It never uses `i.ytimg.com`, which would be a YouTube request.
    - On click it renders `<iframe src="{embedUrl}?autoplay=1" title={title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" loading="lazy">` and moves focus to the iframe.
    - `embedUrl` is re-validated in the mapper with `toYouTubeEmbed()`. Only `https://www.youtube-nocookie.com/embed/<11-char id>` is accepted; anything else counts as "no video".
    - Phase 9's CSP must allow `frame-src https://www.youtube-nocookie.com` (noted in the README).
13. **Lightbox.**
    - It's a client `PhotoGallery` built on the already-installed `@radix-ui/react-dialog`, which provides the focus trap, Escape to close and focus return to the thumbnail.
    - Thumbnails are `<button>`s with the image alt as their name.
    - The dialog has a title (photo caption, falling back to alt) and an `aria-live` "Photo 2 of 5" counter. Previous/Next buttons and the ArrowLeft/ArrowRight keys cycle with wrap-around.
    - Images use `object-contain` with `max-h-[80dvh]`. Motion respects `motion-reduce` (no transitions).
14. **Privacy and Terms text.**
    - The text lives in pure TS modules (`src/content/legal/privacy.ts`, `terms.ts`), each exporting `{ en: LegalSection[]; ne: LegalSection[] }`. It is not in the messages JSON, for two reasons: the donation wording has to mention tax status, which the messages test forbids, and long structured text is easier to review there.
    - Both pages show a prominent `TemplateNotice` ("Template - have it reviewed by a qualified professional before relying on it") and a "Last updated" date constant.
    - The privacy text describes exactly what this run implements, as fixed in the brief:
      - Prayer requests: optional name/email, an anonymous option, private and visible only to OWNER/EDITOR, published only with consent and as an admin-edited version.
      - Contact messages.
      - Rate limiting by hashed IP, with raw IPs never stored.
      - Cloudflare Turnstile.
      - Resend admin notifications that contain a link only, never the request body.
      - An admin-configurable retention purge.
      - Stripe donations: no card data stored, receipts sent by Stripe.
      - Hosting on Vercel, the database on Neon, media on Vercel Blob.
      - YouTube (nocookie) loaded only after a click.
      - No analytics or trackers.
      - Cookies: the admin sign-in cookie, plus next-intl's locale cookie if the app actually sets one. The coder confirms this with `context.cookies()` in E2E and words it accordingly.
    - Phases 6 and 8 must re-check this text. That goes in the README go-live checklist.
    - Tax wording comes from a pure helper `donationTaxNote(locale, taxDeductibleVerified)` in `src/lib/donation-wording.ts`, which Phase 8 reuses.
      - When `false`: "Gifts are not tax-deductible."
      - When `true`: "Gifts may be tax-deductible; consult your tax advisor. Stripe emails a receipt for each gift."
15. **Footer copyright.** As promised in the Phase 4-5 design, the "Demonstration site." suffix now shows only when `isDemo` (new key `Footer.copyrightPlain` = "© {year} {name}."). The Settings `isDemo` hint and the README are updated to match. Header markup is untouched.
16. **Demo assets.**
    - Gallery placeholders are hand-written abstract SVGs (navy/beige/gold geometry, no people, no real places) in `public/demo/gallery/`. Their alt text says they are sample placeholders.
    - Demo audio is one generated 1-second silent WAV, `public/demo/audio/sample-silence.wav`, labelled as a silent sample.
    - Seeded demo videos keep `embedUrl: null`, so no real YouTube video gets attributed to the ministry. The E2E facade test uses a fixture inserted only into `mission_test` by `scripts/e2e-prepare.ts`, and its YouTube requests are intercepted.
    - New demo rows reach mission_dev only if the user runs `npm run db:seed` (create-only, never overwrites). **The coder must not run it on mission_dev.** The README says it's optional.

## Plan

- [ ] 1. Schema change and migration (additive only)
  - **Schema:** in `prisma/schema.prisma`:
    - `SiteSettings`: add `testimonyEn String?`, `testimonyNe String?`, `goalsEn String?`, `goalsNe String?`, `aboutImageUrl String?`, `aboutImageAltEn String?`, `aboutImageAltNe String?`, with comments as in the existing model.
    - `MediaItem`: add `eventId String?`, `event Event? @relation(fields: [eventId], references: [id], onDelete: SetNull)`, `sortOrder Int @default(0)` and `@@index([eventId, status, sortOrder])`.
    - `Event`: add `media MediaItem[]`.
  - **Defaults:** add the seven new keys as `null` to `defaultSiteSettings` in `src/config/site.ts`. The `satisfies` check requires them.
  - **Migration:**
    1. `npm run db:status`. If Postgres is stopped, `npm run db:start` and note that you started it.
    2. Read-only pre-check: count `AdminUser` rows with role OWNER and print `ministryName`/`logoUrl` (a small `npx tsx -e` script using `createPrismaClient`, or Prisma Studio). Record this in verification.md.
    3. `npx prisma migrate dev --create-only --name phase3_about_fields_media_event`.
    4. Open the generated SQL and confirm it contains only `ALTER TABLE ... ADD COLUMN`, `CREATE INDEX` and `ADD CONSTRAINT ... FOREIGN KEY ... ON DELETE SET NULL`. No DROP, no data change.
    5. Apply it with `npm run db:migrate` (assert-local-db + `prisma migrate dev`).
    - **If Prisma reports drift or asks to reset, stop.** Do not answer yes, do not reset. Record the message and investigate (the process is non-interactive, so it will error out rather than reset).
  - **Files:** `prisma/schema.prisma`, `prisma/migrations/<timestamp>_phase3_about_fields_media_event/migration.sql`, `src/config/site.ts`
  - **Verify:** `npm run typecheck` exits 0. Repeat the read-only post-check: the owner account and the 'Bible Distribution Ministry' settings are unchanged. `npx prisma migrate status` reports up to date.

- [ ] 2. Pure helpers and mappers, with unit tests (needs item 1 for the generated types)
  - `src/lib/validation/public-query.ts`: `PUBLIC_POST_PAGE_SIZE = 9` and `parsePublicPostQuery(searchParams)`, returning `{ q?, type?: PostType, category?: string, page }`. Reuse the lenient approach of `list-query.ts`: `q` is trimmed with a max of 100 characters, `type` is the PostType enum, `category` must match `SLUG_RE`, `page` is an int of at least 1. Invalid values are dropped and it never throws. Also add `publicPostQueryHref(base, query, overrides)`, which builds `?q=&type=&category=&page=` with empty params omitted and is used by the filter form and pagination.
  - `src/lib/share-links.ts`: `buildShareLinks(url, title)` returning `{ facebook, x, whatsapp, email }` (decision 8), with everything encoded via `encodeURIComponent`.
  - `src/lib/sitemap-entries.ts`: `buildSitemap(siteUrl, staticRoutes, dynamic: { path, lastModified }[])` producing en/ne entries with `alternates.languages`. It must never emit `/admin`.
  - `src/lib/donation-wording.ts`: `donationTaxNote(locale, verified)` returning en/ne strings (decision 14).
  - `src/lib/about-mappers.ts`: `toAboutContent(row: SiteSettings, locale)` returns, for each section (testimony, vision, mission, values, statementOfFaith, goals, story), `{ markdown | paragraphs, isFallback }` or `null` per decision 2, plus `image: { url, alt } | null`. The image is dropped if the URL is unsafe or the alt text is missing. Markdown stays raw; the page renders it through `MarkdownContent`.
  - `src/lib/content-mappers.ts` additions, all pure:
    - `PostSummary` gains `coverImageUrl` and `categories: { slug, name }[]` (optional input).
    - `toPostDetail(row with categories, locale)` returns `{ ...summary, body, bodyLang: "en" | "ne", bodyIsFallback, seoTitle, seoDescription, updatedAt }`.
    - `EventSummary` gains `endsAt` and `coverImageUrl`.
    - `toEventDetail(row, locale)` returns description, report, volunteerInfo paragraphs (via `splitParagraphs`), endsAt, coverImageUrl and status.
    - `toMediaView(row, locale)` returns `{ id, kind, category, title, description, durationMinutes, publishedAt, isDemo, thumbnailUrl (safe or null), audioUrl (safe, AUDIO only), embedUrl (re-validated with toYouTubeEmbed, VIDEO_EMBED only), image: { url, alt } | null (IMAGE only, alt via pick) }`.
    - `groupPhotoGalleries(images, events)` returns `{ event: { title, slug } | null, items }[]`.
    - Every URL goes through `isSafeUrl` (import from `./validation/common`, which is pure).
  - Add all new pure modules to `PURE_MODULES` in `src/test/script-imports.test.ts`.
  - **Tests:**
    - `src/lib/validation/public-query.test.ts`: valid, invalid and array params; page coercion; category slug rejection; href builder omits empty params and resets page on filter change.
    - `src/lib/share-links.test.ts`: encoding of `&`, spaces and Devanagari; the exact hosts.
    - `src/lib/sitemap-entries.test.ts`: both locales, alternates, no `/admin`.
    - `src/lib/donation-wording.test.ts`: both flags and both locales.
    - `src/lib/about-mappers.test.ts`: fallback only when isDemo, hidden when not demo, ne->en fallback, image dropped without alt or with a `javascript:` URL.
    - Extend `src/lib/content-mappers.test.ts`: `toPostDetail` fallback lang, `toMediaView` rejecting `https://www.youtube.com/embed/x` and `http:` audio, `groupPhotoGalleries` ordering.
  - **Files:** the files above.
  - **Verify:** `npx vitest --run --project unit` passes, including the new files and the updated `script-imports.test.ts`.

- [ ] 3. Demo content and seed (needs item 1)
  - `src/content/demo/types.ts`:
    - `MediaKind` gains `"IMAGE"`.
    - `DemoMedia` gains optional `url`, `altText: LocalizedText`, `eventId` and `sortOrder`. `thumbnailUrl` widens to `string | null`.
    - `DemoPost` gains optional `body: LocalizedText` and `categoryIds`.
    - `DemoEvent` gains optional `endsAt`, `description`, `report`, `volunteerInfo` (LocalizedText). `EventStatus` stays `"UPCOMING" | "COMPLETED"` (no demo cancelled event).
    - Add `DemoCategory`.
  - `src/content/demo/categories.ts` (new): two or three categories (for example `faith-and-prayer` "Faith and prayer", `scripture-study` "Scripture study") with ne names.
  - `src/content/demo/posts.ts`: add short sample Markdown bodies (en + ne prose; any Bible quote only in English WEB with its reference) and category links for posts 4-6 and one update.
  - `src/content/demo/events.ts`: add a description, `volunteerInfo` and `endsAt` to event-1, and a description + report to event-4 (completed). All text is visibly "sample".
  - `src/content/demo/media.ts`:
    - Add four IMAGE items (category GALLERY) with `url: "/demo/gallery/sample-1.svg"`..`sample-4.svg` and alt text "Sample placeholder image: abstract navy and gold pattern" (ne equivalent). Three of them link to `eventId: "event-4"` with sortOrder 1-3, one is unlinked.
    - Add one AUDIO podcast item with `url: "/demo/audio/sample-silence.wav"`, titled "Sample podcast episode (silent placeholder audio)".
    - Add one WORSHIP video item with `embedUrl: null`.
  - Create `public/demo/gallery/sample-1.svg`..`sample-4.svg` (simple geometric SVGs in brand colours, 1200x800 viewBox, under 2 KB each) and `public/demo/audio/sample-silence.wav`. Generate the WAV once with a one-line `node -e` that writes a 44-byte RIFF header plus 8000 zero bytes (8 kHz, 8-bit mono PCM, value 0x80).
  - `prisma/seed-lib.ts`:
    - Seed categories (create-only upsert by id) before posts.
    - Posts: write `bodyEn/bodyNe` and create `PostCategory` rows through nested `categories.createMany` inside the create branch only.
    - Events: write the new fields.
    - Media: `MEDIA_KIND_MAP.IMAGE = { type: "IMAGE", category: "GALLERY" }`, and use `media.url ?? null`, `altTextEn/Ne`, `eventId`, `sortOrder`. A demo item's `category` override (WORSHIP) wins over the kind map.
    - Add `categories` to `SeedReport`.
  - Update `prisma/seed.db.test.ts`: the new counts (posts 6, events 4, verses 3, media 9, categories 2-3, settings 1), plus a check that gallery items link to event-4 and that re-seeding stays idempotent and non-overwriting.
  - **Files:** the files above and `src/lib/content.db.test.ts` if its demo-count assumptions change. The home featured logic is unchanged because the new media items are `featured: false`.
  - **Verify:** `npm test` passes. Do not seed mission_dev.

- [ ] 4. Public data-access functions in `src/lib/content.ts` (needs items 2 and 3)
  - `listPublishedPosts(query, locale)`: returns `Page<PostSummary>` using `paginate` + `ilike` from `src/server/services/shared.ts`. Move `paginate`, `ilike` and `Page` to a new pure-ish `src/lib/pagination.ts` and re-export them from `shared.ts`, so `src/lib` doesn't import from `src/server`. It filters `status: "PUBLISHED"`, the optional type, optional `categories: { some: { category: { slug } } }` and the search OR (decision 5). It includes categories and orders by `[{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }]` with `PUBLIC_POST_PAGE_SIZE`.
  - `listPublicCategories(locale)`: categories with at least one PUBLISHED post, sorted by localized name.
  - `getPublishedPostBySlug(slug, locale)`: `cache()`-wrapped. Returns a `PostDetail` or `null`; drafts give `null`.
  - `getVersesByReferences(refs)`: PUBLISHED `BibleVerse` where `reference in refs`, returning `VerseView[]` in ref order.
  - `getMissions(locale)`: returns `{ upcoming, completed }` (decision 10). `publishStatus: "PUBLISHED"` is always required.
  - `getPublishedEventBySlug(slug, locale)`: `cache()`-wrapped. Returns `EventDetail` plus `gallery`: PUBLISHED IMAGE media with this `eventId`, ordered by `sortOrder`, `publishedAt`, mapped by `toMediaView`.
  - `getMediaCenter(locale)`: returns `{ sermons, worship, audio, videos, galleries }` (decision 11). Galleries come from `groupPhotoGalleries`, which receives only published linked events.
  - `getPublishedSlugs()`: returns `{ posts: { slug, updatedAt }[], events: { slug, updatedAt }[] }` for the sitemap and `generateStaticParams`.
  - **Tests (`src/lib/content.db.test.ts`):**
    - Drafts are excluded everywhere.
    - Search matches en and ne titles and the body.
    - The type and category filters work.
    - Pagination clamps to the last page, and a page size of 9 gives correct `pageCount`.
    - A draft slug and an unknown slug give `null`.
    - Verses resolve by exact reference only.
    - Missions split and order correctly, CANCELLED and draft events are excluded, and the CANCELLED detail still resolves.
    - The gallery holds only published images of that event, in order, and deleting the event sets the media `eventId` to null.
    - The Media Center groups by category and type and drops an unsafe embed.
    - `getPublishedSlugs` excludes drafts.
  - Use `makePost/makeEvent/makeMedia/makeCategory` from `src/test/factories.ts`, and extend `makeMedia` to accept `eventId`.
  - **Files:** `src/lib/content.ts`, `src/lib/pagination.ts`, `src/server/services/shared.ts`, `src/lib/content.db.test.ts`, `src/test/factories.ts`
  - **Verify:** `npm test` passes (unit + db).

- [ ] 5. Admin: About fields in Settings, plus the media link to an event (needs item 1)
  - `src/lib/validation/settings.ts`:
    - Add `testimonyEn/Ne` and `goalsEn/Ne` as `optionalMarkdown(10_000)`, `aboutImageUrl` as `optionalSafeUrl()`, and `aboutImageAltEn/Ne` as `optionalText(300)`.
    - Add a `.superRefine` before the existing `.transform`: if `aboutImageUrl` is set and `aboutImageAltEn` is null, add the issue "Describe the photo for people who can't see it." on path `aboutImageAltEn`.
  - `src/app/admin/(dashboard)/settings/page.tsx`:
    - Split the current "Messages" section. Tagline and mission statement stay under "Home page".
    - A new `EditorSection title="About page"` gets, in page order:
      - About introduction / story (moved)
      - Photo link: `TextField name="aboutImageUrl"` with an image-specific hint: "Paste an image link (https://...) or a site path such as /brand/logo-full.png. Uploading arrives in a later update."
      - Photo description: `BilingualField name="aboutImageAlt"`, maxLength 300.
      - Testimony / faith journey (MarkdownEditor en + ne)
      - Vision, Values, Statement of faith (moved)
      - Goals and outreach (MarkdownEditor en + ne)
    - Each section's hint says "Empty sections are hidden on the public site (sample text is shown while Demo site is on)."
    - Update the `isDemo` hint: the copyright now follows this checkbox.
  - The settings service needs no change (it spreads the input). Audit `changed` lists the new keys automatically.
  - `src/lib/validation/media.ts`:
    - Add `eventId` to `commonFields`: blank becomes null, otherwise `idSchema`.
    - Add `sortOrder`: int 0-9999, blank becomes 0, message "Enter a whole number from 0 to 9999."
  - `src/server/services/media.ts`:
    - `commonColumns` gains `eventId` and `sortOrder`.
    - In `createMedia`/`updateMedia`, when `eventId` is set, check `tx.event.findUnique` first. If it's missing, throw `new DomainError("VALIDATION", "The selected event no longer exists. Refresh and try again.", "eventId")`. This avoids the P2003 mapping to the category message.
    - Add `listEventOptions()` in `src/server/services/events.ts`, returning `{ id, titleEn, startsAt }` for all events, newest first, at most 200.
  - `src/components/admin/editors/MediaEditor.tsx`:
    - New prop `events: { id: string; label: string }[]`.
    - `SelectField name="eventId"` labelled "Linked mission/event (optional)", with an empty option "None" and the hint "Photos linked to an event appear in its gallery on the Missions page."
    - `TextField name="sortOrder"` (type number, labelled "Order in gallery", default 0).
    - `src/app/admin/(dashboard)/media/new/page.tsx` and `src/app/admin/(dashboard)/media/[id]/page.tsx` load `listEventOptions()` after their existing guard call and pass the options.
  - **Tests:**
    - Extend `src/lib/validation/admin.test.ts`: alt text required with an image, unsafe `aboutImageUrl` rejected, testimony length limit, media `eventId` blank -> null, invalid id rejected, `sortOrder` bounds.
    - Extend `src/server/actions/actions.db.test.ts`:
      - OWNER saves the About fields, and the audit row's `changed` includes `testimonyEn`.
      - An EDITOR is FORBIDDEN on settings (already covered; keep).
      - `createMediaAction` with a nonexistent `eventId` returns a VALIDATION fieldError `eventId` and writes no row.
      - A valid `eventId` persists.
  - **Files:** the files above.
  - **Verify:** `npm test` passes. `npm run typecheck` and `npm run lint` exit 0.

- [ ] 6. Metadata helper and i18n messages (needs item 2)
  - `src/lib/metadata.ts`:
    - `buildPageMetadata` gains optional `{ type?: "website" | "article"; publishedTime?; modifiedTime?; images?: string[] }`, which feeds `openGraph` (`type`, `publishedTime`, `modifiedTime`, `images`) and `twitter.card = images ? "summary_large_image" : "summary"`.
    - Add `localizedDetailMetadata({ locale, path, title, description, ...og })`, which reads the site name like `localizedPageMetadata`.
  - `messages/en.json` + `messages/ne.json`: identical keys, with ne written as machine-assisted demo Nepali (the existing top-level `_note` covers native review; also add the line "Phase 3 strings added; review with the rest." inside `_note`).
    - **Metadata:** replace the "coming in a later phase" sentence for `about`, `devotionals`, `missions`, `media`, `privacy` and `terms` with real descriptions, keeping prayer/support/contact. Add `siteDescriptionPlain`, used by the layout when `!isDemo`, and update `src/app/[locale]/layout.tsx` to pick it.
    - **About:** `eyebrow`, `title`, `intro`, the section headings (`testimony`, `vision`, `mission`, `values`, `statementOfFaith`, `goals`, `story`), `photoAltFallback`, `ctaPrayer`, `ctaMissions`, and `demo.{testimony,vision,mission,values,statementOfFaith,goals,story}` (placeholder sentences, decision 2).
    - **Devotionals:** `eyebrow`, `title`, `description`, `searchLabel`, `searchPlaceholder`, `typeLabel`, `allTypes`, `categoryLabel`, `allCategories`, `apply`, `clear`, `resultsCount` (ICU plural `{count, plural, =0 {No results} one {# result} other {# results}}`), `emptyTitle`, `emptyDescription`, `noMatchTitle`, `noMatchDescription`, `filtersHeading`.
    - **PostDetail:** `backToList`, `publishedOn`, `scriptureHeading`, `scriptureNoteNe`, `englishOnlyNote`, `categories`, `shareHeading`.
    - **Share:** `copyLink`, `copied`, `copyFailed`, `facebook`, `x`, `whatsapp`, `email`, `opensInNewTab`.
    - **Pagination:** `label`, `previous`, `next`, `pageOf`.
    - **Missions:** `eyebrow`, `title`, `description`, `upcomingTitle`, `completedTitle`, `upcomingEmptyTitle`, `upcomingEmptyDescription`, `completedEmptyTitle`, `completedEmptyDescription`, `viewDetails`.
    - **EventDetail:** `backToList`, `when`, `where`, `about`, `report`, `volunteer`, `gallery`, `galleryEmpty`, `cancelledNotice`, `ctaContact`, `ctaPrayer`.
    - **EventStatuses:** `UPCOMING`, `COMPLETED`, `CANCELLED`.
    - **MediaCenter:** `eyebrow`, `title`, `description`, `sermons`, `worship`, `audio`, `videos`, `galleries`, `otherPhotos`, `emptySection`, `audioUnavailable`, `videoUnavailable`, `fromEvent`.
    - **Video:** `play` ("Play video: {title}"), `privacyNote` ("Plays from YouTube (privacy-enhanced mode). Nothing loads until you press play.").
    - **Lightbox:** `open` ("Open photo: {alt}"), `close`, `previous`, `next`, `counter` ("Photo {current} of {total}").
    - **Legal:** `templateNotice`, `lastUpdated`, `contactLine`.
    - **Footer:** `copyrightPlain`.
  - Keep "Demo Ministry" and the forbidden tax regex out of both files.
  - **Files:** `src/lib/metadata.ts`, `src/app/[locale]/layout.tsx`, `messages/en.json`, `messages/ne.json`
  - **Verify:** `npx vitest --run --project unit` passes (including `messages.test.ts`). `npm run typecheck` exits 0 (`next-intl.d.ts` types the keys).

- [ ] 7. Shared public components, with component tests (needs item 6)
  - `src/components/public/PageHero.tsx` (server): the beige radial band from `PlaceholderPage`, with `SectionHeader as="h1"` (eyebrow, title, description) and an optional DemoBadge slot.
  - `src/components/public/PublicPagination.tsx` (server): a `nav aria-label` containing Previous/Next links built with `publicPostQueryHref`, rendered as `aria-disabled` spans at the ends, plus "Page X of Y".
  - `src/components/public/PostFilters.tsx` (server): a GET form with labelled `Input` (`type="search"`, `name="q"`, `maxLength={100}`), two `Select`s (`type`, `category`), the "Apply" submit and a "Clear filters" link. It uses the `Label` / `Input` / `Select` primitives and wraps on 375 px.
  - `src/components/public/PostCard.tsx` and `EventCard.tsx` (server): card markup lifted from `FeaturedContent` / `UpcomingEvents`, linking to the detail pages, with a cover `<img>` when present, else the existing placeholder.
  - `src/components/public/ScripturePanel.tsx` (server): a list of refs, using `VerseBlock`-style text when a verse is resolved (`lang="en"`), plus the `/ne` note.
  - `src/components/public/ShareButtons.tsx` (server) wraps `CopyLinkButton.tsx` (`"use client"`, live region `role="status"`). The links have visible text and an sr-only "(opens in a new tab)".
  - `src/components/public/YouTubeFacade.tsx` (`"use client"`), per decision 12.
  - `src/components/public/AudioPlayer.tsx` (server): `<figure>` + `<figcaption>` + `<audio controls preload="none" src>`, with fallback text inside `<audio>`.
  - `src/components/public/PhotoGallery.tsx` (`"use client"`, Radix Dialog), per decision 13.
  - `src/components/public/TemplateNotice.tsx` (server): `role="note"`, gold-dark border, bold "Template", AA contrast.
  - Do NOT add these to `src/components/ui/index.ts` (some are server-only).
  - **Tests (jsdom):**
    - `YouTubeFacade.test.tsx`: no iframe before the click; after the click the iframe `src` starts with `https://www.youtube-nocookie.com/embed/` and the title is set; the button's accessible name.
    - `PhotoGallery.test.tsx`: open via click, the counter text, ArrowRight/ArrowLeft wrap, Escape closes and focus returns to the thumbnail.
    - `CopyLinkButton.test.tsx`: mocked `navigator.clipboard.writeText` resolves to "Link copied" and rejects to the failure message.
    - `PublicPagination.test.tsx` (render to string, or test the href logic only, since it is a server component without async): hrefs keep `q`/`type`, and `aria-current` is set.
  - **Files:** the files above.
  - **Verify:** `npx vitest --run --project unit` passes. `npm run lint` exits 0.

- [ ] 8. About page (needs items 2, 6 and 7)
  - Rewrite `src/app/[locale]/about/page.tsx`:
    - PageHero: eyebrow, title, the tagline as description.
    - Then the sections in order: story + photo (two columns on md, photo `<img>` with alt or the decorative panel), testimony, mission (the plain statement in a large serif pull quote), vision, values, statement of faith, goals/outreach.
    - Each section has an h2 and `MarkdownContent` with `lang` set when the text fell back to English. A DemoBadge appears on fallback sections.
    - It closes with a `CtaBand`-style row linking to `/missions` and `/prayer`.
  - It's static. Metadata uses `localizedPageMetadata(params, "about", "/about")`.
  - **Files:** `src/app/[locale]/about/page.tsx`, plus optional `src/components/about/AboutSection.tsx`
  - **Verify:** `npm run build` exits 0 with `/[locale]/about` listed as static (SSG). Covered by E2E in item 13.

- [ ] 9. Devotionals list and detail (needs items 4, 6 and 7)
  - `src/app/[locale]/devotionals/page.tsx`:
    - It takes `searchParams: Promise<...>` and calls `parsePublicPostQuery`.
    - It loads `getFeaturedVerse()`, `listPublishedPosts(query, locale)` and `listPublicCategories(locale)` in parallel.
    - Layout: PageHero, then `FeaturedVerse` (reuse the home component as is), then `PostFilters`, the result count, a grid of `PostCard` or `EmptyState` (different copy for "nothing published" and "no match"), then `PublicPagination`.
    - The canonical in metadata stays `/devotionals` (no query).
  - `src/app/[locale]/devotionals/[slug]/page.tsx`:
    - `generateStaticParams` comes from `getPublishedSlugs().posts`. Slugs not matching `SLUG_RE` go to `notFound()`. A null result from `getPublishedPostBySlug` goes to `notFound()`.
    - `generateMetadata` uses `localizedDetailMetadata` (decision 9, type article).
    - Layout inside an `<article>`:
      - The type badge, `<time>` and category badges (each linking to `/devotionals?category=slug`).
      - An h1 title, and the cover image if present.
      - `ScripturePanel` when there are refs.
      - The body through `MarkdownContent` with `lang` (decision 7), or the excerpt.
      - `ShareButtons` with the absolute canonical URL.
      - DemoBadge if `isDemo`, then "Back to devotionals".
    - Add `src/app/[locale]/devotionals/[slug]/not-found.tsx` only if the locale `not-found.tsx` doesn't already cover it. Check the existing `src/app/[locale]/not-found.tsx`, which already renders a localized 404 with an h1, and reuse it.
  - **Files:** the files above.
  - **Verify:** `npm run build` exits 0. `/[locale]/devotionals` is dynamic, and `/[locale]/devotionals/[slug]` is prerendered for the seeded slugs.

- [ ] 10. Missions list and detail (needs items 4, 6 and 7)
  - `src/app/[locale]/missions/page.tsx` (static): PageHero, an "Upcoming" section (`aria-labelledby`) with a grid of `EventCard`s, a "Completed" section, and `EmptyState` for either.
  - `src/app/[locale]/missions/[slug]/page.tsx`:
    - `generateStaticParams` comes from `getPublishedSlugs().events`, and `notFound()` handles bad slugs or null results. Metadata follows decision 9.
    - Layout:
      - The kind and status badges, an h1, and a `dl` with "When" (`startsAt`-`endsAt` via `format.dateTimeRange` or two `<time>`s, `dateStyle: "full"`, UTC) and "Where".
      - The cover image.
      - A cancelled notice when CANCELLED.
      - The description (Markdown).
      - The "How to take part" volunteer paragraphs, with a link to `/contact`.
      - "Trip report" (Markdown, only when present).
      - The "Photo gallery" `PhotoGallery`, or `galleryEmpty` text.
      - Links to `/prayer` and back to `/missions`, and a DemoBadge.
  - **Files:** the files above.
  - **Verify:** `npm run build` exits 0. Both routes appear as expected.

- [ ] 11. Media Center (needs items 4, 6 and 7)
  - `src/app/[locale]/media/page.tsx` (static): PageHero, then one `<section aria-labelledby>` per group (decision 11).
    - Cards show the title, description, date, duration and a DemoBadge.
    - Videos render `YouTubeFacade` or the "video coming soon" placeholder. Audio renders `AudioPlayer` or the unavailable note. Galleries render `PhotoGallery` per group, with the event title link.
    - Each card has `id="media-<id>"` and `scroll-mt-24`.
    - The `Video.privacyNote` line sits under the Sermons/Videos headings.
  - **Files:** `src/app/[locale]/media/page.tsx`
  - **Verify:** `npm run build` exits 0. `/[locale]/media` is static.

- [ ] 12. Privacy and Terms, the footer, home links and the sitemap (needs items 2 and 6)
  - **Legal text:** `src/content/legal/types.ts` (`LegalSection = { id; heading; paragraphs: string[]; bullets?: string[] }`), `src/content/legal/privacy.ts` and `src/content/legal/terms.ts` (en + ne, the same section ids in the same order; content per decision 14). Placeholders `{name}` and `{email}` are filled by the page.
    - Privacy sections: who we are, what we collect (prayer requests, contact messages, donations, admin accounts), how we use it, who can see it, service providers (Vercel, Neon, Vercel Blob, Resend, Cloudflare Turnstile, Stripe, YouTube nocookie), cookies, retention, your choices / contact, children, changes.
    - Terms sections: use of the site, content and Scripture (WEB/KJV public domain; other content copyright of the ministry), user submissions and consent, donations (inserting `donationTaxNote`, refunds through the contact email), external links, no warranty, changes, contact.
  - **Pages:** `src/app/[locale]/privacy/page.tsx` and `terms/page.tsx` render PageHero, `TemplateNotice`, "Last updated", and then h2 + paragraphs per section, inside a `max-w-3xl` prose column. They're static. `terms` reads `getSiteSettings().taxDeductibleVerified`.
  - **Legal tests:** `src/content/legal/legal.test.ts` checks that en/ne section ids are identical, that no section is empty, that the privacy text mentions "hashed" (no raw IPs) and "consent", and that it contains no `501(c)` / "registered charity" claim. Add the legal modules to `PURE_MODULES`.
  - **Footer:** in `src/components/layout/Footer.tsx`, use `copyright` when `site.isDemo`, else `copyrightPlain`. This is the only Footer change.
  - **Home links:**
    - `src/components/home/FeaturedContent.tsx`: post links go to `/devotionals/<slug>`, media links go to `/media#media-<id>`, and a safe `thumbnailUrl` renders as an `<img>` in place of the placeholder. This addresses review NIT 1.
    - `src/components/home/UpcomingEvents.tsx`: links go to `/missions/<slug>`.
    - `FeaturedItem.item` already has `slug` for posts. Add `id` usage only.
  - **Sitemap:** `src/app/sitemap.ts` becomes async and calls `getPublishedSlugs()` + `buildSitemap` with `revalidate = 3600`. Keep the static route list. Update `src/app/sitemap.test.ts` to test `buildSitemap` (it's a unit test with no DB; mock `@/lib/content` if it still imports `sitemap.ts`).
  - Keep `PlaceholderPage` (prayer/support/contact still use it).
  - **Files:** the files above.
  - **Verify:** `npx vitest --run --project unit` passes. `npm run build` exits 0.

- [ ] 13. E2E fixtures, specs, axe and screenshots (needs items 8-12)
  - **Fixtures:** `scripts/e2e-prepare.ts` inserts the following after `seedDemoContent`, all into mission_test only (the fence already exists), all `isDemo: true` and not featured:
    - Five published ARTICLE posts, `e2e-article-1..5`. With the six demo posts that makes 11, which gives two pages of 9.
    - A DRAFT post, `e2e-draft-post`.
    - A published post, `e2e-markdown-safety`, whose `bodyEn` contains `<script>window.__xss=1</script>`, `[bad](javascript:alert(1))` and `**bold**`.
    - A published VIDEO_EMBED, `e2e-video`, category GENERAL, `embedUrl: "https://www.youtube-nocookie.com/embed/aaaaaaaaaaa"`.
  - **Playwright config:** add the new specs to `PUBLIC_SPECS` in `playwright.config.ts`.
  - **`e2e/public-pages.spec.ts`**, for en and ne:
    - `/about`, `/devotionals`, `/devotionals/sample-devotional-here-i-am`, `/missions`, `/missions/sample-past-gathering`, `/media`, `/privacy` and `/terms` return 200, have one visible h1 and the right `<html lang>`.
    - `/devotionals/e2e-draft-post` and `/missions/does-not-exist` return 404.
    - The detail pages have hreflang en/ne alternates and `og:type=article` on posts.
    - `/sitemap.xml` contains `/en/devotionals/sample-devotional-here-i-am` and `/ne/missions/sample-past-gathering`, and does not contain `e2e-draft-post`.
    - The privacy and terms pages show the template notice text from `messages.Legal.templateNotice`.
    - The About page shows the demo fallbacks with a DemoBadge.
  - **`e2e/devotionals.spec.ts`:**
    - Searching "shepherd" leaves exactly one card, "Sample devotional: the Lord is my shepherd", and the URL has `q=shepherd`.
    - The ne search `भजनसंग्रह` finds it on `/ne/devotionals`.
    - The type filter `BIBLE_STUDY` shows only "Sample Bible study: John chapter 3".
    - The category filter works.
    - A no-match search shows the no-match empty state.
    - Pagination: page 1 has 9 cards, Next goes to `page=2` with 2 cards, and Previous is disabled on page 1.
    - The detail page shows the Scripture panel with "Isaiah 6:8" and the WEB verse text, the share links (Facebook, X, WhatsApp, mailto) have hrefs that contain the encoded page URL, and Copy link (with `context.grantPermissions(["clipboard-read","clipboard-write"])`) shows "Link copied".
    - On `e2e-markdown-safety`: `window.__xss` is undefined, there is no `script` inside `article`, no `a[href^="javascript:"]`, and `strong` is visible.
  - **`e2e/missions.spec.ts`:**
    - The list has Upcoming and Completed headings with the demo cards in the right sections.
    - The `sample-past-gathering` detail shows location, date, description, the report and the gallery (three thumbnails).
    - The lightbox opens on click, the counter reads "Photo 1 of 3", ArrowRight gives "Photo 2 of 3", and Escape closes it with focus back on the thumbnail.
    - The `sample-mission-trip` detail shows the volunteer info.
  - **`e2e/media-center.spec.ts`:**
    - Collect requests with `page.on("request")`, and `page.route(/youtube(-nocookie)?\.com|ytimg\.com/, r => r.fulfill({ status: 200, contentType: "text/html", body: "<html></html>" }))`.
    - Load `/en/media` and assert zero YouTube requests and zero iframes.
    - Click "Play video: <e2e-video title>", then assert one iframe whose `src` starts with `https://www.youtube-nocookie.com/embed/aaaaaaaaaaa`.
    - The demo audio has an `audio[controls]` element.
    - The gallery lightbox opens.
  - **Admin specs (admin-mutations project, serial):**
    - `e2e/admin-settings.spec.ts`: the owner fills Testimony (English) "E2E testimony text", saves, and `/en/about` shows it without a DemoBadge on that section. Then restore it (clear and save). Also: an image link without alt text gives a field error.
    - `e2e/admin-content.spec.ts`: create an IMAGE media with url `/demo/gallery/sample-4.svg`, alt text, linked event "Sample mission trip to a village community", and publish it. `/en/missions/sample-mission-trip` shows it in the gallery. Then delete it.
  - **axe:** extend `e2e/a11y.spec.ts` with a loop over the eight new pages × en/ne at 1280, and the list pages (about, devotionals, missions, media) also at 375. Add the lightbox-open state on `/en/missions/sample-past-gathering` and the video-loaded state (with the route stub) on `/en/media`. Expect zero serious/critical violations, reusing `seriousViolations`.
  - **Screenshots:** in `e2e/phase3-screenshots.spec.ts` (public project), write to `.agents/screenshots/phase3/` with `fullPage: true` after `networkidle` + `document.fonts.ready`. Assert `scrollWidth <= width` for each. File name pattern: `<page>-<locale>-<width>.png`, for en and ne at 375 and 1280:
    - `about`
    - `devotionals`
    - `devotionals-filtered` (`?type=DEVOTIONAL`)
    - `devotional-detail` (`sample-devotional-here-i-am`)
    - `missions`
    - `mission-detail` (`sample-past-gathering`)
    - `media`
    - `privacy`
    - `terms`

    That's 36 files. Extras: `mission-detail-lightbox-en-375.png`, `mission-detail-lightbox-en-1280.png` and `media-video-loaded-en-1280.png` (with the YouTube route stubbed). Admin screenshots go in `e2e/admin-screenshots.spec.ts`, written to the same folder: `admin-settings-about-1280.png` (scrolled to the About section) and `admin-media-editor-1280.png`.
  - **Files:** `scripts/e2e-prepare.ts`, `playwright.config.ts`, `e2e/public-pages.spec.ts`, `e2e/devotionals.spec.ts`, `e2e/missions.spec.ts`, `e2e/media-center.spec.ts`, `e2e/phase3-screenshots.spec.ts`, `e2e/a11y.spec.ts`, `e2e/admin-settings.spec.ts`, `e2e/admin-content.spec.ts`, `e2e/admin-screenshots.spec.ts`
  - **Verify:** `npm run test:e2e` passes 78 + new tests, with 0 failures. Then open every screenshot in `.agents/screenshots/phase3/` and actually look at it:
    - On-brand and polished.
    - No overflow.
    - Devanagari renders, and there's no tofu.
    - The header is identical to the home screenshots: logo + name far left, nav centered on xl, gold CTA right.
    - Fix anything that looks off and re-run.

- [ ] 14. README, full verification and evidence (needs everything above)
  - **README:**
    - Phase status: 3 done.
    - Admin guide: the About page fields and when sample text shows, linking photos to an event, YouTube links play in privacy-enhanced mode only after a click, and audio links.
    - Remove the outdated "copyright still says Demonstration site" note.
    - Optional `npm run db:seed` to add the new demo samples locally (create-only).
    - Go-live checklist items: legal review of Privacy/Terms (re-check after Phases 6 and 8), Phase 9's CSP must allow `frame-src https://www.youtube-nocookie.com`, and native review of the new Nepali strings.
  - **Verification run, in order:**
    1. `npm run lint`
    2. `npm run typecheck`
    3. `npm run format:check` (run `npm run format` first if needed)
    4. `npm run build`
    5. `npm test` (388 + new, all pass)
    6. `npm run test:e2e` (78 + new, all pass)
  - **Hygiene:**
    - `git grep -n -i -E "aws|amazon|\bs3\b|cognito|\bses\b"` returns no matches. Review any false positive.
    - No secrets in the diff.
    - `git check-ignore .env` prints `.env`. `git status --short` lists only the intended files and no `.env`.
    - Read-only mission_dev check: the owner account still exists, and `ministryName` = 'Bible Distribution Ministry' and `logoUrl` = '/brand/logo-mark.png' are unchanged.
  - Record the commands, exit codes, test counts, the migration SQL summary, the before/after mission_dev check, the screenshot list with a one-line visual note each, and known limitations in `.agents/tasks/phase3/verification.md`.
  - **Known limitations to record:**
    - Missions lists are capped at 24 and have no pagination.
    - Galleries are MediaItem-based until Phase 7.
    - `<img>` stays until Phase 7.
    - No default OG image until Phase 9.
    - The legal text is a template.
    - mission_dev demo rows have no bodies or gallery unless the user runs `db:seed`.
    - The user must restart `npm run dev` after the migration.
  - **Files:** `README.md`, `.agents/tasks/phase3/verification.md`
  - **Verify:** every command above exits 0, and verification.md contains the evidence. Do not commit; the finalize step commits after approval.
