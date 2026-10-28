# Phase 7 implementation plan: media uploads (Vercel Blob + local driver), media library, galleries, pickers, next/image

Scope (from the brief, nothing more):
- A storage abstraction with two drivers. The `vercel-blob` driver is used when `BLOB_READ_WRITE_TOKEN` is set. The `local` driver writes to a git-ignored folder and serves files through a safe route. Dev, Vitest and Playwright use the local driver.
- An admin upload UI for images and audio: drag-and-drop plus a file picker, with progress. The server enforces a MIME/size allow-list. Large files use Vercel Blob client uploads through a guarded token route. Images need alt text.
- A media library grid with search and filters.
- Galleries: create, order items, link to an event. Phase 3's public mission gallery and Media Center lightbox read them.
- Pick-from-library for post and event covers, the site logo, the About photo and the media thumbnail. The picker replaces URL-only fields but keeps a URL fallback.
- The Phase 4-5 review NIT is fixed (image-only fields no longer suggest "a YouTube link").
- Deleting a media item also deletes its stored file.
- `next/image` is used on public images, with `remotePatterns` for the Vercel Blob host.
- No video files. Video stays YouTube embeds.

Root: `c:\Users\rasaily\Downloads\mission app`. The path has a space, so quote every path. Windows + PowerShell. Paths with `[locale]`, `[id]` or `[...key]` need `-LiteralPath` in PowerShell. Work on `master` with no worktree. **Do not commit.** The finalize step makes the one Phase 7 commit after review approval.

Baselines (from `.agents/tasks/phase6/verification.md`): `npm test` = 62 files / 591 tests, `npm run test:e2e` = 232 passed. Both must stay green, plus the new tests below. Tests that encode replaced behaviour (`MediaItem.eventId`, the old upload hint) are rewritten. Never delete them silently; list each rewritten test in verification.md.

## Ground rules (from the brief and the code I read)

- **mission_dev holds the user's real data.**
  - Never run `db:reset`, `db:seed`, `prisma migrate reset`, `prisma db push`, `prisma db execute` or TRUNCATE against it.
  - The schema changes only through the one migration in item 2, applied with `npm run db:migrate` (`prisma migrate dev`).
  - Vitest uses `mission_unit` and Playwright uses `mission_test`. Both are recreated automatically.
  - Don't stop Postgres unless you started it. Don't kill the user's `npm run dev` on :3000. The final notes must tell the user to restart it (new dependency + new Prisma client).
  - Never run `npm test` and `npm run test:e2e` at the same time.
- **Admin mutations:** only through `runAdminAction` (`src/server/actions/run-admin-action.ts`): guard -> Zod -> transaction + AuditLog row -> revalidate.
  - Services take `(tx, input, actor)` and return `ServiceResult`.
  - Redirects happen only in action files, after success.
  - Action files start with `"use server";`, and every export calls `runAdminAction(` (`src/server/actions/guard-coverage.test.ts`).
  - Services never redirect.
- **Audit metadata:** only ids, types, MIME types, sizes, counts, booleans and status transitions. Never file names, titles of people, alt text or URLs with personal info.
- **Pure modules:** they import neither `server-only` nor `@/lib/db`. Add each one to `PURE_MODULES` in `src/test/script-imports.test.ts`.
- **Messages:** `messages/en.json` and `messages/ne.json` must keep identical keys (`src/lib/messages.test.ts`). If a public key is added, extend the ne `_note` with "Phase 7 strings added; review with the rest." The admin is English-only, so admin strings are not in messages.
- **UI:** reuse `src/components/ui/*` (`Button`, `Input`, `Label`, `FieldError`, `Badge`, `Card`, `EmptyState`, `Skeleton`) and `src/components/admin/*` (`FormShell`, `fields.tsx`, `BilingualField`, `EditorSection`, `PageHeader`, `ListToolbar`, `Pagination`, `InlineAction`, `ConfirmDialog`, `StatusBadge`, `SubmitButton`, `FlashToast`/`ToastProvider`, `Skeletons`). Dialogs use Radix Dialog (as `PhotoGallery.tsx` and `ConfirmDialog.tsx` do). Gold `#B8924A` is decorative only. Text on light surfaces uses `text-gold-dark`.
- **The header is NOT changed.** `Header.tsx` and `Footer.tsx` keep their `<img>` logo, because the layout is user-customized and the image is tiny. Only the `TODO(Phase 7)` comment becomes "logo stays <img>: fixed tiny size; header layout is user-customized".
- **No AWS anywhere.** The pinned dependency is `@vercel/blob` **2.8.2**. `npm view @vercel/blob` (checked while planning) shows latest = 2.8.2, published 2026-10-14, engines node >= 20, deps undici/async-retry/throttleit/@vercel/oidc/is-buffer/is-node-process. It is the official Vercel package. I read its 2.8.2 typings (`dist/client.d.ts`, `dist/index.d.ts`):
  - `handleUpload` takes `onBeforeGenerateToken(pathname, clientPayload, multipart)`, which returns `allowedContentTypes`, `maximumSizeInBytes`, `addRandomSuffix`, `allowOverwrite`, `cacheControlMaxAge` and `validUntil`.
  - `onUploadCompleted` is **optional**.
  - `upload()` takes `access`, `handleUploadUrl`, `clientPayload`, `multipart` and `onUploadProgress({ loaded, total, percentage })`.
  - `head(url, { token })` returns `{ size, contentType, pathname, url, ... }`.
  - `del(urlOrPathname | urls[], { token })`.
  - `BlobNotFoundError` is exported.
  - `access` is `'public' | 'private'`.

## Decisions (picked per the standing directive, with rationale)

1. **One model for uploaded files: extend `MediaItem`, no separate Asset table.** An upload creates a `MediaItem` (IMAGE or AUDIO) with `status = DRAFT` (default) and new storage columns:
   - `storageDriver StorageDriver?` (`LOCAL | VERCEL_BLOB`; null = a pasted link)
   - `storageKey String? @unique`
   - `mimeType String?`
   - `sizeBytes Int?`
   - `width Int?`, `height Int?`
   - `originalFilename String?`

   The media library is the existing `/admin/media`, shown as a grid. Pasted links and uploads share the same publish/edit/delete flows, so there is only one code path, one list and one picker source. A DRAFT upload is not listed publicly, but it can still be used as a cover or logo, because pickers write its URL.
2. **Galleries are a new `Gallery` model. `MediaItem.eventId` is replaced by `MediaItem.galleryId` (one gallery per photo, ordered by the existing `sortOrder`).**
   - `Gallery` fields: `id`, `titleEn`, `titleNe?`, `descriptionEn?`, `descriptionNe?`, `eventId?` (FK Event, `onDelete: SetNull`), `status ContentStatus @default(DRAFT)`, `publishedAt DateTime?`, `isDemo Boolean @default(false)`, `items MediaItem[]`, `createdAt`, `updatedAt`, `@@index([status, publishedAt])`, `@@index([eventId, status])`.
   - `Event.media MediaItem[]` becomes `Event.galleries Gallery[]`.
   - Phase 3 planned this explicitly ("Phase 7 can add a Gallery model on top of this column or migrate it").
   - One-to-many keeps ordering trivial (reuse `sortOrder`) and matches "order items, link to an event".
   - **Public visibility rule (unchanged in spirit):** a photo appears in a gallery only when the gallery is PUBLISHED **and** the photo is PUBLISHED **and** it has a safe URL + alt text. Drafts never leak.
   - "Other photos" on the Media Center means PUBLISHED IMAGE items with `galleryId = null`. Photos in a draft gallery never show there.
3. **Data-preserving migration.** `phase7_media_galleries` is a single migration:
   1. Adds the enum, the `Gallery` table and the new columns.
   2. **Copies** every existing event link into galleries: one gallery per event that has linked IMAGE media. The gallery id is `'gallery-' || event.id`, the title is copied from the event, `eventId` = event, `status = 'PUBLISHED'` (so today's public galleries stay visible), `publishedAt = now()` and `isDemo = event.isDemo`. It then sets `galleryId` on those IMAGE rows.
   3. Only then drops `MediaItem.eventId` with its FK and index.

   The id convention makes the seeded demo gallery id (`gallery-event-4`) match the row the migration creates in mission_dev, so a later seed upsert is a no-op. Non-IMAGE media linked to an event were never shown, so they lose only an invisible link. Their count is recorded before migrating. A JSON snapshot of the affected rows is written first (item 2), because embedded-postgres ships no `pg_dump` (checked: only `initdb`, `pg_ctl`, `postgres` in `node_modules/@embedded-postgres/windows-x64/native/bin`).
4. **Storage modes (`resolveStorageMode(env)`, pure):**
   - `"blob"` when `BLOB_READ_WRITE_TOKEN` is non-blank.
   - else `"disabled"` when `VERCEL` is set (Vercel's filesystem is read-only/ephemeral, so local files would vanish).
   - else `"local"`.
   - In `"disabled"` mode the admin shows "File uploads are not set up yet (add a Vercel Blob store). You can still paste links." and the upload routes answer 503. The site never breaks without keys.
   - The local root is `path.resolve(process.cwd(), process.env.LOCAL_UPLOAD_DIR || ".local/uploads")`. `.local/` is already git-ignored. Playwright sets `LOCAL_UPLOAD_DIR=.local/uploads-e2e`, and Vitest uses a `mkdtemp` folder.
   - Vitest and Playwright both force `BLOB_READ_WRITE_TOKEN=""`, so a developer's `.env` token can never cause real network calls in tests.
5. **Upload flow (both drivers end in the same guarded server action):**
   1. **Client.** Validate with the shared pure policy. Images are re-encoded in the browser: `createImageBitmap` -> canvas -> `toBlob` in the same MIME (JPEG/WebP quality 0.88, PNG lossless), with the longest side capped at 2560 px. This **strips EXIF/GPS** (photos of believers in Nepal can be sensitive) and applies the phone's orientation. It also yields `width`/`height`. If decoding fails, the user sees "This picture couldn't be read. Try a JPEG, PNG or WebP file." Audio is sent unchanged.
   2. **Transfer.**
      - local: `XMLHttpRequest` POST of the raw file to `/api/admin/uploads/local?kind=IMAGE|AUDIO` with `X-File-Name` (URI-encoded), using `xhr.upload.onprogress`.
      - blob: `upload()` from `@vercel/blob/client` (dynamic import) with `access: "public"`, `handleUploadUrl: "/api/admin/uploads/blob"`, `clientPayload: JSON.stringify({ kind })`, `multipart: size > 5 MiB` and `onUploadProgress`. The browser sends the file straight to Vercel Blob, which avoids the 4.5 MB function body limit.
   3. **Register.** `registerUploadAction` (runAdminAction, `media.upload`, role ADMIN) receives `{ kind, ref (local key or blob URL), titleEn, titleNe?, altTextEn (required for IMAGE), altTextNe?, width?, height?, originalFilename?, galleryId?, publish }`.
      - Its new `prepare` hook (decision 7) **re-inspects the stored object server-side**: size, declared type and magic bytes. On mismatch it deletes the object and returns a field error.
      - The transaction then creates the MediaItem.
      - **Why not `onUploadCompleted`?** Vercel cannot call back to localhost, and a callback would need an unauthenticated endpoint. An explicit, guarded register step works identically in dev, tests and production. `onUploadCompleted` is omitted (it is optional in 2.8.2), and the token route rejects any non-token body with 400.
6. **Allow-list (`src/lib/uploads/policy.ts`, pure, used by the client, the routes and the services).** The server always decides by magic bytes plus extension plus declared MIME. All three must agree.
   - IMAGE, max **8 MiB** (8 388 608 bytes): `image/jpeg` (`.jpg`/`.jpeg`, magic `FF D8 FF`), `image/png` (`.png`, magic `89 50 4E 47 0D 0A 1A 0A`), `image/webp` (`.webp`, `RIFF....WEBP`).
   - AUDIO, max **100 MiB** (104 857 600 bytes): `audio/mpeg` (`.mp3`, `ID3` or a frame sync `FF Ex/Fx`), `audio/mp4` (`.m4a`; `audio/x-m4a` and `audio/m4a` normalized to `audio/mp4`; bytes 4-7 `ftyp` with a major brand in `M4A `, `M4B `, `mp42`, `isom`, `mp41`, `iso2`, `dash`).
   - Everything else is rejected with a friendly message: SVG (XSS risk), GIF, HEIC, video, archives, and empty files.
   - Storage keys are generated by the server or validated strictly:
     - local: `^media/(images|audio)/\d{4}/\d{2}/[a-z0-9-]{1,60}-[a-z0-9]{10}\.(jpg|png|webp|mp3|m4a)$`
     - blob pathname: `^media/(images|audio)/[a-z0-9-]{1,60}(-[A-Za-z0-9]{1,40})?\.(jpg|png|webp|mp3|m4a)$`, with `addRandomSuffix: true` and `allowOverwrite: false`
     - The extension must match the kind.
7. **Two small, tested extensions to `runAdminAction` (no new bypass):**
   - `prepare?: (input, actor) => Promise<input'>` runs after Zod and before the transaction, inside the same error mapping. It is needed because network/file inspection must not run inside a Prisma interactive transaction (5 s default timeout).
   - `afterCommit?: (result, actor) => Promise<void>` runs only after a successful commit and before revalidation. Its errors are caught and logged (`admin.action.after_commit_failed`, action name + error name only) and never change the result.
   - Delete uses `afterCommit` to remove the stored file. A failed file delete leaves a harmless orphan and logs `media.file.delete_failed { driver, key }`. The alternative order (delete the file, then roll back the row) could leave a broken row.
8. **Delete safety.** Deleting an uploaded item (`storageKey != null`) first checks where its URL is used: `Post.coverImageUrl`, `Event.coverImageUrl`, `SiteSettings.logoUrl` / `aboutImageUrl`, and another `MediaItem.thumbnailUrl`. Any use returns `DomainError("CONFLICT", 'This file is still used: cover of post "…", site logo. Choose another picture there first.')` with up to 3 usages (titles only), and nothing is deleted.
   - Pasted-link items delete as before.
   - Gallery delete only unlinks its photos (`SetNull`). It never deletes files.
9. **Editing an uploaded item.** Type and URL are locked: `updateMedia` overwrites them from the stored row when `storageKey` is set. Sending a different `type` returns VALIDATION "Uploaded files keep their type." The editor shows a "Stored file" panel (preview or `<audio controls>`, original name, type, size, a "Copy link" button) instead of the URL input.
10. **Route handlers** (all `export const runtime = "nodejs"`; `dynamic = "force-dynamic"` where needed):
    - `POST /api/admin/uploads/local`: local upload (raw body, streamed with a byte cap).
    - `POST /api/admin/uploads/blob`: the Vercel Blob client-token route.
    - `GET /api/admin/media/library?kind=image|audio&q=&page=`: a JSON page for the pickers. This is a read, so it is a route, not a server action. Responses are `no-store`.
    - `GET|HEAD /api/uploads/[...key]`: public serving of local files (local mode only, else 404).
    - A shared `requireAdminRoute(request, { mutation })` helper (`src/server/auth/route-guard.ts`, server-only) returns the actor or a JSON `Response`:
      - 401 `{ error: "UNAUTHENTICATED" }` without a valid session (it reuses `getCurrentAdmin`, so deactivation and sessionVersion are honoured).
      - For mutations, 403 `{ error: "FORBIDDEN_ORIGIN" }` unless the pure `isSameOrigin(headers, requestOrigin)` passes. That requires the `Origin` header to equal the request origin, and `Sec-Fetch-Site`, when present, to be `same-origin`. It works as the CSRF defence because route handlers, unlike server actions, get no built-in origin check.
    - `next.config.ts` adds `/api/admin/:path*` to the existing `adminHeaders` (no-store, noindex, frame-ancestors none).
    - The proxy matcher already skips `/api`, so `src/proxy.ts` is unchanged.
11. **Local serving route hardening.**
    - The key is joined from the segments and must match the strict local key regex. It is resolved with `path.resolve(root, key)` and must start with `root + path.sep`. `lstat` must not report a symbolic link. Anything else returns 404, never 400, so nothing leaks.
    - `Content-Type` comes from the extension map only.
    - Headers: `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`, `Content-Disposition: inline`, `Cache-Control: public, max-age=31536000, immutable` (keys are unique), `Accept-Ranges: bytes`.
    - A single `Range: bytes=a-b` request returns 206, an invalid range returns 416. `<audio>` needs this to seek.
    - URLs look like `/api/uploads/media/images/2026/10/name-abc123defg.webp`. They pass the existing `isSafeUrl` site-path rule, so all existing URL validation and mappers keep working.
12. **next/image.**
    - A new `SiteImage` component (`src/components/ui/SiteImage.tsx`) wraps `next/image`.
    - `unoptimized` is decided by the pure `isOptimizableSrc(src)` (`src/lib/image-src.ts`). It returns true only for `https://<store>.public.blob.vercel-storage.com/media/...` and raster site paths under `/brand/` or `/demo/` (`.png`, `.jpg`, `.jpeg`, `.webp`). Everything else is rendered `unoptimized`: SVG, `/api/uploads/...` local dev files (avoids depending on the optimizer fetching a route in dev/E2E), and other https hosts (they can't be in `remotePatterns`).
    - With `fill` the parent must be `relative` and `sizes` is required. With known `width`/`height` the image is sized. With neither, SiteImage falls back to a plain `<img>`, the only `no-img-element` disable outside Header/Footer.
    - `next.config.ts`: `images.remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/media/**", search: "" }]`, `images.localPatterns: [{ pathname: "/brand/**", search: "" }, { pathname: "/demo/**", search: "" }]`, `images.maximumRedirects: 0`.
13. **Picker UX (`MediaPickerField`, client).**
    - It keeps the **same form field name and the same Zod schema** (`optionalSafeUrl`), so post/event/settings/media actions and their tests are unchanged.
    - It renders:
      - a small preview of the current value (SiteImage, unoptimized for unknown hosts)
      - the text input (the URL fallback)
      - "Choose from library", which opens a Radix Dialog with search, an image grid (buttons "Use picture: <title>"), "Load more", and loading/empty/error states
      - an "Upload new picture" tab (MediaUploader, single image), which auto-selects the new item
      - "Remove picture", which clears the value
    - Focus returns to the trigger. The hint text is image-specific (decision 14).
    - For the About photo, picking an item with alt text also fills the empty `aboutImageAltEn`/`aboutImageAltNe` inputs (via `form.elements`; existing values are never overwritten).
14. **Hints (fixes the review NIT).** `src/components/admin/UploadHint.tsx` is rewritten. `UPLOAD_HINT` is deleted so no generic hint can come back.
    - `IMAGE_FIELD_HINT`: "Choose a picture from the media library or upload a new one. You can also paste an image link (https://…) or a site path such as /brand/logo-mark.png."
    - `MEDIA_LINK_HINTS`:
      - IMAGE: "Paste a link to a JPEG, PNG or WebP picture, or upload the file in the Media library."
      - AUDIO: "Paste a link to an MP3 or M4A file, or upload the file in the Media library."
      - VIDEO_EMBED: "Paste a YouTube link. Video files can't be uploaded; put videos on YouTube first."
    - `THUMBNAIL_HINT`: IMAGE_FIELD_HINT + " Upload a thumbnail rather than linking to YouTube's image, so visitors' browsers don't contact YouTube before they press play." This closes the Phase 3 review LOW at the admin level.
    - `UploadNoteCard({ mode })` (keeps `data-testid="upload-note"`):
      - mode local/blob: "Upload pictures (JPEG, PNG or WebP, up to 8 MB) and audio (MP3 or M4A, up to 100 MB) with Upload files on the Media library page. Videos are added as YouTube links."
      - mode disabled: "File uploads are not set up yet. You can paste links for now; see README > Setting up Vercel Blob."
15. **Roles.**
    - Upload, register, library read, gallery management and media delete are ADMIN (OWNER + EDITOR), because editors manage content today (media actions are already ADMIN).
    - The logo picker lives on the owner-only Settings page (`requireOwnerPage`), and `updateSiteSettingsAction` stays OWNER.
16. **Limits.**
    - Batch size: at most 10 files at a time in the library and 1 in a picker.
    - Text limits: title 160, alt 300, original filename 200 (sanitized with `sanitizeSingleLine` from `src/lib/sanitize-text.ts`), gallery title 160 and description 1000. A gallery holds at most 200 items.
    - Client-reported width/height are integers 1..10000. They are used only for layout.
    - No separate upload rate limit: the endpoints need an authenticated admin with TOTP, and the size caps bound the abuse. Recorded as a known limitation.

## Plan

- [ ] 1. Dependency and configuration (no behaviour change yet)
  - `npm install @vercel/blob@2.8.2`. `.npmrc` has `save-exact=true`. Confirm that `package.json` shows `"@vercel/blob": "2.8.2"` and that `package-lock.json` changed only for it and its deps. Run `npm audit --omit=dev` and record the output, but don't fix anything here.
  - `next.config.ts`:
    - add the `images` block from decision 12
    - add `{ source: "/api/admin/:path*", headers: adminHeaders }`
    - add `{ source: "/api/uploads/:path*", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }] }`
  - `playwright.config.ts` webServer `env`: add `BLOB_READ_WRITE_TOKEN: ""`, `LOCAL_UPLOAD_DIR: ".local/uploads-e2e"`, and `VERCEL: ""` (so the mode is local even on a Vercel-like shell).
  - `vitest.config.mts`: add `BLOB_READ_WRITE_TOKEN: ""` to the db project env.
  - `scripts/e2e-prepare.ts`, after the fence check: `rmSync(path.join(ROOT_DIR, ".local", "uploads-e2e"), { recursive: true, force: true })`. Only that exact path, built from `ROOT_DIR`, is removed.
  - `.env.example`: replace the "Phase 7 placeholder" with a "Media uploads" section:
    - `# BLOB_READ_WRITE_TOKEN=` (Vercel Blob read-write token. Empty locally means files go to `.local/uploads`. On Vercel, empty means uploads are disabled and links still work.)
    - `# LOCAL_UPLOAD_DIR=` (dev only, default `.local/uploads`)
    - No values.
  - **Files:** `package.json`, `package-lock.json`, `next.config.ts`, `playwright.config.ts`, `vitest.config.mts`, `scripts/e2e-prepare.ts`, `.env.example`.
  - **Verify:** `npm run typecheck` and `npm run lint` exit 0. `npm run build` exits 0 (the images config is accepted).

- [ ] 2. Schema, migration, seed and the public gallery queries (one buildable step, because dropping `eventId` breaks its users)
  - **Schema** (`prisma/schema.prisma`):
    - `enum StorageDriver { LOCAL VERCEL_BLOB }`.
    - The `Gallery` model per decision 2.
    - `MediaItem`:
      - remove `eventId`/`event` and `@@index([eventId, status, sortOrder])`
      - add `galleryId String?`, `gallery Gallery? @relation(fields: [galleryId], references: [id], onDelete: SetNull)`, plus the storage columns from decision 1 (`storageKey String? @unique`)
      - add `@@index([galleryId, status, sortOrder])`
      - comment `sortOrder` as "order inside its gallery"
    - `Event`: replace `media MediaItem[]` with `galleries Gallery[]`.
    - Replace the `TODO(Phase 7)` comments on `coverImageUrl`/`logoUrl`/`aboutImageUrl`/`url`/`thumbnailUrl` with "https URL or site path; filled by the media picker (uploads live in MediaItem)".
  - **Migration:**
    1. `npm run db:status`. If Postgres is stopped, run `npm run db:start` and record that you started it.
    2. **Read-only pre-check and snapshot.** A one-off `npx tsx -e` script using `createPrismaClient(process.env.DATABASE_URL)` from `src/lib/prisma-factory.ts` must assert that the URL contains `/mission_dev`. It prints:
       - the OWNER count
       - `ministryName` and `logoUrl`
       - the `MediaItem` count
       - the count of IMAGE rows with `eventId`
       - the count of non-IMAGE rows with `eventId`

       It writes `{ id, type, eventId, sortOrder, status }` of every MediaItem with an eventId to `.local/backups/mission_dev-pre-phase7.json` (git-ignored). Use `$queryRaw`, because the generated client may already be regenerated. Record the output in verification.md.
    3. `npx prisma migrate dev --create-only --name phase7_media_galleries`. If Prisma refuses because of the data-loss warning in the non-interactive shell, don't force anything. Instead:
       - create the folder `prisma/migrations/<UTC yyyymmddHHMMSS>_phase7_media_galleries/` by hand
       - generate the SQL read-only with `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script --output "<folder>/migration.sql"`
       - if `--from-migrations` needs a shadow DB, use `--from-config-datasource` (mission_dev's state equals the migrations; confirm first with `npx prisma migrate status`)
    4. **Hand-edit** the SQL so the order is:
       1. `CREATE TYPE "StorageDriver"`, `CREATE TABLE "Gallery"`, `ALTER TABLE "MediaItem" ADD COLUMN …`.
       2. The data copy:
          - `INSERT INTO "Gallery" ("id","titleEn","titleNe","eventId","status","publishedAt","isDemo","createdAt","updatedAt") SELECT 'gallery-' || e."id", e."titleEn", e."titleNe", e."id", 'PUBLISHED', now(), e."isDemo", now(), now() FROM "Event" e WHERE EXISTS (SELECT 1 FROM "MediaItem" m WHERE m."eventId" = e."id" AND m."type" = 'IMAGE') ON CONFLICT ("id") DO NOTHING;`
          - `UPDATE "MediaItem" SET "galleryId" = 'gallery-' || "eventId" WHERE "eventId" IS NOT NULL AND "type" = 'IMAGE';`
       3. Then drop the old FK, index and column.
       4. Then create the new indexes, the unique index on `storageKey` and the FKs (`Gallery_eventId_fkey` ON DELETE SET NULL, `MediaItem_galleryId_fkey` ON DELETE SET NULL).

       Then review the SQL. It must contain no other DROP, no TRUNCATE and no DELETE.
    5. Apply with `npm run db:migrate`. **If Prisma reports drift or asks to reset, stop.** Don't confirm and don't reset. Record the message and investigate.
    6. Post-check (read-only, same script style): the owner, settings and media counts are unchanged, gallery-item count = the pre-check IMAGE-with-eventId count, and the galleries listed match the snapshot. Record it.
  - **Seed / demo:**
    - `src/content/demo/types.ts`: replace `eventId` with `galleryId`.
    - `src/content/demo/media.ts`: photos 1–3 get `galleryId: "gallery-event-4"`.
    - Add a `demoGalleries` export. Its one gallery has `id: "gallery-event-4"`, eventId `event-4`, title copied from the demo event-4 title (en/ne), PUBLISHED and `isDemo: true`. Don't invent new text.
    - `prisma/seed-lib.ts`: upsert the galleries (`update: {}`) **before** the media, and set `galleryId`/`sortOrder` on the media `create`.
  - **Public data layer:**
    - `src/lib/content-mappers.ts`:
      - `MediaView` gets `galleryId` (replaces `eventId`) plus `width`/`height`.
      - Replace `groupPhotoGalleries` with `toPhotoGroups(galleries, otherPhotos)`, which returns `PhotoGroup = { id: string; title: string; description: LocalizedBlock | null; event: { title; slug } | null; items: MediaView[] }`. The "other" group has `id: "other"`.
      - Items are sorted by `sortOrder`, then `publishedAt`, then `id`.
    - `src/lib/content.ts`:
      - `getPublishedEventBySlug` includes `galleries: { where: { status: "PUBLISHED" }, orderBy: [{ publishedAt: "asc" }, { id: "asc" }], include: { items: { where: { status: "PUBLISHED", type: "IMAGE" }, orderBy: [sortOrder, publishedAt, id] } } }` and returns the flattened `gallery: MediaView[]`. The page is unchanged.
      - `getMediaCenter` loads PUBLISHED galleries (newest `publishedAt` first, max 12) with PUBLISHED IMAGE items (max 24 each) and their event (only when `publishStatus = PUBLISHED`), plus PUBLISHED IMAGE items with `galleryId: null` as "other".
    - `src/app/[locale]/media/page.tsx`:
      - the group heading becomes `group.title`, or `t("otherPhotos")` for the "other" group
      - when `group.event` is set, a link line `t("fromEvent", { title })` to `/missions/<slug>` (existing keys)
      - the optional description goes below with the right `lang`
      - the group id is `gallery-${group.id}`
  - **Admin compile fixes (behaviour moves to item 8):**
    - Remove `eventId` from `src/lib/validation/media.ts` (`commonFields`) and from `src/server/services/media.ts` (`assertEventExists`, `EVENT_GONE_MSG`, `commonColumns`).
    - Remove the "Linked mission/event" select and the `events` prop from `MediaEditor.tsx`, and keep "Order in gallery".
    - Update `src/app/admin/(dashboard)/media/new/page.tsx` and `media/[id]/page.tsx`, which pass `events`.
    - Keep `listEventOptions` in `src/server/services/events.ts`; galleries use it.
  - **Tests updated here** (list each in verification.md):
    - `src/lib/validation/admin.test.ts`: the "media eventId and sortOrder" block becomes a sortOrder-only block.
    - `src/lib/content-mappers.test.ts`: `toPhotoGroups` covers order, the other group, and description fallback with `lang`.
    - `src/lib/content.db.test.ts`: mission gallery = PUBLISHED items of PUBLISHED linked galleries in order. A draft gallery is hidden, a draft item is hidden, and a video in a gallery is ignored. Media Center groups by gallery, and draft-gallery photos are not in "other".
    - `src/server/actions/actions.db.test.ts`: remove the two eventId cases and add "sortOrder persists".
    - `prisma/seed.db.test.ts`: demo photos are in `gallery-event-4` in order, the gallery is PUBLISHED and isDemo, and seeding twice is idempotent.
    - `src/test/factories.ts`: add `makeGallery(data)`, and `makeMedia` accepts `galleryId`.
  - **Files:** `prisma/schema.prisma`, `prisma/migrations/<ts>_phase7_media_galleries/migration.sql`, `prisma/seed-lib.ts`, `src/content/demo/{types,media}.ts` (+ `galleries` export), `src/lib/content-mappers.ts`, `src/lib/content.ts`, `src/app/[locale]/media/page.tsx`, `src/lib/validation/media.ts`, `src/server/services/media.ts`, `src/components/admin/editors/MediaEditor.tsx`, `src/app/admin/(dashboard)/media/{new,[id]}/page.tsx`, `src/test/factories.ts`, and the tests listed above.
  - **Verify:**
    - `npm run typecheck` exits 0.
    - `npx prisma migrate status` reports up to date.
    - The post-check matches.
    - `npm test` passes.

- [ ] 3. Pure upload policy, URL/origin helpers and Zod schemas, with unit tests
  - `src/lib/uploads/policy.ts`:
    - constants: `UPLOAD_KINDS`, `IMAGE_MAX_BYTES`, `AUDIO_MAX_BYTES`, `ALLOWED` (kind -> mime -> exts), `MAX_FILES_PER_BATCH = 10`
    - `normalizeMime(type)`
    - `classifyUpload({ filename, contentType, size, kind? })` -> `{ ok: true; kind; mime; ext } | { ok: false; reason: "empty" | "type" | "size" | "name" | "kind"; message }`. Messages are English, admin-facing, e.g. "Pictures can be at most 8 MB." and "Only JPEG, PNG and WebP pictures or MP3 and M4A audio can be uploaded."
    - `sniffMime(bytes: Uint8Array)` -> a mime or null (decision 6)
    - `matchesSniff(mime, bytes)`
    - `safeBaseName(filename)`: NFKD, ASCII-fold, lower-case, `[^a-z0-9]+` -> `-`, trim, max 60, fallback `file`
    - `buildLocalKey(kind, ext, now, random10)` and `isLocalKey(key)`
    - `blobPathname(kind, filename)` and `isBlobPathname(path)`
    - `titleFromFilename(filename)` (strip the extension, separators -> spaces, max 160)
    - `fitWithin(w, h, max = 2560)` -> `{ width, height }`
  - `src/lib/image-src.ts`: `isBlobUrl(url)` (https + host regex `^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$`) and `isOptimizableSrc(src)` (decision 12).
  - `src/lib/same-origin.ts`: `isSameOrigin(headers: Headers, origin: string)`.
  - `src/lib/storage-mode.ts`: `resolveStorageMode(env)` -> `"blob" | "local" | "disabled"` (decision 4).
  - `src/lib/validation/uploads.ts`:
    - `registerUploadSchema`: discriminated on `kind`. IMAGE needs `altTextEn: requiredText(300)`. AUDIO strips alt.
      - `ref: z.string().trim().min(1).max(600)`
      - `titleEn: requiredText(160)`, `titleNe: optionalText(160)`
      - `altTextNe: optionalText(300)`
      - `width`/`height`: optional coerced int 1..10000
      - `originalFilename`: optionalText(200)
      - `galleryId`: optional id
      - `publish: checkbox()`
    - `libraryQuerySchema` (`kind` image|audio, `q` max 100, `page` 1..1000, with `.catch` defaults).
  - `src/lib/validation/galleries.ts`:
    - `gallerySchema` (`titleEn`/`titleNe`, `descriptionEn`/`descriptionNe` optionalText(1000), optional `eventId`, `intent`)
    - `updateGallerySchema` (+id), `galleryStatusSchema`
    - `galleryAddItemsSchema` (`galleryId`, `mediaIds: idList(50)` with at least 1)
    - `galleryMoveSchema` (`galleryId`, `mediaId`, `direction: z.enum(["up","down"])`)
    - `galleryRemoveItemSchema`
  - Add all six modules to `PURE_MODULES`.
  - **Tests:**
    - `src/lib/uploads/policy.test.ts`:
      - Each allowed type is accepted, at the size limit exactly and at 1 byte.
      - 8 MiB + 1 and 100 MiB + 1 are rejected with `size`, and 0 bytes with `empty`.
      - Rejected types: `image/svg+xml` `.svg`, `image/gif`, `image/heic`, `video/mp4`, `application/zip`, `photo.jpg.exe`, and `.png` declared `image/jpeg` (extension/MIME mismatch).
      - `kind` mismatch: an mp3 sent as IMAGE.
      - `audio/x-m4a` normalizes.
      - `sniffMime` uses byte fixtures for JPEG, PNG, WebP, MP3 (ID3 and frame sync) and M4A (`ftypM4A `). HTML bytes (`<!doctype html>`), SVG text and a PNG header with a `.jpg` name all fail `matchesSniff`.
      - `safeBaseName` on `../../etc/passwd`, `C:\\x\\y.png`, Devanagari-only names (-> `file`), and 300-char names.
      - `isLocalKey` rejects `..`, backslashes, `%2e`, absolute paths, NUL, upper-case and a wrong extension.
      - `isBlobPathname` rules.
      - `fitWithin` (landscape, portrait, already small).
    - `src/lib/image-src.test.ts`, `src/lib/same-origin.test.ts` (match, mismatch, missing Origin -> false, `Sec-Fetch-Site: cross-site` -> false), `src/lib/storage-mode.test.ts`.
    - `src/lib/validation/uploads.test.ts` and `galleries.test.ts`: alt required for IMAGE only, trimming, bounds, idList max.
  - **Verify:** `npx vitest --run --project unit` passes, including `script-imports`.

- [ ] 4. Storage drivers (server-only), with unit tests
  - `src/server/storage/types.ts`: `StoredObjectInfo = { size: number; contentType: string | null; head: Uint8Array }` and `StorageDriver` = `{ name: "LOCAL" | "VERCEL_BLOB"; publicUrl(key): string; inspect(ref): Promise<{ key; url; info } | null>; remove(key, url): Promise<void> }`.
  - `src/server/storage/local.ts`: `createLocalStorage(root)` with:
    - `resolveLocalPath(root, key)` (decision 11; returns null when unsafe)
    - `writeStream(key, body: ReadableStream<Uint8Array>, maxBytes)`: `mkdir -p` for the parent, `createWriteStream(path, { flags: "wx" })`, counts bytes, aborts and unlinks the partial file when over the limit, and returns `{ size }` or throws `UploadTooLargeError`
    - `readHead(key, 32)`, `stat(key)`, `remove(key)` (`rm` with `force`), and `publicUrl(key)` = `/api/uploads/${key}`
  - `src/server/storage/vercel-blob.ts`: `createBlobStorage(token, { fetchImpl = fetch })`.
    - `inspect(url)`: requires `isBlobUrl` and `isBlobPathname(decoded pathname without the leading /)`, calls `head(url, { token })` (`BlobNotFoundError` -> null), then `fetchImpl(url, { headers: { Range: "bytes=0-31" }, signal: AbortSignal.timeout(5000) })` for the first bytes.
    - `remove(key, url)` calls `del(url, { token })`.
    - The key is the blob pathname.
  - `src/server/storage/index.ts`: `getStorageMode()` reads `process.env` at call time, and `getStorage()` returns a driver or null when disabled.
  - **Tests** (unit project, `// @vitest-environment node`):
    - `src/server/storage/local.test.ts` (temp dir from `fs.mkdtemp(os.tmpdir())`, removed in `afterAll`):
      - write/inspect/remove round trip; the `wx` flag refuses an overwrite
      - over-limit stream -> `UploadTooLargeError` and no file left
      - **path traversal**: `resolveLocalPath` returns null for `../x`, `media/images/../../x.png`, `..\\..\\x.png`, `%2e%2e/x`, `/etc/passwd`, `C:\\Windows\\win.ini`, `media/images/2026/10/a\u0000.png`, `MEDIA/…`, and a valid-looking key whose resolved path is outside the root
      - a symlink inside root pointing outside -> null. Use `it.skipIf` when `fs.symlink` throws EPERM on Windows, and record whether it ran.
    - `src/server/storage/vercel-blob.test.ts`: `vi.mock("@vercel/blob", …)`.
      - `remove` calls `del` with the URL and token.
      - `inspect` calls `head` and then the mocked fetch with the Range header.
      - A non-blob host or a bad pathname -> null without calling `head`.
      - `BlobNotFoundError` -> null.
      - No real network: a global fetch stub throws.
  - **Verify:** `npx vitest --run --project unit` passes.

- [ ] 5. Upload registration, media delete with file removal, wrapper hooks (needs 2–4)
  - `src/server/actions/run-admin-action.ts`: add optional `prepare` and `afterCommit` to `AdminActionDef` (decision 7).
    - `prepare` runs inside a try that uses `mapError` (so a DomainError becomes field errors).
    - `afterCommit` errors are logged and swallowed.
    - Existing behaviour is unchanged when they are absent.
  - `src/server/services/uploads.ts` (server-only):
    - `prepareUpload(input)`:
      1. `getStorage()`, or DomainError("CONFLICT", "File uploads are not set up yet.").
      2. Local: `isLocalKey(ref)`. Blob: `isBlobUrl(ref)`.
      3. `inspect` -> null gives VALIDATION "The uploaded file was not found. Upload it again." on `ref`.
      4. Checks the size limit for the kind, `normalizeMime(info.contentType)` (blob) or the extension MIME (local) in the allow-list, and `matchesSniff`. On failure it calls `remove` first, then throws VALIDATION "This file isn't a valid JPEG, PNG or WebP picture." / "…MP3 or M4A audio file." on `ref`.
      5. Rejects an already registered `storageKey` with CONFLICT "This file is already in the library."
      6. If `galleryId` is given, the gallery must exist (VALIDATION on `galleryId`).
      7. Returns the input plus `{ driver, key, url, mimeType, sizeBytes }`.
    - `createUploadedMedia(tx, prepared)` creates the MediaItem:
      - type IMAGE/AUDIO, category GALLERY when `galleryId` is set else GENERAL
      - `url`, the storage columns, `originalFilename` through `sanitizeSingleLine`
      - `status` PUBLISHED when `publish`, else DRAFT; `publishedAt` now
      - `sortOrder` = the gallery max + 1 when `galleryId` is set
      - returns `data: { id, url, titleEn, altTextEn, type }`
      - metadata `{ type, mimeType, sizeBytes, driver, galleryId: Boolean }`
  - `src/server/actions/uploads.ts` (`"use server";`): `registerUploadAction(_prev, formData)`, i.e. `runAdminAction({ name: "media.upload", role: "ADMIN", schema: registerUploadSchema, entityType: "MediaItem", revalidate: ["admin", "public"], successMessage: "File uploaded.", prepare: prepareUpload, run: createUploadedMedia })`.
  - `src/server/services/media.ts`:
    - `findMediaUsages(tx, url)` -> `string[]` of labels (decision 8).
    - `deleteMedia` selects the storage columns. When `storageKey` is set and there are usages, it throws CONFLICT. It returns `data: { stored: { driver, key, url } | null }`, with metadata `{ titleEn, hadFile }` (titleEn already exists).
    - `updateMedia` enforces decision 9.
    - `listMedia` adds `url`, `altTextEn`, `storageDriver`, `mimeType`, `sizeBytes` to its select for the grid, plus an optional `source: "upload" | "link"` filter.
  - `src/server/actions/media.ts`: `deleteMediaAction` adds `afterCommit: (r) => removeStoredFile(r.data?.stored)`. `removeStoredFile` (in `src/server/storage/index.ts`) picks the driver by the row's `storageDriver`. If that driver is not currently configured (e.g. a LOCAL file after switching to Blob), it logs `media.file.delete_skipped` and does nothing. On a success redirect, `data` is never returned to the client.
  - **Tests** (db project):
    - `src/server/services/uploads.db.test.ts`. Use `vi.stubEnv("LOCAL_UPLOAD_DIR", tmp)` and `vi.stubEnv("BLOB_READ_WRITE_TOKEN", "")`, and write fixture files into tmp with the driver.
      - OWNER and EDITOR register a PNG -> a DRAFT IMAGE row with `storageDriver LOCAL`, `mimeType image/png`, `sizeBytes`, the URL `/api/uploads/…`, and an audit row `media.upload` whose metadata JSON contains no filename or alt text.
      - `publish=on` -> PUBLISHED.
      - IMAGE without alt -> VALIDATION on `altTextEn`. AUDIO without alt -> ok.
      - HTML bytes named `.png` -> VALIDATION, **the file is removed**, and there is no row.
      - Unknown key -> VALIDATION. Traversal key -> VALIDATION. Re-registering the same key -> CONFLICT.
      - No session -> UNAUTHENTICATED, no row, the file is untouched.
      - With `vi.stubEnv("VERCEL","1")` and no token -> CONFLICT "not set up".
      - Blob mode (token stubbed, `vi.mock("@vercel/blob")` + mocked fetch): registers a blob URL; `head` reporting `image/svg+xml` -> VALIDATION and `del` was called.
    - Extend `src/server/actions/actions.db.test.ts`:
      - Deleting an uploaded item removes the row **and the file** (local), and calls `del` for a VERCEL_BLOB row (mocked).
      - An item used as a post cover / the site logo -> CONFLICT naming the usage; the row and file remain.
      - A pasted-link item deletes with no storage call.
      - `afterCommit` failure (mock `remove` throwing) still returns ok and logs.
      - Updating an uploaded item can't change its url or type.
    - A wrapper test, `src/server/actions/run-admin-action.db.test.ts` (new): `prepare` DomainError -> field error and no audit row; `afterCommit` runs only on success.
    - `guard-coverage.test.ts` needs no change. Confirm it covers `uploads.ts`.
  - **Verify:** `npm test` passes.

- [ ] 6. Route handlers and their authz (needs 3–5)
  - `src/server/auth/route-guard.ts` (server-only): `requireAdminRoute(request, { mutation })` per decision 10. It logs `admin.route.denied { path, code }` with no IP.
  - `src/app/api/admin/uploads/local/route.ts`, `POST`:
    1. Guard (mutation).
    2. Mode must be `local`, else 503 `{ error: "UPLOADS_DISABLED" }`.
    3. `kind` from the query (Zod).
    4. `X-File-Name` decoded (max 200) and `Content-Type`.
    5. `Content-Length` is required (411) and must be ≤ the kind limit (413).
    6. `classifyUpload` -> 415 with `{ error: "TYPE", message }` / 413.
    7. `buildLocalKey`, then `writeStream(key, request.body, limit)`. A lying length that overflows -> 413 and the partial file is removed.
    8. `readHead` + `matchesSniff` -> 415 and the file removed.
    9. `201 { key, url, size, mime }`.

    It never writes before the guard and checks pass.
  - `src/app/api/admin/uploads/blob/route.ts`, `POST`:
    1. Mode must be `blob` (else 404).
    2. `const body = await request.json()` (try/catch -> 400). `body.type` must be `"blob.generate-client-token"`, else 400.
    3. Guard (mutation).
    4. `handleUpload({ body, request, token: process.env.BLOB_READ_WRITE_TOKEN, onBeforeGenerateToken })`. `onBeforeGenerateToken` calls `requireAdmin()` again, parses `clientPayload` with Zod (`{ kind }`), requires `isBlobPathname(pathname)` with an extension matching `kind`, and returns `{ allowedContentTypes: ALLOWED[kind] mimes (+ "audio/x-m4a" for AUDIO), maximumSizeInBytes: limit, addRandomSuffix: true, allowOverwrite: false, cacheControlMaxAge: 31536000, validUntil: Date.now() + 10 * 60_000 }`. Its errors give 400 `{ error }` with no internals.
    5. Returns `NextResponse.json(result)`.
  - `src/app/api/admin/media/library/route.ts`, `GET`:
    - Guard (non-mutation) and `libraryQuerySchema`.
    - Returns up to 24 IMAGE (or AUDIO) items with a safe URL, newest first, searching `titleEn`/`titleNe`/`altTextEn`: `{ items: [{ id, title, url, alt, status, uploaded, width, height }], page, pageCount }`.
    - `Cache-Control: no-store`.
  - `src/app/api/uploads/[...key]/route.ts`, `GET`/`HEAD`: decision 11. In blob or disabled mode it returns 404.
  - **Tests:**
    - `src/app/api/route-guard-coverage.test.ts` (unit, node env, static): every `route.ts` under `src/app/api/admin/` exports only `GET`/`POST` functions whose body contains `requireAdminRoute(`. POST bodies must pass `mutation: true`.
    - `src/app/api/admin/uploads/routes.db.test.ts` (db project; build `new NextRequest("http://localhost/api/admin/uploads/local?kind=IMAGE", { method: "POST", headers, body, duplex: "half" })`; `testRequest.headers` is not used by route handlers, only the request object):
      - Local route:
        - no session -> 401, and the upload dir is still empty
        - session + `Origin: https://evil.example` -> 403
        - missing Origin -> 403
        - SVG -> 415, `Content-Length` > 8 MiB -> 413
        - body larger than its declared length / over the limit -> 413 with no file left
        - PNG with HTML bytes -> 415 with no file left
        - valid PNG -> 201, the file exists under the temp root, and the key matches `isLocalKey`
        - EDITOR -> 201
        - deactivated user / bumped `sessionVersion` -> 401
      - Blob token route (`vi.mock("@vercel/blob/client")`, capturing `onBeforeGenerateToken`):
        - not blob mode -> 404
        - no session -> 401 and `handleUpload` not called
        - cross-origin -> 403
        - wrong body type -> 400
        - valid -> `handleUpload` called; invoking the captured callback returns the image MIME list and 8 MiB for IMAGE, and the audio list and 100 MiB for AUDIO
        - the callback rejects `media/images/x.mp3`, `../x.png` and an invalid `clientPayload`
      - Library route: no session -> 401; owner/editor -> 200 with only IMAGE items; drafts included; `kind=audio` works.
      - Serving route:
        - written file -> 200 with the extension content type, `nosniff`, a `sandbox` CSP
        - `Range: bytes=0-9` -> 206 with `Content-Range`, a bad range -> 416
        - traversal segments (`["..","..","package.json"]`, `["media","images","..","..","..","package.json"]`) -> 404
        - unknown key -> 404
        - blob mode -> 404
  - **Verify:** `npm test` passes. `npm run build` exits 0 (the route handlers compile under Turbopack).

- [ ] 7. `next/image` on public pages (needs 1, 3)
  - Create `src/components/ui/SiteImage.tsx` per decision 12 and export it from `src/components/ui/index.ts`.
  - Replace the `<img>` tags, giving `fill` parents `relative` and keeping the current aspect classes so the layout doesn't move:
    - `src/components/public/PostCard.tsx`, `EventCard.tsx`
    - `src/app/[locale]/devotionals/[slug]/page.tsx` and `missions/[slug]/page.tsx` cover (`priority`)
    - `src/app/[locale]/about/page.tsx` photo
    - `src/components/home/FeaturedContent.tsx`
    - `src/components/public/YouTubeFacade.tsx` thumbnail
    - `src/components/public/PhotoGallery.tsx`: thumbnails use `fill` with `sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw"`. The lightbox image uses `width`/`height` when known, else the SiteImage `<img>` fallback.

    Remove every `TODO(Phase 7): next/image` comment. `GalleryPhoto` gains optional `width`/`height`, filled from `MediaView` on the media and mission pages.
  - **Tests:**
    - `src/components/ui/SiteImage.test.tsx`: a blob URL renders a `/_next/image?url=` src, while SVG and `/api/uploads/...` render the raw src. Alt is passed through and an empty alt stays decorative.
    - Existing `PhotoGallery.test.tsx` and `YouTubeFacade.test.tsx` still pass. Adjust selectors only if the markup changed, and record it.
  - **Verify:** `npm test` passes. `npm run build` exits 0. `npm run lint` passes, with `no-img-element` disables only in SiteImage, Header and Footer.

- [ ] 8. Admin upload UI, media library grid, picker fields, hint fix (needs 5–7)
  - `src/components/admin/uploads/upload-client.ts` (client): `uploadFile(file, { mode, kind, onProgress, signal })` -> `{ ref }`, local XHR or blob `upload()` per decision 5. It maps HTTP 401/403/413/415/503 to friendly messages, e.g. 401 "Your session has expired. Please sign in again."
  - `src/components/admin/uploads/prepare-image.ts` (client): canvas re-encode using `fitWithin` -> `{ file, width, height }`.
  - `src/components/admin/uploads/MediaUploader.tsx` (client). Props: `mode`, `accept: "image" | "image+audio"`, `multiple`, `galleryId?`, `defaultPublish`, `onUploaded?(item)`.
    - Drop zone: a dashed `div` with instructions "Drag pictures or audio here, or" plus a "Choose files" button. The button is a `<label>` for a visually hidden `<input type="file">` with the `accept` attribute set from the policy. The input has `aria-describedby` pointing to the limits text "JPEG, PNG or WebP up to 8 MB; MP3 or M4A up to 100 MB." The label shows a focus ring through `peer-focus-visible`. A drag-over state is shown.
    - Each chosen file becomes a card with:
      - a preview (object URL, revoked on unmount) or an audio icon
      - the file name and size
      - `TextField`-style inputs: Title (prefilled with `titleFromFilename`), "Picture description (alt text) (English)" required for images, Nepali optional with `lang="ne"`
      - a "Publish on the public site" checkbox (default `defaultPublish`)
      - client-side `classifyUpload` errors shown with `FieldError` + `role="alert"` (this file is not uploaded)
    - "Upload" is disabled until the required fields are filled. While uploading it shows `<progress max=100 value>` with a visible "Uploading… 42%" label and a `aria-live="polite"` announcement at 0/25/50/75/100. A "Cancel" button aborts it (AbortController).
    - When done, it calls `registerUploadAction` through `useTransition`. Success shows "Uploaded." and calls `onUploaded`. A failure shows the action's message, and focus moves to that card's error.
    - Files upload one after another. At most 10 files per batch; the rest are refused with a message.
    - `mode === "disabled"` renders the disabled `UploadNoteCard` only.
  - `src/app/admin/(dashboard)/media/page.tsx` becomes **Media library**.
    - `PageHeader` "Media library" with "Add a link" (`/admin/media/new`).
    - A collapsible `EditorSection`-styled "Upload files" panel (`MediaUploader`, image+audio, multiple; after success `router.refresh()`), plus `UploadNoteCard mode`.
    - `ListToolbar` filters type/category/status plus a "Source" filter (Uploaded / Link) through `parseListQuery`.
    - A responsive grid `<ul aria-label="Media">` (2/3/4 columns at 375/768/1280). Each card shows:
      - a thumbnail (SiteImage `fill`, aspect 4/3, alt = alt text) or a type icon tile for audio/video
      - the title linking to the editor
      - StatusBadge, type/category badges, "Uploaded · 1.2 MB" or "Link"
      - the existing Publish/Unpublish `InlineAction` and Delete `ConfirmDialog` (accessible labels unchanged, e.g. `Unpublish <title>`)
    - Empty state and `ListSkeleton` stay as they are.
  - `src/app/admin/(dashboard)/media/new/page.tsx`: "Add a link" (pasted links only), with a note linking to the library upload.
  - `MediaEditor.tsx` / `MediaTypeFields.tsx`:
    - Use `MEDIA_LINK_HINTS[type]`.
    - For an uploaded item, render the "Stored file" panel with hidden `type` and `url` inputs (decision 9).
    - `thumbnailUrl` becomes `MediaPickerField` with `THUMBNAIL_HINT`.
    - The "Order in gallery" hint becomes "Lower numbers come first inside its gallery. Manage galleries under Galleries."
  - `src/components/admin/MediaPickerField.tsx` per decision 13. It fetches `/api/admin/media/library?kind=image`.
  - Wire the picker in:
    - `PostEditor.tsx` (`coverImageUrl`, label "Cover picture")
    - `EventEditor.tsx` (`coverImageUrl`, label "Cover picture")
    - `settings/page.tsx` (`logoUrl`, label "Logo picture (optional)", hint IMAGE_FIELD_HINT + " A transparent PNG works best." ; `aboutImageUrl` with alt autofill)

    Each passes `mode={getStorageMode()}`. `UPLOAD_HINT` disappears from the codebase.
  - **Tests (unit, jsdom):**
    - `src/components/admin/UploadHint.test.tsx`: IMAGE_FIELD_HINT, THUMBNAIL_HINT and MEDIA_LINK_HINTS.IMAGE/AUDIO don't contain "YouTube link", except VIDEO_EMBED and THUMBNAIL's privacy sentence; the disabled note text.
    - `src/components/admin/uploads/MediaUploader.test.tsx` (mock `upload-client` and the action):
      - rejected SVG shows an alert and never calls upload
      - Upload is disabled until alt text is filled
      - progress updates render the percentage
      - success calls `onUploaded`
      - an 11th file is refused
    - `src/components/admin/MediaPickerField.test.tsx` (mock `fetch`):
      - opening loads items
      - choosing sets the input value and closes, with focus back on the trigger
      - empty and error states
      - "Remove picture" clears the value
      - the alt autofill doesn't overwrite existing values
  - **Verify:** `npm test` passes. `npm run typecheck` and `npm run lint` exit 0.

- [ ] 9. Galleries admin (needs 2, 5, 8)
  - `src/server/services/galleries.ts` (server-only):
    - `listGalleries(query)` (q, status, paginated; each with event title and item count) and `getGallery(id)` (items ordered, with status/url/alt).
    - Mutations with `(tx, input, actor)`:
      - `createGallery` and `updateGallery` (event must exist -> VALIDATION on `eventId`; `publishedAt` set on the first publish)
      - `setGalleryStatus`
      - `deleteGallery` (items SetNull; metadata `{ items }`)
      - `addGalleryItems`: each id must be IMAGE with a safe url and alt text, else VALIDATION "Only pictures with a description can be added." Moving from another gallery is allowed (metadata `{ added, moved }`). Appended `sortOrder`; max 200 items -> LIMIT.
      - `moveGalleryItem`: renumbers 0..n-1 after swapping with the neighbour; at an edge it is a no-op with `{ moved: false }`.
      - `removeGalleryItem`: `galleryId = null`.
  - `src/server/actions/galleries.ts` (`"use server";`). All are `runAdminAction` with role ADMIN, entityType `Gallery`, revalidate `["public","admin"]`:
    - `createGalleryAction` (redirect `/admin/galleries/<id>?toast=created`)
    - `updateGalleryAction`, `setGalleryStatusAction`
    - `deleteGalleryAction` (redirect `/admin/galleries?toast=deleted`)
    - `addGalleryItemsAction` (FormData arrays `mediaIds`)
    - `moveGalleryItemAction`, `removeGalleryItemAction`
  - Pages under `src/app/admin/(dashboard)/galleries/`. Each uses `requireAdminPage`, the existing list/editor patterns and Suspense skeletons.
    - `page.tsx`: list with ListToolbar (q, status), RecordList rows (title, event, "12 photos", status, Publish/Unpublish, Delete), EmptyState.
    - `new/page.tsx`: `GalleryEditor` (title/description bilingual, "Linked mission/event (optional)" select from `listEventOptions`, PublishControls). `?eventId=` pre-selects.
    - `[id]/page.tsx`: the editor plus a "Photos" section:
      - an ordered list `<ol aria-label="Photos in this gallery">`
      - per row: thumbnail, title, StatusBadge + "Draft photos are not shown" hint, "Move up"/"Move down" `InlineAction`s with accessible labels `Move <title> up`, disabled at the edges, a "Publish" toggle for draft photos (`setMediaStatusAction`), and "Remove from gallery"
      - "Add pictures from library": a dialog with a multi-select checkbox grid from `/api/admin/media/library?kind=image` -> `addGalleryItemsAction`
      - "Upload new pictures": `MediaUploader` with `galleryId`, `defaultPublish` true
      - a "View on site" link to the mission when the gallery is published and linked
  - `src/components/admin/AdminNav.tsx` (and `AdminMobileNav` if it duplicates the list): CONTENT gets "Media library" (`/admin/media`) and "Galleries" (`/admin/galleries`).
  - `EventEditor.tsx` edit mode: a small "Galleries for this event" list with links, plus "New gallery for this event" -> `/admin/galleries/new?eventId=<id>`.
  - **Tests:**
    - `src/server/services/galleries.db.test.ts`:
      - every mutation without a session -> UNAUTHENTICATED (through the actions)
      - create + link an event + add 3 photos -> ordered 0,1,2; move up/down renumbers; edges are no-ops
      - adding a video or an alt-less image -> VALIDATION
      - moving between galleries
      - delete gallery -> photos stay with `galleryId` null
      - an unknown eventId -> VALIDATION
      - publish -> `getPublishedEventBySlug` shows the PUBLISHED photos in order, and unpublish hides them
      - audit metadata contains no titles beyond ids/counts
    - `guard-coverage` passes for `galleries.ts`.
  - **Verify:** `npm test` passes. `npm run build` exits 0.

- [ ] 10. E2E specs and screenshots (needs 1–9)
  - `e2e/fixtures/upload-files.ts`: base64 constants. Generate them once with a throwaway `npx tsx -e` script using the already-present sharp (don't add sharp as a dependency); the script is not committed. The constants:
    - a 320×240 PNG (navy/gold blocks)
    - a 1×1 JPEG
    - an MP3-like buffer (`ID3` header + a few frame-sync bytes)
    - an SVG text file
    - an HTML file named `.png`

    Tests pass them to `setInputFiles({ name, mimeType, buffer })`. No binary files are committed.
  - New `e2e/admin-uploads.spec.ts` (add it to the `admin-mutations` project, after `admin-content.spec.ts`; owner state; serial):
    1. **Upload an image (local driver) and use it as a post cover.**
       - `/admin/media` -> Upload files -> choose the PNG.
       - Fill the alt text "E2E uploaded photo <stamp>" and the title.
       - Upload; the progress reaches 100% and "Uploaded." shows.
       - The grid shows the card. `page.request.get(<card img src or the item url>)` returns 200 with `content-type: image/png` and `x-content-type-options: nosniff`.
       - `/admin/posts/new`: fill an ARTICLE, then Cover picture -> "Choose from library" -> search the stamp -> "Use picture: …". The input value matches `^/api/uploads/media/images/`.
       - Publish, then `/en/devotionals/<slug>` shows the cover `img` whose `src` contains `/api/uploads/media/images/` and it is visible (natural width > 0).
       - `/ne/devotionals/<slug>` -> 200.
    2. **Drag-and-drop**: dispatch `dragenter`/`drop` with a `DataTransfer` built in `page.evaluateHandle` carrying the JPEG. The card appears with its preview.
    3. **Client and server rejection**: choosing the SVG shows the "Only JPEG, PNG and WebP…" alert and no request is made. A direct `page.request.post("/api/admin/uploads/local?kind=IMAGE", { headers: { Origin: baseURL, "Content-Type": "image/png", "X-File-Name": "evil.png" }, data: htmlBytes })` returns 415.
    4. **Delete protection, then delete**: deleting the cover's media item from the library -> an error toast naming the post. Clear the post's cover and update, then delete again -> success, and a GET of the file URL now returns 404.
    5. **Gallery**:
       - Upload a fresh photo.
       - Create gallery "E2E gallery <stamp>" linked to "Sample mission trip to a village community" (`event-1`).
       - Add the photo plus a second library photo; move the second up; publish the gallery and photos.
       - `/en/missions/sample-mission-trip` shows `Open photo: <alt>` buttons in the new order; the lightbox opens and Escape closes it.
       - `/en/media` shows the gallery heading with the "From: …" link.
       - Delete the gallery -> the photos disappear from the mission page.
    6. **Audio**: upload the MP3 buffer; the card shows "Audio · Uploaded"; its editor shows `<audio controls>`.
    7. **Logo picker (no save)**: `/admin/settings` -> Logo picture -> choose from library -> the input value is set -> reload without saving, so the header is never changed in mission_test.
    8. **axe** (reuse the `seriousViolations` pattern from `e2e/admin-a11y.spec.ts`) on `/admin/media`, the upload panel with a selected file, the picker dialog open, `/admin/galleries`, `/admin/galleries/<id>` and an uploaded item's editor. All must have `serious/critical = 0`.
  - New `e2e/upload-access.spec.ts` (add it to the `admin-readonly` project; it writes nothing):
    - Anonymous `request`:
      - `POST /api/admin/uploads/local?kind=IMAGE` (PNG bytes) -> 401
      - `POST /api/admin/uploads/blob` -> 404 (blob mode is off in E2E; the 401 path is proven in the db tests)
      - `GET /api/admin/media/library` -> 401
      - `/admin/media` and `/admin/galleries` redirect to `/admin/login?next=…`
    - Owner state with `Origin: https://evil.example` -> 403 on the local route.
    - `GET /api/uploads/..%2F..%2Fpackage.json` and `/api/uploads/media/images/2026/01/nope-aaaaaaaaaa.png` -> 404.
    - The responses carry `Cache-Control: no-store` on `/api/admin/*`.
  - **Update existing specs** (record each):
    - `e2e/admin-access.spec.ts`: the upload-note expectation becomes the new text.
    - `e2e/admin-content.spec.ts`: "a photo linked to an event appears in its gallery" is rewritten to a pasted-link photo + new gallery linked to `event-1` + publish + visible + delete gallery -> gone.
    - `e2e/admin-screenshots.spec.ts`: the media editor screenshot waits for "Order in gallery" instead of the removed select.
    - Phase 3 specs (`missions.spec.ts` expects 3 demo gallery thumbs; `media-center.spec.ts`) must pass unchanged thanks to the seeded `gallery-event-4`.
  - New `e2e/phase7-screenshots.spec.ts` (`admin-mutations`, last) saves to `c:\Users\rasaily\Downloads\mission app\.agents\screenshots\phase7\`. Each capture: fonts ready, `scrollWidth <= viewport`, scroll the target into view before capture (avoids the Phase 3 lazy-image/sticky-header artefacts), eager images.
    - Admin at 375 and 1280:
      - `admin-media-library-{375,1280}.png` (grid with uploads)
      - `admin-upload-selected-{375,1280}.png` (file card with alt field)
      - `admin-upload-done-1280.png`
      - `admin-media-picker-{375,1280}.png` (dialog open)
      - `admin-post-cover-picked-1280.png`
      - `admin-galleries-1280.png`
      - `admin-gallery-editor-{375,1280}.png`
      - `admin-media-uploaded-editor-1280.png`
    - Public, en + ne, at 375 and 1280:
      - `devotional-uploaded-cover-{en,ne}-{375,1280}.png`
      - `mission-gallery-{en,ne}-{375,1280}.png`
      - `media-galleries-{en,ne}-{375,1280}.png`
      - `header-unchanged-en-1280.png` (top of `/en`, to compare with the Phase 6 header)
  - **Verify:** `npm run test:e2e`: all pass (232 baseline + new). Every `[axe]` line has `serious/critical=0`. The screenshots exist.

- [ ] 11. Documentation
  - `README.md`:
    - Phase status: Phase 7 done.
    - **"Setting up Vercel Blob (media uploads)"**, written for a non-technical owner:
      1. In the Vercel project go to Storage -> Create -> Blob, and choose **Public** access (the site shows the files directly).
      2. Connect it to Production/Preview (and Development if you want real uploads locally).
      3. Make sure `BLOB_READ_WRITE_TOKEN` is set. Client uploads need this static token.
      4. Redeploy.

      Also explain: without the token, uploads in local dev go to `.local/uploads` (not backed up, never committed), and on Vercel uploads are switched off and links still work. Files uploaded locally are not moved to Blob, so upload them again in production.
    - Admin guide: "Uploading pictures and audio" (limits, alt text, location data removed from photos, drafts vs published, "only upload photos of people who agreed; be careful with faces and places that could put believers at risk"), "Choosing a cover, logo or About photo from the library", "Galleries" (create, link to a mission, order, publish; draft photos hidden), "Deleting files" (blocked while in use; deleting removes the file).
    - Security notes: the upload checks (session + same-origin + allow-list + magic bytes + size), no SVG, the local route hardening, public URLs are unguessable but public.
    - Phase 9 CSP notes: `img-src` and `media-src` need `https://*.public.blob.vercel-storage.com`. Client uploads need `connect-src` for the Vercel Blob API (check the exact host in the 2.8.2 client: `vercel.com/api/blob` / `*.blob.vercel-storage.com`).
    - Environment variables table: `BLOB_READ_WRITE_TOKEN`, `LOCAL_UPLOAD_DIR`.
    - Known limitations: no automatic orphan cleanup, no upload rate limit, no video files.
  - `src/content/legal/privacy.ts` is not changed: uploads are admin content, not visitor data. Confirm it makes no claim this phase contradicts, and record that.
  - **Verify:** `npm run format:check` exits 0. The `legal.test.ts` and `messages.test.ts` suites pass.

- [ ] 12. Full verification and evidence (`.agents/tasks/phase7/verification.md`)
  1. Each must exit 0: `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build`.
  2. `npm test`: record the file/test counts versus 62/591, and list the new and rewritten tests.
  3. `npm run test:e2e`: record the passed count versus 232 and the axe lines. Don't run it at the same time as `npm test`.
  4. **Open every screenshot** under `.agents\screenshots\phase7\` and describe each one in verification.md. Check:
     - navy/ivory/beige/gold
     - no overflow at 375
     - Devanagari renders
     - the header matches Phase 6 (logo + name far left, nav centre on xl, gold CTA right)
     - the upload progress/alt UI is readable
     - picker focus states are visible
  5. Grep with PowerShell `Select-String`, because the grep tool misses paths with spaces:
     - no `S3|AWS|Amazon|Cognito|SES` outside `.agents/tasks`
     - no `UPLOAD_HINT`
     - no `TODO(Phase 7)`
     - `NEXT_PUBLIC_` only for the existing site URL and the Phase 8 placeholder
     - no `vercel_blob_rw_` token-looking strings
     - `.env` untracked (`git ls-files .env` is empty)
     - `.local/` ignored (`git check-ignore .local/uploads/x`)
  6. `git status --short` shows only the intended files: no `.local`, no screenshots, no generated client.
  7. Read-only mission_dev post-check (item 2 script): owner present, 'Bible Distribution Ministry', `logoUrl` `/brand/logo-mark.png` unchanged, gallery counts as recorded.
  8. Final notes for the user:
     - restart `npm run dev` (new dependency + Prisma client)
     - uploads in dev land in `.local/uploads`
     - create a Vercel Blob store (Public) before going live
     - the known limitations

## Files touched (summary)

- **New:**
  - `prisma/migrations/<ts>_phase7_media_galleries/migration.sql`
  - `src/lib/uploads/policy.ts`, `src/lib/image-src.ts`, `src/lib/same-origin.ts`, `src/lib/storage-mode.ts`
  - `src/lib/validation/{uploads,galleries}.ts`
  - `src/server/storage/{types,local,vercel-blob,index}.ts`
  - `src/server/auth/route-guard.ts`
  - `src/server/services/{uploads,galleries}.ts`, `src/server/actions/{uploads,galleries}.ts`
  - `src/app/api/admin/uploads/local/route.ts`, `src/app/api/admin/uploads/blob/route.ts`, `src/app/api/admin/media/library/route.ts`, `src/app/api/uploads/[...key]/route.ts`
  - `src/components/ui/SiteImage.tsx`
  - `src/components/admin/uploads/{upload-client.ts,prepare-image.ts,MediaUploader.tsx}`, `src/components/admin/MediaPickerField.tsx`, `src/components/admin/editors/GalleryEditor.tsx`
  - `src/app/admin/(dashboard)/galleries/{page,new/page,[id]/page}.tsx`
  - `src/content/demo/galleries.ts` (or an export in media.ts)
  - the tests named above
  - `e2e/fixtures/upload-files.ts`, `e2e/admin-uploads.spec.ts`, `e2e/upload-access.spec.ts`, `e2e/phase7-screenshots.spec.ts`
- **Modified:**
  - `package.json`, `package-lock.json`, `next.config.ts`, `playwright.config.ts`, `vitest.config.mts`, `scripts/e2e-prepare.ts`, `.env.example`, `README.md`
  - `prisma/schema.prisma`, `prisma/seed-lib.ts`, `src/content/demo/{types,media}.ts`
  - `src/lib/content{,-mappers}.ts`, `src/lib/validation/media.ts`
  - `src/server/services/media.ts`, `src/server/actions/{media,run-admin-action}.ts`
  - `src/components/admin/{UploadHint,MediaTypeFields,AdminNav}.tsx`, `src/components/admin/editors/{Media,Post,Event}Editor.tsx`
  - `src/app/admin/(dashboard)/{media/page,media/new/page,media/[id]/page,settings/page}.tsx`
  - the public image components/pages from item 7, `src/app/[locale]/media/page.tsx`
  - `src/test/{factories,script-imports.test}.ts`
  - the existing tests and E2E specs listed in items 2 and 10
- **Not touched:** `src/components/layout/Header.tsx` (beyond a comment), `src/proxy.ts`, auth and inbox code.

## Gaps and assumptions (recorded, not blocking)

- **Public URLs.** The Vercel Blob store must be created with **Public** access. A store created as Private would need signed reads, which this plan doesn't implement. The README states this.
- **Metadata stripping is client-side.** On the Blob path the server never sees the bytes. Uploads therefore go only through the admin UI, and the server still enforces type, size and magic bytes.
- **Orphans.** An upload that is never registered (tab closed) leaves an orphan file. It's harmless, and cleanup is documented as a limitation.
- **Local mode in production.** Local mode is for dev/test only. A non-Vercel production host without a token would store files on its own disk under `.local/uploads`. This is documented, and Vercel is the fixed target.
