# Database-backed content and secure admin CMS (Phase 4 + 5)

All public content (posts, events, verses, media, site settings) now comes from PostgreSQL through Prisma 7 instead of typed demo arrays. The site owner and up to 3 editors manage it at `/admin`, which uses Auth.js v5 credentials, Argon2id and an authenticator app (TOTP). Local development runs a real PostgreSQL 17 from `embedded-postgres`, so Docker isn't needed, and a fence script stops destructive and test commands from touching a non-local database. Every admin mutation goes through one wrapper: guard, then Zod, then one transaction holding the change and its AuditLog row, then revalidation. The public site still looks the same after seeding (same header: logo + name on the left, nav in the center, gold "Support the Mission" on the right), and nothing uses AWS.

Watch for: image and YouTube links pasted in the admin are saved, but only the logo shows up on the public site in this phase (likely to surprise the user, who asked to "upload pictures and video"). The upload hint is also the same everywhere, so it suggests "a YouTube link" on image-only fields. Both are NIT; neither blocks shipping.

**Verdict**: APPROVED

## High-level view

The data swap keeps `src/lib/content.ts` function names and view models. Every query filters on `PUBLISHED` (events on `publishStatus`), and bilingual columns go through one `pick()` that falls back from `ne` to `en` on null or whitespace. The home page is statically generated with `revalidate = 3600`, so the UTC verse of the day rolls over without an admin edit. Admin actions call `revalidatePath("/[locale]", "layout")`, and E2E shows publish/rename is visible on the next load.

Authorization is server-side at three levels. Every one of the 25 dashboard pages awaits `requireAdminPage`/`requireOwnerPage` before any `<Suspense>`. There is no `loading.tsx` under `src/app/admin`. Every mutation runs through `runAdminAction` with an explicit `ADMIN`/`OWNER` role. Settings, users and audit are OWNER-only at both the page and the action level. The dashboard layout never redirects, which keeps a real 307 coming from the page. The JWT carries only the user id and `sessionVersion`, and the guard re-reads role and active state from the DB. Deactivation, 2FA reset, password change and logout all bump `sessionVersion`, so revocation takes effect immediately.

Login has two steps, and every budget is an atomic conditional write: reserve-then-verify for the 5-failure account lock, insert-then-count for the 20-per-IP window, `updateMany` reservation of the single-use challenge, and a `lastTotpStep < step` guard in the success transaction against replay. TOTP secrets are AES-256-GCM sealed with a row-bound AAD (`totp:<id>` / `enroll:<id>`). The max-3-editors rule is serialized with a transaction-level advisory lock, both on create and on reactivate.

The local tooling has exact pins and no `^`/`~`. `assert-local-db` guards `db:migrate`, `db:reset`, Vitest DB setup, `e2e:prepare` and `runPrisma`. The seed uses create-only upserts. `.env`, `.local/`, `src/generated/`, `playwright/.auth/` and `.vitest/` are all ignored. The only remaining gaps are UX honesty around media links and a small fold issue in the admin sidebar.

<details>
<summary>Issues (3)</summary>

1. **Pasted media links don't render publicly** — post/event cover images, media thumbnails and YouTube embeds are stored, but no public component reads them yet (only `logoUrl` is rendered). Extend the hint/README to say links are saved now and shown once the media and detail pages arrive, or render `thumbnailUrl` on the featured cards.
2. **Generic upload hint on image-only fields** — "paste an image link or a YouTube link" also appears on the post/event cover and logo fields, which only make sense as images. Use field-specific wording ("paste an image link") there and keep the YouTube wording on the media video field.
3. **Log out at the sidebar fold** — at 1280x900 the last sidebar item "Log out" is cut off at the bottom edge (`dashboard-1280.png`). Tighten the sidebar spacing or pin the session/logout block to the bottom.

</details>

<details>
<summary>Details</summary>

### Media links the public site doesn't show yet

The user's request was "upload pictures and video and edit things inside the website". The design defers uploads to Phase 7 and requires the hint "Uploading files arrives in a later update. For now, paste an image link or a YouTube link." The hint is on every URL field and repeated in the README, so the "no uploads yet" part is honest. Pasting a link, though, currently has no public effect except for the settings logo (`Header.tsx`/`Footer.tsx` render `site.logoUrl`) (confirmed). `src/components/home/*` never reads `thumbnailUrl`, `coverImageUrl` or `embedUrl`, and the featured cards keep their placeholder thumbnails. Post/event detail pages and the Media page are out of scope. An owner who pastes a YouTube link into a featured video will see the card text change but no video. This is within the design's scope, but the wording should set that expectation, because "for now, paste a link" reads as "this works today" (likely to confuse the non-technical owner).

The hint text is a single `UPLOAD_HINT` constant, so it also tells people to paste "a YouTube link" into Cover image and Logo fields (confirmed in `post-editor-1280.png` and the settings page). `optionalSafeUrl` accepts any https URL there, so a YouTube page URL would be stored as an image source and would break once Phase 7 renders covers with `<img>`/`next/image`.

### Login budgets and replay

One non-obvious choice: a correct password refunds only its own reservation and keeps earlier failures. That way, mixing correct passwords with wrong TOTP codes can't reset the counter. Only a successful TOTP step clears it.

```
step 1: IP row (insert→count) ─► account reserve (atomic +1) ─► Argon2 ─► challenge (VERIFY|ENROLL, 5 min, sha256 stored)
step 2: IP row ─► challenge reserve (attempts<5) ─► account reserve ─► open(secret, AAD) ─► TOTP
        └─ tx: consume challenge + lastTotpStep<step + reset counters + audit ─► JWT {uid, sv}
```

The IP key trusts the first `x-forwarded-for` value. The code comment and README both say that this is only valid behind Vercel and that the per-account lock is the primary control.

### Test and evidence coverage

I re-ran `npm run typecheck` (exit 0), `npm run lint` (exit 0) and `npx vitest --run --project unit` (29 files, 313 tests, exit 0). This matches the verification report's unit count. I also re-ran the AC31 hygiene commands: the AWS scan returned nothing, `git check-ignore` lists `.env`, `.local`, `src/generated`, `playwright/.auth` and `.vitest`, the `.env.example` check matched only `NEXT_PUBLIC_SITE_URL` and `DATABASE_URL`, there are no `^`/`~` ranges and there are still no commits. I opened the screenshots: the public header matches the user's last adjustment, and there is no horizontal overflow at 375 px. I did not re-run the DB project (75 tests) or Playwright (78 tests). The recorded evidence includes per-test spy counts and a documented first-run failure with its fix, which is detailed enough to trust.

Not tested: a public render of any pasted media/cover link (there is no consumer yet); `x-forwarded-for` spoofing behind a non-Vercel proxy (documented trust assumption).

</details>

<details>
<summary>File map</summary>

- `prisma/schema.prisma`, `prisma/migrations/20261026013432_init` — 13 models, bilingual en/ne columns, enums
- `prisma/seed.ts`, `prisma/seed-lib.ts` — create-only demo seed + SiteSettings singleton
- `prisma.config.ts` — Prisma 7 config, `DIRECT_URL || DATABASE_URL`
- `scripts/local-db.ts`, `scripts/assert-local-db.ts` — embedded Postgres start/stop/status, local-DB fence
- `scripts/create-owner.ts`, `scripts/e2e-prepare.ts` — owner bootstrap/reset CLI, E2E users and DB
- `src/lib/content.ts`, `content-mappers.ts`, `site-settings*.ts`, `localize.ts`, `db.ts` — Prisma-backed public reads, ne→en fallback
- `src/lib/markdown.ts`, `src/lib/validation/*` — sanitized Markdown, Zod schemas
- `src/auth.ts`, `src/server/auth/*` — Auth.js config, login flow, lockout, IP limit, Argon2id, TOTP, AES-GCM secret box, guards
- `src/server/actions/*`, `src/server/services/*` — `runAdminAction` wrapper, per-entity actions and services, inbox privacy module
- `src/app/admin/**`, `src/components/admin/**` — admin root layout, login, dashboard, CRUD, settings, users, inbox, audit pages and components
- `next.config.ts`, `src/proxy.ts`, `src/app/robots.ts`, `src/app/sitemap.ts` — admin security headers, proxy/sitemap exclusion, robots disallow
- `src/app/[locale]/*`, `src/components/layout/*` — settings-driven name/email/logo/demo banner, hourly revalidation
- `e2e/admin-*.spec.ts`, `e2e/auth.setup.ts`, `playwright.config.ts`, `vitest.config.mts` — admin E2E projects, unit/db Vitest projects
- `README.md`, `.env.example`, `package.json`, `.gitignore` — setup/Neon/admin guide, env template, exact pins and scripts

Full change set: all files are untracked (`git status --short`); there is no diff base.

</details>
