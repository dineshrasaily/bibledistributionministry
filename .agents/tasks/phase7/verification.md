# Phase 7 verification (media uploads, Vercel Blob + local driver)

Not committed (the finalize step makes the one Phase 7 commit after approval).

## 1. Static checks (all exit 0)

| Command | Result |
| --- | --- |
| `npm run lint` | 0 |
| `npm run typecheck` | 0 |
| `npm run format:check` | 0 ("All matched files use Prettier code style!") |
| `npm run build` | 0. Routes include `/admin/galleries`, `/admin/galleries/[id]`, `/admin/galleries/new`, `/api/admin/media/library`, `/api/admin/uploads/blob`, `/api/admin/uploads/local`, `/api/uploads/[...key]`. No "Dynamic filesystem access causes tracing" warnings (the local driver's fs calls carry `turbopackIgnore`). |

## 2. `npm test`: 76 files / 756 tests passed (Phase 6 baseline 62 / 591)

New test files (14):
- `src/lib/uploads/policy.test.ts`: MIME/size allow-list (exact limit, +1 byte, empty, SVG/GIF/HEIC/MP4/ZIP/`.jpg.exe`/ext-MIME mismatch, kind mismatch, `audio/x-m4a`), magic bytes (JPEG/PNG/WebP/MP3 ID3 + frame sync/M4A; HTML and SVG rejected), `safeBaseName`, `isLocalKey` traversal cases, blob pathnames, `fitWithin`.
- `src/lib/image-src.test.ts`: `isBlobUrl` / `isOptimizableSrc`, `resolveStorageMode`, `isSameOrigin`.
- `src/lib/validation/uploads.test.ts`: alt text required for IMAGE only, bounds, library query fallbacks, gallery schemas.
- `src/server/storage/local.test.ts`: write/inspect/remove, `wx` never overwrites, over-limit stream leaves no file, path traversal (9 keys), and a **junction outside the root refused**. The junction test ran on this Windows machine (not skipped).
- `src/server/storage/vercel-blob.test.ts`: `head`/`del` mocked, ranged GET via injected fetch, global `fetch` stubbed to throw (no real network).
- `src/components/ui/SiteImage.test.tsx`, `src/components/admin/UploadHint.test.tsx` (review NIT: image hints never say "YouTube link"), `src/components/admin/uploads/MediaUploader.test.tsx` (SVG refused client-side, Upload disabled until alt text, progress, register payload, server error, 11th file refused, disabled mode), `src/components/admin/MediaPickerField.test.tsx`.
- `src/app/api/route-guard-coverage.test.ts`: every `/api/admin/**/route.ts` handler calls `requireAdminRoute(`; POST passes `mutation: true`.
- DB: `src/server/services/uploads.db.test.ts` (register as OWNER/EDITOR, audit has no filename/alt/title, publish, alt required, HTML-as-PNG rejected **and deleted**, traversal/unknown/duplicate keys, no session, Vercel without token, Blob mode mocked incl. SVG and too-large → `del` called; delete removes row + file, in-use refusal naming logo + post, VERCEL_BLOB delete calls `del`, afterCommit failure swallowed + logged, pasted link has no storage call, uploaded items keep url/type), `src/app/api/admin/uploads/routes.db.test.ts` (local route 401/403/411/413/415/201/503, deactivated + revoked sessions → 401, length lie → 413 with no file; blob token route 404/401/403/400, token limits per kind, audited, bad pathname/payload rejected; library 401 / drafts / kinds / `no-store`; serving 200 + headers, 206/416, HEAD, traversal 404, blob mode 404), `src/server/services/galleries.db.test.ts` (authz for all 7 actions, ordering + move + edges, public visibility, alt-less/video refused, moving between galleries, delete keeps photos, unknown event, audit has no titles), `src/server/actions/run-admin-action.db.test.ts` (`prepare` / `afterCommit` hooks).

Rewritten tests (encoded the replaced `MediaItem.eventId`):
- `src/lib/validation/admin.test.ts`: "media eventId and sortOrder" → "media sortOrder" (stray eventId is ignored).
- `src/lib/content-mappers.test.ts`: `groupPhotoGalleries` → `toPhotoGroups` (order, other group, unpublished event link hidden, ne title + en description `lang`, width/height).
- `src/lib/content.db.test.ts`: mission gallery from published galleries; SetNull on event and gallery delete; Media Center groups by gallery; draft galleries hidden.
- `src/server/actions/actions.db.test.ts`: the two eventId cases → "sortOrder persists".
- `prisma/seed.db.test.ts`: demo photos in `gallery-event-4` (PUBLISHED, isDemo), seeding twice gives one gallery.
- `src/test/script-imports.test.ts`: the new pure modules are in `PURE_MODULES`.

## 3. `npm run test:e2e`: 252 passed (Phase 6 baseline 232)

New specs:
- `e2e/admin-uploads.spec.ts` (admin-mutations): **upload a PNG with the local driver and use it as a post cover** (file served 200 `image/png` + `nosniff`; `/en` and `/ne` devotional pages show it); drag and drop; SVG refused in the browser with no request, HTML-as-PNG → 415 from the server; delete refused while used as a cover, then allowed and the file URL 404s; gallery add/order/publish, mission page order + lightbox, Media Center "From:" link, delete gallery; audio upload with `<audio controls>`; logo picker without saving; axe on the new admin pages.
- `e2e/upload-access.spec.ts` (admin-readonly): **anonymous requests are rejected** (local 401, blob 404 because blob mode is off, library 401, `no-store` + `noindex`), login redirects for `/admin/media` and `/admin/galleries`, traversal 404s, signed-in cross-origin and Origin-less POST → 403, library JSON for the owner.
- `e2e/phase7-screenshots.spec.ts` (admin-mutations, last).

Updated specs: `admin-access.spec.ts` (new upload-note text), `admin-content.spec.ts` (the event-photo test now goes through a gallery linked to `event-1`), `admin-screenshots.spec.ts` (waits for "Order in gallery"), `admin-settings.spec.ts` (label "Photo (optional)"). Phase 3 `missions.spec.ts` / `media-center.spec.ts` pass unchanged thanks to the seeded `gallery-event-4`.

Axe: 58 `[axe]` lines, all `serious/critical=0`, including `/admin/media`, the uploader with a selected file, the picker dialog on `/admin/posts/new`, `/admin/galleries`, `/admin/galleries/gallery-event-4` and an uploaded item's editor. One finding was fixed during the run: label-content-name-mismatch on the gallery row buttons (labels are now "Move up: <title>" etc.).

## 4. Screenshots (`.agents/screenshots/phase7/`, 25 files), opened and checked

- `admin-media-library-1280/375`: 4/2-column grid of navy/gold cards with status/type/category badges, "Image · Uploaded · 3 KB" vs "Link", Publish/Delete buttons. No overflow at 375.
- `admin-upload-selected-1280/375`: dashed drop zone, file card with preview, title, required English alt and Devanagari Nepali alt, publish checkbox. At 375 Upload is disabled with the "fill in…" hint.
- `admin-upload-done-1280`: card shows green "Uploaded.".
- `admin-media-picker-1280/375`: modal "Choose a picture" with Media library / Upload tabs, search and image grid. At 375 it fits the width and the grid is 2 columns.
- `admin-post-cover-picked-1280`: Cover picture preview, URL fallback filled with `/api/uploads/...`, Choose from library + Remove picture, image-only hint.
- `admin-galleries-1280`: two galleries with photo counts and event lines.
- `admin-gallery-editor-1280/375`: bilingual title (Devanagari fine), event select, ordered photos with disabled edge buttons. At 375 the sticky save bar appears mid-page; that is the full-page capture of the sticky bar, as in earlier editor shots.
- `admin-media-uploaded-editor-1280`: Stored file panel (name, type, size, 320 × 240, link + Copy link), no link field.
- `devotional-uploaded-cover-{en,ne}-{375,1280}`: uploaded cover in a rounded 16:9 frame. Nepali page shows the Nepali chrome.
- `mission-gallery-{en,ne}-{375,1280}`: "Photo gallery" / "तस्बिर ग्यालेरी" with the 2 photos in the chosen order.
- `media-galleries-{en,ne}-{375,1280}`: gallery title, gold-dark "From: …" / "कार्यक्रम: …" link, photos, then the demo gallery.
- `header-unchanged-en-1280`: logo + name far left, nav + language switcher centre, gold "Support the Mission" right. Same as Phase 6.

## 5. Greps (PowerShell `Select-String` over tracked + untracked, excluding `.agents/`)

- `S3|AWS|Amazon|Cognito|SES`: only binary noise inside `public/brand/logo-full.png` and the `legal.test.ts` test that asserts no AWS. `package-lock.json` has 0 `aws-sdk`/`@aws`.
- `UPLOAD_HINT`, `TODO(Phase 7)`: none.
- `NEXT_PUBLIC_`: only `NEXT_PUBLIC_SITE_URL` and the Phase 8 placeholder `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- `vercel_blob_rw_<token>`: none (the only match is the short test literal in `image-src.test.ts`, which is not a real token).
- `git ls-files .env`: empty. `git check-ignore`: `.local/uploads/x`, `.local/uploads-e2e/x` (`.gitignore:25 .local/`) and `.env` are ignored.
- `git status`: no `.local`, screenshots or `src/generated` entries.

## 6. mission_dev (read-only)

- Pre-check (before migrating): 1 OWNER, `{"ministryName":"Bible Distribution Ministry","logoUrl":"/brand/logo-mark.png"}`, 3 MediaItem rows, 0 IMAGE and 0 non-IMAGE rows with an `eventId`. Snapshot of the affected rows (empty) at `.local/backups/mission_dev-pre-phase7.json`.
- Migration `20261027043846_phase7_media_galleries`: `prisma migrate dev --create-only` hung on an interactive prompt (timed out; no folder created, no process left). Per the plan, the SQL was generated read-only with `prisma migrate diff --from-config-datasource --to-schema` and hand-ordered: create, copy event links into galleries, then drop `eventId`. It contains no TRUNCATE/DELETE, and its only DROPs are the old `eventId` FK, index and column. Applied with `prisma migrate deploy` behind `scripts/assert-local-db.ts`, which is non-interactive and never resets. `prisma migrate status`: up to date.
- Post-check (now): 1 owner, same settings, 3 media items, 0 galleries (none to migrate). Nothing reset, seeded or truncated.

## 7. Environment notes

- `@vercel/blob` pinned at **2.8.2** (`npm view`: latest 2.8.2, 2026-10-14). `npm audit --omit=dev` reports 4 high findings, all from `@vercel/blob` → `@vercel/oidc` → `@vercel/cli-config` → nested `zod <4.6.6` (GHSA-mrhx-c7xc-m3w5). The only automatic fix is a breaking downgrade to `@vercel/blob@2.4.0`, so nothing was changed. The vulnerable zod sits inside the Vercel OIDC CLI config path, not our validation (we use zod 4.6.7). Recorded for Phase 9's audit.
- Local Postgres was found stopped after the first `npm test` run (the Vitest teardown only stops it when it started it, so it had been stopped outside this step). I restarted it with `npm run db:start`, and it is running now.
- Nothing listens on port 3000 at the end of this step. A dev server was listening at the start; I never stopped it. Restart it with `npm run dev`: it needs the new dependency and Prisma client anyway.

## 8. Decisions recorded (standing directive)

- Upload/token routes write their own audit rows (`media.file.store`, `media.upload.token`) via `recordAdminAudit`, in addition to `media.upload` from `runAdminAction`. That way every upload/token endpoint is audited, as the hard rules require.
- `requireAdminRoute` checks the session first (401) and then the origin (403), so anonymous callers always get 401.
- Picker/library buttons use explicit `aria-label`s ("Choose from library: <field>", "Use picture: <title>", "Move up: <title>") for stable names that contain the visible text.

## Notes for the user

- Restart `npm run dev`. In development, uploads land in `.local/uploads` (never committed, not backed up).
- Before going live, create a **Public** Vercel Blob store and connect it (README › Setting up Vercel Blob).
- Known limitations: no automatic cleanup of unregistered uploads, no separate upload rate limit, no video files, and EXIF/GPS stripping happens in the browser.
