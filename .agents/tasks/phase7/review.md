# Media uploads with a Vercel Blob driver and a local driver, plus galleries and library pickers

Phase 7 adds file uploads behind a storage abstraction. The `vercel-blob` driver is used when `BLOB_READ_WRITE_TOKEN` is set. Otherwise a local driver writes to the git-ignored `.local/uploads`, and on Vercel without a token uploads are disabled. Uploads become `MediaItem` rows through a guarded register action, which re-inspects the stored bytes on the server. A new `Gallery` model replaces `MediaItem.eventId` through a data-preserving migration. The URL-only cover, logo, About and thumbnail fields become a library picker that keeps the text input as a URL fallback, and public images go through a `SiteImage` wrapper around `next/image` with Blob `remotePatterns`. Verification evidence is complete: 756 unit/db tests, 252 E2E, axe, greps and 25 screenshots, all recorded in verification.md.

Watch for: the upload panels on the Media library and gallery editor are `<details>` elements with no visible disclosure marker, so the main upload entry looks like an empty card (confirmed, LOW). Blob refs are accepted from any `*.public.blob.vercel-storage.com` host, not only the configured store (confirmed in code, LOW). The `@vercel/blob` dependency adds 4 high `npm audit` findings, deferred to Phase 9 (confirmed, LOW).

**Verdict**: APPROVED

## High-level view

Server-side enforcement doesn't depend on the client. The local route classifies by extension plus declared MIME, caps the stream at the smaller of Content-Length and the kind limit, and sniffs magic bytes before answering 201. The register action's `prepare` hook then re-runs size, extension/MIME agreement and the sniff for both drivers, and deletes the object when a check fails. In Blob mode the token route also sets `allowedContentTypes` and `maximumSizeInBytes` per kind. SVG, GIF, HEIC, video and HTML disguised as PNG are all rejected, and tests cover each of these cases.

Authorization is layered. All `/api/admin/**` handlers go through `requireAdminRoute`, which returns 401 without a valid session (it reuses `getCurrentAdmin`, so deactivated users and bumped session versions are rejected) and 403 for non-same-origin mutations. A coverage test makes sure no handler skips this guard. Register, delete and the gallery mutations go through `runAdminAction` with role ADMIN, and the logo picker sits on the OWNER-only Settings page.

The local serving route answers 404 for anything that fails the strict key regex, leaves the root, or resolves through a symlink or junction (`realpath`). It sets Content-Type from the extension map only, plus `nosniff`, a `sandbox` CSP and immutable caching, and supports single ranges for audio. Delete refuses while the file is still used as a cover, logo, About photo or thumbnail. It removes the row first and the stored file in `afterCommit`, so a failed file delete leaves a harmless orphan, never a broken row.

Galleries are one-to-many with `sortOrder` renumbered on add, move and remove, link to an event with `SetNull`, and are shown publicly only when both the gallery and the photo are PUBLISHED. The migration copied existing event links into galleries before dropping the column, and mission_dev was untouched apart from that (0 rows needed migrating).

The picker keeps each field's name and its `optionalSafeUrl` schema, so the server-side validation is unchanged. It renders previews only for values that pass `isSafeUrl`. `UPLOAD_HINT` is deleted and a test makes sure no image-only hint mentions a YouTube link. `SiteImage` optimizes only Blob `/media/**` URLs and raster `/brand/` and `/demo/` files, which matches `remotePatterns`/`localPatterns`. Header and Footer keep `<img>`. `@vercel/blob` is pinned at exactly 2.8.2, nothing references AWS, and `.local/` is git-ignored.

The gaps are small. The upload panel's disclosure has no visual cue. Blob refs are not bound to the configured store host. Gallery order can also be edited through a raw "Order in gallery" number on the media editor. The transitive audit findings are recorded for Phase 9.

<details>
<summary>Issues (4)</summary>

1. **Unmarked upload disclosure** (LOW) â€” `UploadPanel` on `/admin/media` and the "Upload new pictures" panel in the gallery editor use `<summary className="flex â€¦">`, which removes the browser's â–¶ marker, so the closed panel reads as an empty card. The post editor's "Search engine details" disclosure keeps its marker. Add a chevron or "Show" affordance, or open the panel by default.
2. **Blob ref not bound to the configured store** (LOW) â€” `blobKeyOf`/`isBlobUrl` accept any `<store>.public.blob.vercel-storage.com` host. Derive the store id from the token (or from the first `head()` result) and reject other hosts in `prepareUpload`, so a foreign URL gets a clear validation error instead of depending on how `head()` behaves.
3. **Two sources of truth for gallery order** (LOW) â€” the media editor still exposes a free "Order in gallery" number, while the gallery editor renumbers 0..n-1 with Move up/down. A manual value can create ties or jumps until the next move. Hide the field for gallery items, or make it read-only there.
4. **Transitive audit findings from @vercel/blob 2.8.2** (LOW) â€” 4 high findings via `@vercel/oidc` â†’ `@vercel/cli-config` â†’ nested `zod <4.6.6`. They are recorded in verification.md. Re-check in Phase 9 and take a pinned upstream fix when one exists.

</details>

<details>
<summary>Details</summary>

### Allow-list enforcement across the two transfer paths

```
browser â”€â”€(re-encode image, strip EXIF)â”€â”€â”
  local: XHR raw body â†’ /api/admin/uploads/local â”€ classify + byte cap + sniff â†’ 201 {key}
  blob:  upload() â†’ /api/admin/uploads/blob (token: allowedContentTypes, max size) â†’ Blob
                                                        â”‚
registerUploadAction â”€â”€ prepare: inspect(ref) â†’ size, ext==MIME, sniff â”€â”€ fail â†’ delete object
                     â””â”€ tx: MediaItem(DRAFT|PUBLISHED) + AuditLog
```

`classifyUpload` falls back to the extension's type only when the declared type is blank or `application/octet-stream`, and it still requires extension and MIME to agree. The sniff reads 32 bytes, so a polyglot with a valid header passes. That residual risk is contained by how files are served: local files go out with an extension-derived Content-Type, `nosniff` and `sandbox`, and Blob files are served with the declared type that the token constrained. Both drivers end in the same `prepare`, so Blob uploads get the same magic-byte check even though the bytes never passed through the app.

Between transfer and register, an object exists in storage but not in the library. In Blob mode it is already publicly reachable at its random-suffixed URL. Verification lists "no automatic cleanup of unregistered uploads" as a known limitation, and only an authenticated admin with TOTP can create such objects.

### Blob host and store binding

`blobKeyOf` validates the pathname strictly but takes the host from a pattern shared by every Vercel Blob customer (`src/lib/image-src.ts` `BLOB_HOST_RE`). `prepareUpload` then calls `head(ref, { token })` and, on rejection, `del(url, { token })`. For a URL from another store, the result depends on how the Blob API answers a foreign URL under our token. A thrown non-NotFound error becomes the generic action error, which is safe but unhelpful. Binding the host to the configured store removes this dependency (confirmed in code; the API's exact response was not checked).

### Delete, usage check and stored-file cleanup

`removeStoredFile` skips deletion when the row's driver differs from the active one (for example a LOCAL file after switching to Blob), so those files are left behind and only `media.file.delete_skipped` is logged. The delete audit metadata still carries `titleEn`, but that predates this phase and is out of scope here.

### Gallery order edited in two places

The gallery editor renumbers items 0..n-1 on every add, move and remove. The media editor still submits a free `sortOrder` ("Order in gallery"), so an editor can set a value that ties with or jumps past its neighbours. The public order then falls back to `publishedAt`/`id` until the next Move renumbers the gallery (issue 3).

### Screenshots (opened and judged)

I opened all of these and they are on-brand navy/ivory/gold with no overflow at 375: the library grid at 1280 and 375, the uploader with a file selected (Devanagari alt text renders, Upload is disabled until required fields are filled), "Uploaded." state, the picker dialog at both widths, the post cover picked (preview, URL fallback, image-only hint), the galleries list, the gallery editor at both widths (edge Move buttons disabled), the stored-file panel, the devotional uploaded cover en/ne, the mission gallery en/ne, the Media Center galleries with gold-dark "From:" / "à¤•à¤¾à¤°à¥à¤¯à¤•à¥à¤°à¤®:" links, and the unchanged header with the logo and name at far left. The only visual issue is issue 1: in `admin-media-library-1280.png` and `admin-gallery-editor-1280.png` the closed upload panels show only a heading inside an empty card, while the post editor's "Search engine details" keeps its â–¶ marker. The sticky save bar appearing mid-page in the full-page captures is a capture artifact seen in earlier phases.

</details>

<details>
<summary>File map</summary>

- `src/lib/uploads/policy.ts`: allow-list, sniffing, key/pathname rules (pure)
- `src/lib/image-src.ts`, `src/lib/storage-mode.ts`, `src/lib/same-origin.ts`: optimizer rule, mode resolution, CSRF check (pure)
- `src/server/storage/{index,local,vercel-blob,types}.ts`: drivers, `removeStoredFile`
- `src/server/auth/route-guard.ts`: `requireAdminRoute`
- `src/app/api/admin/uploads/{local,blob}/route.ts`, `src/app/api/admin/media/library/route.ts`, `src/app/api/uploads/[...key]/route.ts`: transfer, token, picker JSON, local serving
- `src/server/actions/{uploads,galleries,media}.ts`, `src/server/services/{uploads,galleries,media,audit}.ts`, `src/server/actions/run-admin-action.ts`: register, galleries, delete with usage check, `prepare`/`afterCommit` hooks
- `prisma/schema.prisma`, `prisma/migrations/20261027043846_phase7_media_galleries/`, `prisma/seed-lib.ts`, `src/content/demo/*`: Gallery model, data-preserving migration, demo gallery
- `src/lib/content.ts`, `src/lib/content-mappers.ts`, `src/app/[locale]/media/page.tsx`: gallery-based public queries and groups
- `src/components/admin/{MediaPickerField,GalleryAddPictures,StoredFilePanel,UploadHint,MediaTypeFields}.tsx`, `src/components/admin/uploads/*`, editors, admin pages: picker, uploader, galleries UI, hints
- `src/components/ui/SiteImage.tsx` and public components: next/image
- `next.config.ts`, `playwright.config.ts`, `vitest.config.mts`, `scripts/e2e-prepare.ts`, `.env.example`, `.gitignore`, `README.md`, `package*.json`: config, env, pins
- Tests: 14 new files plus the rewritten specs listed in verification.md

Full diff: `git -C "c:/Users/rasaily/Downloads/mission app" diff` plus untracked files from `git status`.

</details>
