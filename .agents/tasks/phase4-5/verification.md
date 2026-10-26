# Phase 4 + 5 verification evidence

Machine: Windows, Node v24.22.1, npm 11.19.1, PowerShell. Project root `c:\Users\rasaily\Downloads\mission app` (no git worktree, no commits made).

## Item 0: Baseline (untouched tree)

| Command | Exit | Key output |
| --- | --- | --- |
| `npm test` | 0 | `Test Files 8 passed (8)`, `Tests 55 passed (55)` |
| `npx playwright test --reporter=list` | 0 | `38 passed (30.5s)` (single `chromium` project) |

Baseline used everywhere below: 55 unit tests (8 files), 38 E2E tests. Both match the expected numbers.

## Item 1: Pinned dependencies, tooling ignores, local Postgres, local-DB fence

`npm view <pkg>@<ver> version` echoed the exact requested version for all 18 packages (§2 table). Installed with `npm install --save-exact` (deps) and `npm install --save-exact --save-dev` (dev deps), both exit 0, `found 0 vulnerabilities`. npm 11 reported that install scripts for `prisma`, `@prisma/engines`, `@embedded-postgres/windows-x64` and `esbuild` were not run. None were approved; everything works on Windows without them (as the design predicted).

| Command | Exit | Key output |
| --- | --- | --- |
| `Select-String -Path package.json -Pattern '"[\^~]'` | - | no output |
| `npm ls next-auth prisma @prisma/client` | 0 | `@prisma/client@7.10.1`, `next-auth@5.0.0-beta.32`, `prisma@7.10.1` |
| `npm run db:start` (first) | 0 | `Local Postgres started on 127.0.0.1:54329.` + dev URL |
| `npm run db:start` (again) | 0 | `Local Postgres already running on 127.0.0.1:54329.` (no-op) |
| `npm run db:status` | 0 | `Local Postgres is running on 127.0.0.1:54329.` |
| `npm run db:stop` | 0 | `Local Postgres stopped.`; status then `Local Postgres is stopped.` |
| `npm run db:start` (restart) | 0 | `Local Postgres started ...` |
| `npx vitest --run scripts` | 0 | `Tests 7 passed (7)` (assert-local-db) |
| AC32: `$env:DIRECT_URL="postgresql://u:p@ep-x.neon.tech/db"; npm run db:reset` | 1 | `Refusing to run: DIRECT_URL points to a non-local database. ...` printed by `assert-local-db.ts`; Prisma never ran. `Remove-Item Env:DIRECT_URL` afterwards. |

UNVERIFIED items:
- `createRequire(...)(platformPkg)` under tsx CJS: works (the platform package is ESM; Node 24 `require(esm)` loads it). No `async import()` fallback needed.
- `prisma generate` with no URL: with `.env` temporarily renamed (so `DATABASE_URL` was truly absent) `npx prisma generate` exited 0 (`Generated Prisma Client (7.10.1)`). No placeholder URL needed. (Note: in PowerShell `$env:DATABASE_URL=""` deletes the variable, so `.env` would refill it; renaming `.env` was the honest test.)
- Pinned probe `npx prisma@7.10.1 dev --detach --name probe`: CLI 7.10.1, `@prisma/dev` 0.24.17, exit 0, URL `postgres://postgres:postgres@localhost:51214/template1`. A second concurrent `pg` client connected and both clients ran queries (the old P1017 single-connection failure did NOT reproduce with this version for two simple sequential-query clients). Decision stands per design (stack locked). Cleaned up with `npx prisma@7.10.1 dev stop probe` and `dev rm probe` (both exit 0; `dev ls` empty).

Local `.env` created (untracked, `git check-ignore .env` prints `.env`) with `DATABASE_URL` = mission_dev, empty `DIRECT_URL=`, freshly generated `AUTH_SECRET` and `TOTP_ENCRYPTION_KEY` (values not printed). `.gitignore` gained `.local/`, `src/generated/`, `playwright/.auth/`; ESLint ignores `.local/**`, `src/generated/**`; `.prettierignore` gained `.local`, `src/generated`, `playwright/.auth`. `.env.example` rewritten per §15.

## Item 2: Schema, init migration, seed, settings defaults, message keys

| Command | Exit | Key output |
| --- | --- | --- |
| `npx prisma validate` | 0 | schema valid |
| `npm run db:migrate -- --name init` | 0 | `Applying migration 20261026013432_init` -> `prisma/migrations/20261026013432_init/migration.sql` |
| `npx prisma migrate status` | 0 | `1 migration found` / `Database schema is up to date!` |
| `npm run db:seed` (1st) | 0 | `Seed complete: 6 posts, 4 events, 3 verses, 3 media, 1 settings.` |
| `npm run db:seed` (2nd) | 0 | identical line |

`Home.heroEyebrow/missionStatement/introBody1/introBody2` removed from both message files and copied verbatim into `defaultSiteSettings` (tagline, missionStatement, aboutIntro = body1 + "\n\n" + body2). `MediaKinds.IMAGE` added ("Image" / "तस्बिर"). `messages.test.ts` (parity, no "Demo Ministry") still passes inside the unit project.

## Item 3: Data layer swap, consumers, Vitest projects, DB tests

| Command | Exit | Key output |
| --- | --- | --- |
| `npx vitest --run --project unit` | 0 | `Test Files 13 passed`, `Tests 74 passed` (46 pre-existing unit + 28 new) |
| `npx vitest --run --project db` | 0 | `Test Files 3 passed`, `Tests 22 passed` (content.db 15 incl. the 9 original names, seed.db 4, site-settings.db 3) |
| `npm test` | 0 | `Test Files 16 passed (16)`, `Tests 96 passed (96)`; baseline 55 preserved (46 unit + 9 moved to db) |
| `npm run lint` | 0 | - |
| `npm run typecheck` | 0 | prisma generate + next typegen + tsc clean |
| `npm run build` (DB up, mission_dev seeded) | 0 | `/en`, `/ne` and all locale pages `●` SSG, `ƒ Proxy (Middleware)` |

UNVERIFIED §6.1: Turbopack bundles the Prisma 7 `prisma-client` output without config. `serverExternalPackages` fallback NOT needed; `next.config.ts` unchanged.

Deviation: `vitest.config.mts` uses a literal mission_unit URL instead of importing `urlFor` (so loading the config never pulls in the Postgres tooling); `src/test/db-global-setup.ts` asserts the project env equals `urlFor("mission_unit")` for both variables and fails otherwise.

## Item 4: Proxy/robots/sitemap exclusion, Playwright on seeded mission_test

| Command | Exit | Key output |
| --- | --- | --- |
| `npx vitest --run --project unit` | 0 | includes admin-path (11), robots (1), sitemap (1) tests |
| `npm run db:stop` then `npx playwright test --project=public --reporter=list` | 0 | `38 passed (41.5s)`; e2e:prepare started Postgres (wrote `.local/e2e-started-db` + `.local/e2e-running`), teardown stopped it and removed both markers; `npm run db:status` afterwards: `Local Postgres is stopped.` |
| same with dev DB already running | 0 | `38 passed (41.8s)`; DB left running (not started by E2E) |

First attempt: tests 38 passed but `e2e/global-teardown.ts` failed (`Cannot use 'import.meta' outside a module`: Playwright loads it as CJS and it imported `scripts/local-db.ts`). Fix: teardown no longer imports local-db; it runs `tsx scripts/local-db.ts stop` via `process.execPath` + resolved `tsx/cli`. Stale markers from that run were removed by hand before the rerun.

Screenshots (`.agents/screenshots/`), compared with the Phase 2 description:
- `home-en-1280.png`: demo banner on top; header unchanged: cross logo + "Demo Ministry" on the left, Home/Devotionals/Missions/Media/Prayer + English | नेपाली in the center, gold "Support the Mission" pill on the right. Hero: "FAITH · HOPE · SERVICE" eyebrow, gold rule, "Demo Ministry" h1, mission statement, DEMO CONTENT badge, three CTAs. Featured verse Isaiah 6:8 (WEB) with badge; About section with both intro paragraphs from settings; 3 ministry updates, 3 featured cards (Sermon 32 min, Devotional, Video 6 min), 3 upcoming events, CTA band, footer with name, email, three "(placeholder)" social rows and demo badge.
- `home-ne-375.png`: same order at 375 px in Nepali: header logo+name left, hamburger right; Nepali tagline "विश्वास · आशा · सेवा", mission and intro paragraphs in Devanagari, English verse with Nepali note, cards and footer intact, no overflow.
- `home-ne-375-menu-open.png`: Nepali mobile menu dialog (गृहपृष्ठ active, भक्ति चिन्तन, मिसनहरू, मिडिया, प्रार्थना), language switcher and gold CTA at the bottom, unchanged.

## FEAT-001 final run (after `npm run format`)

| Command | Exit | Key output |
| --- | --- | --- |
| `npm run db:start; npm run db:status` | 0 / 0 | started; running on 127.0.0.1:54329 |
| `npx prisma migrate status` | 0 | `Database schema is up to date!` |
| `npm run db:seed; npm run db:seed` | 0 / 0 | both `6 posts, 4 events, 3 verses, 3 media, 1 settings` |
| `npx vitest --run --project unit` | 0 | 13 files, 74 tests |
| `npx vitest --run --project db` | 0 | 3 files, 22 tests |
| `npm test` | 0 | 16 files, 96 tests |
| `npm run lint` | 0 | - |
| `npm run typecheck` | 0 | - |
| `npm run build` | 0 | `/en`, `/ne` SSG |
| `npx playwright test --project=public --reporter=list` | 0 | 38 passed |
| `npm run format:check` | 0 | All matched files use Prettier code style |

Hygiene: no `^`/`~` in package.json; AWS/S3/Amazon/Cognito/SES/Amplify scan over src, scripts, prisma, e2e: no matches; `git check-ignore` lists `.env`, `.local`, `src/generated`; `git log` still reports no commits. The local Postgres is left running after this run (`npm run db:stop` to stop).

# FEAT-002: Phase 5 server layer (plan items 5-8)

## Item 5: security core, validation, Markdown

New unit test files (per-file test counts, `npx vitest --run --project unit`, exit 0):

| File | Tests |
| --- | --- |
| `src/lib/validation/common.test.ts` | 41 (incl. `" Bob@Example.ORG "` -> `"bob@example.org"`, safeUrl rejects `javascript:`/`data:`/`http:`/`//evil`, YouTube watch/youtu.be/shorts/embed/live -> nocookie; vimeo and `youtube.com.evil.com` rejected) |
| `src/lib/validation/content.test.ts` | 15 (posts, categories, verses, events `endsAt < startsAt` on `endsAt`, media IMAGE without alt fails) |
| `src/lib/validation/admin.test.ts` | 13 (settings socialLinks https only + order + `[]`, editors, account, auth, inbox, list query) |
| `src/lib/markdown.test.ts` | 7 (script text removed, img/iframe/on* removed, `javascript:`/`data:` hrefs dropped, `rel="opener"` overwritten to exactly `noopener noreferrer nofollow`, h1 -> h2) |
| `src/server/auth/secret-box.test.ts` | 11 (round-trip, tampered iv/tag/ct, wrong AAD, wrong key, key/secret config errors) |
| `src/server/auth/totp.test.ts` | 6 (replay rejected with afterTimeStep, +-30 s tolerance) |
| `src/server/auth/password.test.ts` | 4 (`$argon2id$v=19$m=19456,t=2,p=1$`, malformed hash -> false) |

`src/lib/site-settings.ts` now logs invalid social links with `log.warn("site-settings.social.invalid")` (FEAT-001 deviation 3 closed).

## Item 6: Auth.js, login service, guards, auth actions

- `npx vitest --run --project unit`: `guards.test.ts` 13 tests, `safe-next.test.ts` 13 tests, pass.
- `npx vitest --run --project db --reporter=verbose`: `src/server/auth/login.db.test.ts` 17/17 passed. Names include: VERIFY success path; ENROLL path; AC17 identical message for unknown/wrong/inactive/locked; AC18 5 failures (password + TOTP) lock for 15 min with injected clock, lock expiry; refund keeps earlier failures; self-heal at count 7; AC19 rate limit at 20; challenge expiry / single use; challenge dies after 5 wrong codes; AC20 replay rejected; corrupted `totpSecretEnc` -> GENERIC_MSG at step `credentials` + `log.error("auth.login.error", { name: "CallbackRouteError" })`.
- Concurrency spy results (printed by the tests):
  - `[AC18] real-hash verifyPassword calls: 5` (10 parallel wrong-password `startLoginAction` calls; `lockedUntil` set; exactly one `auth.lockout` row).
  - `[AC19] hash checks: 0, rate-limited responses: 30` (30 parallel step-1 calls from one IP hash with distinct unknown emails; <= 20 required). All 30 inserts committed before any count ran, so every request saw > 20 rows: insert-then-count is conservative under a burst, as designed.
  - `[AC20] fulfilled: 1, rejected: challenge_expired` (2 parallel `completeLogin` with the same challenge + code; one `auth.login.success` row).
- `npm run build`: exit 0, `ƒ /api/auth/[...nextauth]` listed as dynamic; `/en`, `/ne` still `●` SSG.

Deviation: `vitest.config.mts` gained `test.server.deps.inline: ["next-auth"]` (next-auth imports `next/server` without an extension, which Node ESM rejects under Vitest). No runtime effect.

## Item 7: runAdminAction, services, actions, static tests

- Unit static scans: `guard-coverage.test.ts` 25 tests (every action file starts with `"use server"`; every exported action contains `runAdminAction(` except the allow-list; `logoutAction`/`previewMarkdownAction`/`changePasswordAction` contain `requireAdmin(`; wrapper is `server-only` and has no directive; services + wrapper never `redirect`), `privacy-scan.test.ts` 2 tests (AC27), `src/test/script-imports.test.ts` 25 tests (AC35 + pure modules have no `server-only` + no file under `src/` reads `process.env.E2E`).
- DB test files (all pass): `actions.db.test.ts` 10, `account.db.test.ts` 9, `users.db.test.ts` 8, `inbox.db.test.ts` 4, `posts.db.test.ts` 5 (review NIT 7).
  - AC15: EDITOR -> `updateSiteSettingsAction`, `createEditorAction`, `setUserActiveAction` = FORBIDDEN, settings row / admin count / target editor unchanged, 0 audit rows, no revalidate. No session -> UNAUTHENTICATED for post/category/verse/event/media/inbox actions.
  - AC24: post update/publish/delete each +1 audit row and `revalidatePath("/[locale]", "layout")`; create redirects to `/admin/posts/<id>?toast=created` after the post + audit row are committed; validation failure, P2002 (slug field error) and P2003 (`categoryIds` field error, 0 post/PostCategory rows) write no audit row. Settings update: 1 row with `taxDeductibleVerified: { from: false, to: true }`.
  - AC21: 4th editor -> LIMIT "You can have at most 3 active editors. Deactivate one first."; `[AC21] concurrent creates: 1 ok, 2 LIMIT`; reactivation at the limit -> LIMIT.
  - Change password: 5 wrong -> lock + sessionVersion bump + 5 `auth.password.change_failed` rows; old session -> UNAUTHENTICATED; new-sessionVersion session gets the lock message with 0 `verifyPassword` calls; after 16 min (clock spy) succeeds and writes `account.password.change`.
- `npm run typecheck`, `npm run lint`, `npm run build`: exit 0.

## Item 8: owner CLI and E2E users

CLI against `mission_dev`, stdin piped (non-TTY), `OWNER_PASSWORD` set to a random 20-char value and removed afterwards (password never printed):

| Run | Exit | Output (secrets redacted) |
| --- | --- | --- |
| `npm run admin:create-owner -- --email owner@example.org --name "Local Owner"` | 0 | `Owner owner@example.org created.`, 24-line terminal QR, key "redacted", `otpauth://totp/Demo%20Ministry%20Admin:owner%40example.org?secret=<redacted>&issuer=Demo%20Ministry%20Admin` |
| same again | 1 | `An owner already exists (owner@example.org). Use --reset to reset the owner's password and authenticator.` |
| same with `--reset` | 0 | `Owner owner@example.org was reset: new password and new authenticator. Other sessions are signed out.` + QR/URI (redacted) |

AuditLog afterwards: `owner.create` and `owner.reset`, both `actorEmail: "cli"`; one OWNER, `totpEnabled: true`, `sessionVersion: 2`.

Gotcha: invoking `npm` (npm.ps1) with piped stdin in PowerShell swallowed the `--` separator; `npm.cmd run admin:create-owner -- ...` works. A first attempt without piped stdin ran in a console TTY and the `--reset` run waited at the optional code prompt; it was killed and `mission_dev` reset before the clean run above.

`npm run e2e:prepare` (manual check with `DATABASE_URL`/`DIRECT_URL` = mission_test and a random `TOTP_ENCRYPTION_KEY`): exit 0, `created 3 admin users (owner, editor, editor2)`; `playwright/.auth/e2e-users.json` holds owner/editor/editor2 with role, name, 24-char password and 32-char secret (values not shown; file is gitignored). The `.local/e2e-running` marker from this manual run was removed.

`npm run db:reset` exit 0 (pristine demo data, `6 posts, 4 events, 3 verses, 3 media, 1 settings`), then `npm run db:seed` exit 0 with identical counts.

## FEAT-002 final run (after `npm run format`)

| Command | Exit | Key output |
| --- | --- | --- |
| `npm run db:start` | 0 | already running on 127.0.0.1:54329 |
| `npx vitest --run --project unit` | 0 | 25 files, 249 tests |
| `npx vitest --run --project db` | 0 | 9 files, 75 tests |
| `npm test` | 0 | 34 files, 324 tests |
| `npm run lint` | 0 | - |
| `npm run typecheck` | 0 | - |
| `npm run build` | 0 | `ƒ /api/auth/[...nextauth]`; `/en`, `/ne` SSG |
| `admin:create-owner` x3 | 0 / 1 / 0 | see item 8 |
| `npm run db:reset` | 0 | demo data restored |
| `npm run format:check` | 0 | All matched files use Prettier code style |

Hygiene: no `^`/`~` in package.json; AC31 AWS scan: 0 matches; `playwright/.auth/e2e-users.json` is git-ignored; `git log` still reports no commits. Playwright was not run in this feature (no admin UI yet; FEAT-003). Local Postgres left running.

# FEAT-003: Phase 5 admin UI, admin E2E, docs (plan items 9-14)

## Item 9: admin root layout, security headers, shell, login, dashboard

Created `src/app/admin/layout.tsx` (own `<html lang="en" class="admin-root">`, Lora/Inter/Noto Sans Devanagari from `src/app/fonts.ts`, `globals.css`, `ToastProvider`, metadata title template `%s · Admin`, `robots: { index: false, follow: false }`), `admin/not-found.tsx` ("Admin page not found"), `admin/[...rest]/page.tsx` (`notFound()` only), `admin/login/page.tsx` + `components/admin/LoginForm.tsx` (credentials -> verify / enroll with `QrSetup`, hidden `next`, "Start over", lockout note, redirect to `/admin` when signed in), `(dashboard)/{layout,error,page,forbidden/page,account/page}.tsx`. No `loading.tsx` anywhere under `src/app/admin/`; every page awaits its guard before any `<Suspense>`.

`next.config.ts` `async headers()`: site-wide `X-Content-Type-Options: nosniff` + `Referrer-Policy: strict-origin-when-cross-origin`; the 7 admin headers on `/admin`, `/admin/:path*` and `/api/auth/:path*` (explicit `/admin` source added as belt and braces; see UNVERIFIED outcomes).

UI primitives: `src/components/ui/Select.tsx`, Button `danger` variant (`bg-red-700 text-white hover:bg-red-800`), exported from `ui/index.ts`. Admin components (`src/components/admin/`): AdminShell, AdminNav, AdminMobileNav, SessionIndicator, PageHeader, ToastProvider/useToast, FlashToast, FormShell (+ `useFieldError`, `fieldId`), fields (TextField/TextAreaField/SelectField/CheckboxField/GroupError), StatusBadge, QrSetup, ConfirmDialog (Radix AlertDialog), InlineAction, BilingualField, MarkdownEditor, DateTimeField, SlugField, PublishControls, SubmitButton, ListToolbar, RecordList, Pagination, PrivacyNotice/ConsentBadge, UploadHint/UploadNoteCard, Skeletons, EditorSection, RecordMeta, DetailList, InboxStatusForm, FeatureVerseDialog, SetPasswordDialog, MediaTypeFields, labels.ts, editors/{Post,Event,Verse,Media}Editor.tsx. One `globals.css` rule scoped to `.admin-root [lang="ne"]` (Devanagari font for Nepali inputs; does not touch the public site).

Tests (unit project): `src/app/admin/admin-structure.test.ts` 55 cases (no loading.tsx; 25 dashboard pages each call a page guard and await it before the first `<Suspense`; settings/users/audit use `requireOwnerPage(`; `[...rest]` only `notFound()`; dashboard layout never redirects), `ConfirmDialog.test.tsx` 3 (opens with Cancel focused, Escape closes + focus returns, confirm submits hidden form with id), `BilingualField.test.tsx` 2 (labels, ids, lang="ne", aria-describedby hint), `FormShell.test.tsx` 2 (error summary role=alert focused with field links, values kept, submitter intent sent; success toast), `Button.test.tsx` +1 danger case (and the variant loop now covers danger).

## Item 10: content CRUD sections

Pages: `posts/{page,new/page,[id]/page}.tsx`, `categories/{page,[id]/page}.tsx` (inline create on the list), `verses/{page,new/page,[id]/page}.tsx` (verse-of-the-day-today card, "Feature on…" dialog defaulting to today UTC, "Stop featuring"), `events/{page,new/page,[id]/page}.tsx` (lifecycle status select, post-trip report MarkdownEditor en/ne), `media/{page,new/page,[id]/page}.tsx` (type select switching link / YouTube / alt-text fields; upload note card). Lists: GET `ListToolbar`, `RecordList`, `Pagination` (20/page), `EmptyState`, `<Suspense key=JSON(query) fallback=<ListSkeleton/>>` after the guard; row Publish/Unpublish (`InlineAction`) and Delete (`ConfirmDialog`). Edit pages load the record after the guard and before Suspense (`notFound()` -> 404). `PublishControls`: new/DRAFT "Save draft" + "Publish"; PUBLISHED "Update" + "Unpublish" with the "removes it from the public site" hint. Every image/media URL field (post cover, event cover, media url/YouTube/thumbnail, settings logo) shows "Uploading files arrives in a later update. For now, paste an image link or a YouTube link." with `TODO(Phase 7)`. Nepali inputs carry `lang="ne"`.

## Item 11: settings, users, inbox, audit

`settings/page.tsx` (`requireOwnerPage`; Identity / Social links / Messages / Donations cards; "Donation tax status has been verified" + warning box; UI copy does not contain "tax-deductible"), `users/page.tsx` (`requireOwnerPage`; admin cards with role/status/2FA Set up|Pending/last sign-in; "N of 3 editors"; add-editor form disabled with "You can have at most 3 active editors. Deactivate one first." at the limit; Deactivate/Reactivate, Reset 2FA confirm, Set temporary password dialog), `inbox/prayer/{page,[id]/page}.tsx` and `inbox/messages/{page,[id]/page}.tsx` (status filter, PrivacyNotice, consent badge, EmptyState "They will appear here when the prayer form launches.", status select + Save), `audit/page.tsx` (`requireOwnerPage`, 50/page, entity-type filter, metadata in `<details><pre>`).

## Item 12: admin E2E and screenshots

`playwright.config.ts`: projects `setup` (`/auth\.setup\.ts/`), `admin-readonly` (admin-access + admin-a11y; depends on setup), `admin-mutations` (admin-content, admin-logout, admin-screenshots, admin-settings; depends on public + admin-readonly; `fullyParallel: false`, `workers: 1`). New files: `e2e/helpers/admin.ts`, `e2e/auth.setup.ts`, `e2e/admin-{access,a11y,content,settings,logout,screenshots}.spec.ts`. Headers: six asserted exactly, `cache-control` asserted to contain `no-store` (review NIT 6), on `/admin/login` and on the unauthenticated `/admin` redirect response.

Revalidation path: AC9 and AC10 passed with plain `revalidatePath("/[locale]", "layout")`; the §6.4 `unstable_cache` + `updateTag` fallback was NOT needed.

First run: 74 passed, 1 failed, 3 did not run: a strict-mode locator in admin-content (the new title matched heading, summary and sr-only link text inside the updates section; i.e. the post WAS visible). Fixed the locator to `getByRole("heading", { name })`; no app change.

axe (serious/critical = 0 everywhere): `/admin/login` 1280 + 375, `/admin` owner 1280 + 375, admin mobile menu 375, `/admin/posts/new` 1280 (all `violations=0`).

## Item 13: README and .env.example

`.env.example` already matched §15 from FEAT-001 (header "Copy this file to `.env`", unquoted empty `DIRECT_URL=`, `AUTH_SECRET=`, `TOTP_ENCRYPTION_KEY=`, Phase 6-8 placeholders commented and empty, no AWS); left unchanged. `README.md` rewritten per §19: phase status, local DB without Docker + troubleshooting (`npm install-scripts approve`, `db:reset`), first-time setup (`.env` not `.env.local`), authenticator setup for non-technical users, Switching to Neon with the one-time order `db:deploy` -> `db:seed` -> `admin:create-owner` BEFORE the first deploy or "Redeploy" after seeding (NIT 5), `TOTP_ENCRYPTION_KEY` must match Vercel, env var reference, admin guide (drafts vs published, featured, verse of the day, events + reports, "uploading pictures and videos arrives in a later update; for now paste an image link or a YouTube link", settings + Demo site switch and the "Demonstration site." footer note, max 3 editors, 2FA reset, inbox privacy, audit, lockout, logout signs out on all devices, owner `--reset`), Testing, Security notes (where auth is enforced, route-handler rule, `x-forwarded-for` trust line, NIT 4), Roadmap.

## Item 14: full verification checklist (final clean run)

| # | Command | Exit | Key output |
| --- | --- | --- | --- |
| 1 | `Select-String -Path package.json -Pattern '"[\^~]'` | - | 0 matches; `"vercel-build": "prisma migrate deploy && next build"` present (versions from `npm view` recorded in FEAT-001 item 1; no new deps in FEAT-003) |
| 2 | `npm run db:start` x2, `npm run db:status` | 0 | "already running on 127.0.0.1:54329" (no-op), "Local Postgres is running" |
| 3 | `npm run db:migrate`; `npx prisma migrate status` | 0 | "Already in sync, no schema change or pending migration was found."; "Database schema is up to date!" |
| 4 | `npm run db:seed` x2 | 0 / 0 | `6 posts, 4 events, 3 verses, 3 media, 1 settings` both times |
| 5 | `npm run lint` | 0 | - |
| 6 | `npm run typecheck` | 0 | - |
| 7 | `npm run format:check` | 0 | All matched files use Prettier code style! |
| 8 | `npm run build` | 0 | `● /en`, `● /ne` (SSG); every `/admin/*` route `ƒ` (dynamic), incl. `/admin`, `/admin/login`, `/admin/[...rest]`, `/api/auth/[...nextauth]` |
| 9 | `npm test` | 0 | 38 files / 388 tests (unit 29 files / 313, db 9 files / 75). Baseline 55 preserved (46 unit + 9 in content.db.test.ts). New in FEAT-003: admin-structure 55, ConfirmDialog 3, BilingualField 2, FormShell 2, Button +1 |
| 10 | `npx playwright test --reporter=list` | 0 | 78 passed (1.3m): public 38 (baseline, unchanged), setup 2, admin-readonly 23, admin-mutations 15 |
| 11 | screenshots | - | see below |
| 12 | AC31 AWS scan (exact command) | - | no output |
| 12 | `git check-ignore .env` | 0 | `.env` |
| 12 | `.env.example` `=\S` non-comment check | - | only `NEXT_PUBLIC_SITE_URL`, `DATABASE_URL` |
| 12 | secrets scan | - | hits only in `.agents/tasks/**` docs (the scan pattern itself / design text) and README line 129 `$env:TOTP_ENCRYPTION_KEY="<exactly the same value as in Vercel>"` (placeholder). No real secrets. `"use client"` files reading non-`NEXT_PUBLIC_` env: 0 |
| 13 | `git status --short` | 0 | 23 untracked top-level entries; `.env`, `.local/`, `src/generated/`, `playwright/.auth/` not listed. Note: `.vitest/` (contains `json/output.json`, created 22:54 before this feature) is untracked and not ignored; left as found for the reviewer |
| 13 | `git log --oneline -1` | 128 | "fatal: your current branch 'master' does not have any commits yet" |
| 14 | `$env:DIRECT_URL="postgresql://u:p@ep-x.neon.tech/db"; npm run db:reset` | 1 | "Refusing to run: DIRECT_URL points to a non-local database…" before Prisma ran; env var removed |
| 15 | pinned `prisma@7.10.1 dev` probe | - | recorded in FEAT-001 item 1 (accepted a second client for simple queries; decision stands) |
| 17 | `npm run db:stop`; `npm run db:status` | 0 | "Local Postgres stopped."; "Local Postgres is stopped." |

### 16. UNVERIFIED-item outcomes (§20)

- createRequire under tsx: works (FEAT-001), no async fallback.
- `prisma generate` with no URL: works (FEAT-001), no placeholder.
- Turbopack + generated client: builds without `serverExternalPackages` (FEAT-001; build above).
- `revalidatePath` freshness: AC9 (publish -> visible on `/en`), AC10 (name -> header) and the unpublish test pass on the next request; §6.4 fallback not needed.
- 307 without `loading.tsx` (AC14): editor `request.get(..., { maxRedirects: 0 })` on `/admin/settings|users|audit` returns 3xx with `location` ending `/admin/forbidden` and no settings form in the body; unauthenticated `/admin`, `/admin/posts`, `/admin/settings` return 3xx to `/admin/login?next=<path>`.
- `[...rest]` not shadowing `(dashboard)`: all dashboard routes render; `/admin/does-not-exist` returns 404 with "Admin page not found".
- `/admin/:path*` matching `/admin`: the headers test passes on the `/admin` redirect; an explicit `/admin` source was added anyway (harmless duplicate), so this run does not prove `:path*` alone covers `/admin`.
- next-auth 5.0.0-beta.32 runtime: full password + TOTP login, session, logout (sessionVersion bump) all work under `next start`.
- `migrate reset` seeding: covered in FEAT-001/002 (`db:reset` runs `prisma/seed.ts` explicitly).

### 11. Screenshot review

Admin (`.agents/screenshots/admin/`, all asserted `scrollWidth <= width`):

- `login-1280.png` (1280x900): ivory page, centred white card with the gold-ring cross logo, "Demo Ministry Admin" in Lora, short gold rule, h1 "Sign in", Email and Password fields, full-width navy "Sign in" button, lockout note below. Clean, on-brand, no overflow.
- `login-375.png` (375x812): same card filling the width with 16 px margins; all text readable, button full width, nothing clipped.
- `dashboard-1280.png` (1280x900): fixed navy-deep sidebar with logo, "Demo Ministry / ADMIN", "Signed in as E2E Owner" + Owner badge, gold section labels (CONTENT, INBOX, OWNER, YOU), active "Dashboard" with white/10 background and gold left bar. Content: h1 "Dashboard", welcome line, 5 white stat cards (6 published posts, 2 drafts from the content spec, 3 upcoming events, 0 prayer, 0 messages), quick-link pills incl. "Site settings". Known limitation: at 900 px viewport height the sidebar's last item "Log out" sits at the fold (the sidebar scrolls on its own; the logout E2E clicks it fine).
- `dashboard-375.png` (375x1088): navy top bar with menu button, logo and "Demo Ministry Admin"; white strip "Signed in as E2E Owner" + navy Owner badge; stacked stat cards and wrapping quick-link pills. No horizontal overflow.
- `post-editor-1280.png` (1280x2489): sidebar with "Posts" active; h1 "New post"; cards Basics (Type select, Title English/Nepali side by side with the "Leave empty to show the English text." hint, URL slug, Short summary pair), Body (two Markdown editors with Write/Preview tabs and syntax help; Nepali label shows Devanagari correctly), Scripture & categories, Display (Feature checkbox, Cover image link with the upload hint, Publish date with time zone), collapsed "Search engine details (optional)". The sticky "Save draft" / gold "Publish" bar appears mid-image: this is Playwright full-page capture of a `position: sticky` bar (it sits at the viewport bottom in the browser), not a layout bug.
- `post-editor-375.png` (375x2987): every bilingual pair stacks vertically, inputs full width, tabs fit, upload hint wraps; same sticky-bar capture artifact. No overflow.
- `settings-1280.png` (1280x3701): "Settings" active; "Last saved …" line; Identity (Ministry name "Demo Ministry", logo link + upload hint, contact email, checked "Demo site" with the footer note), Social links (7 https inputs in two columns), Messages (tagline/mission/about pairs pre-filled with seeded en + Devanagari ne text, six Markdown editors), Donations (two checkboxes, "Donation tax status has been verified", gold-bordered Important box). Gold "Save settings" sticky bar shows mid-page (capture artifact).
- `settings-375.png` (375x4975): single column, all cards stacked, Nepali text wraps cleanly; no overflow.

Public (`.agents/screenshots/home-*.png`, regenerated by the public project in the final run): `home-en-1280.png` shows the unchanged header (logo + "Demo Ministry" left, nav + English/नेपाली centre, gold "Support the Mission" right), demo banner, hero "Demo Ministry" with "FAITH · HOPE · SERVICE" eyebrow, mission text and DEMO CONTENT badge, Isaiah 6:8 (WEB) verse, about section, the three seeded ministry updates (the E2E posts are not present because the public project runs before admin-mutations), featured sermons, events, CTA band and footer with placeholder social links. `home-ne-375-menu-open.png` shows the Nepali mobile menu dialog (मेनु, nav items, language switcher, gold CTA) as before. Header layout unchanged.

---

# Integration verification, iteration 1 (2026-10-26 00:14, cross-FEAT)

No `review.json` existed, so this iteration ran the whole plan.md Full verification checklist (items 1-17) on the combined FEAT-001 + FEAT-002 + FEAT-003 tree, starting from a stopped DB.

## Findings addressed

| # | Source | Finding | Fix |
| --- | --- | --- | --- |
| 1 | Checklist item 13 ("no unexpected files") | `.vitest/json/output.json` (stale Vitest JSON reporter output, 175 tests, not written by any project config) was untracked and not ignored, so it showed in `git status --short` | Added `.vitest/` to the `# testing` block of `.gitignore` (file kept, not deleted). `git status --short` no longer lists it. No behaviour change |

No other cross-FEAT seams found: every command below passed on the first run.

## Commands

| # | Command | Exit | Key output |
| --- | --- | --- | --- |
| 1 | `Select-String -Path package.json -Pattern '"[\^~]'` | - | no matches; `"vercel-build": "prisma migrate deploy && next build"` present |
| 2 | `npm run db:start` x2; `npm run db:status` | 0 / 0 / 0 | "Local Postgres started on 127.0.0.1:54329." then "already running" (no-op); "Local Postgres is running on 127.0.0.1:54329." |
| 3 | `npm run db:migrate`; `npx prisma migrate status` | 0 / 0 | "Already in sync, no schema change or pending migration was found."; "1 migration found … Database schema is up to date!" |
| 4 | `npm run db:seed` x2 | 0 / 0 | `Seed complete: 6 posts, 4 events, 3 verses, 3 media, 1 settings.` both runs |
| 5 | `npm run lint` | 0 | clean (re-run after the `.gitignore` edit: 0) |
| 6 | `npm run typecheck` | 0 | Prisma Client 7.10.1 generated, route types generated, `tsc --noEmit` clean |
| 7 | `npm run format:check` | 0 | All matched files use Prettier code style! (re-run after the edit: 0) |
| 8 | `npm run build` | 0 | Next.js 16.4.3 (Turbopack), 43 static pages, no warnings; `● /en`, `● /ne` and all 9 placeholder pages SSG; all 27 `/admin*` routes and `/api/auth/[...nextauth]` `ƒ` dynamic; `○ /robots.txt`, `○ /sitemap.xml` |
| 9 | `npm test` | 0 | 38 files / 388 tests passed (54 s) |
| 9 | `npx vitest --run --project unit` | 0 | 29 files / 313 tests |
| 9 | `npx vitest --run --project db` | 0 | 9 files / 75 tests (globalSetup recreated + migrated `mission_unit`; dev server left running because it was already up) |
| 10 | `npx playwright test --reporter=list` | 0 | 78 passed (1.3 m), 0 failed: public 38 (baseline unchanged), setup 2, admin-readonly 23, admin-mutations 15. e2e:prepare seeded `mission_test` and created owner/editor/editor2; axe on /en and /ne: serious/critical = 0 |
| 12 | AC31 AWS-family scan (exact command) | - | no output |
| 12 | `git check-ignore .env` | 0 | `.env` |
| 12 | `.env.example` non-comment `=\S` lines | - | only `NEXT_PUBLIC_SITE_URL`, `DATABASE_URL` |
| 12 | secrets scan (exact pattern) | - | hits only in `.agents/tasks/**` docs (pattern/design text, values are backtick/quote placeholders) and README:129 `$env:TOTP_ENCRYPTION_KEY="<exactly the same value as in Vercel>"`. No real secrets |
| 12 | `"use client"` files reading non-`NEXT_PUBLIC_` env | - | 23 client files scanned, 0 hits |
| 13 | `git status --short` | 0 | 22 untracked top-level entries (source + config only); `.env`, `.local/`, `src/generated/`, `playwright/.auth/`, `.agents/screenshots/`, `.vitest/` listed only under `--ignored` |
| 13 | `git log --oneline -1` | 128 | "fatal: your current branch 'master' does not have any commits yet" (no commits) |
| 14 | `$env:DIRECT_URL="postgresql://u:p@ep-x.neon.tech/db"; npm run db:reset; $LASTEXITCODE` | 1 | "Refusing to run: DIRECT_URL points to a non-local database…" printed by `assert-local-db.ts` before `prisma migrate reset`; `Remove-Item Env:DIRECT_URL`; `migrate status` still up to date afterwards |
| 15 | pinned `prisma@7.10.1 dev` probe | - | unchanged from FEAT-001 item 1 (second client accepted for simple queries; decision stands) |
| 17 | `npm run db:stop`; `npm run db:status` | 0 | "Local Postgres stopped."; "Local Postgres is stopped." |

### 16. UNVERIFIED-item outcomes

Same as FEAT-003 item 14 above, re-confirmed by this run: createRequire under tsx works; `prisma generate` needs no URL; Turbopack bundles the client without `serverExternalPackages`; `revalidatePath` alone makes AC9/AC10 fresh (admin-content + admin-settings specs passed, §6.4 fallback not applied); real 3xx without `loading.tsx` (AC14, admin-access spec); `[...rest]` does not shadow `(dashboard)`; `/admin` headers pass, but `next.config.ts` still has the explicit `/admin` source next to `/admin/:path*`, so `:path*` alone is not proven; next-auth 5.0.0-beta.32 login/session/logout work under `next start`; `db:reset` seeds via the explicit `tsx prisma/seed.ts`.

## Screenshot review (regenerated at 00:06 by this run)

All opened and checked:

- `admin/login-1280.png`, `admin/login-375.png`: centred white card on ivory, gold-ring cross logo, "Demo Ministry Admin", gold rule, "Sign in", Email/Password, full-width navy button, lockout note. Fits 375 with margins; no overflow.
- `admin/dashboard-1280.png`: navy sidebar (Signed in as E2E Owner + Owner badge, gold CONTENT/INBOX/OWNER/YOU labels, Dashboard active with gold bar); stat cards 6 published / 2 drafts / 3 upcoming / 0 prayer / 0 messages; quick-link pills. "Log out" sits at the 900 px fold (known, sidebar scrolls).
- `admin/dashboard-375.png`: navy top bar with menu button and "Demo Ministry Admin", signed-in strip, stacked cards, wrapping pills; no overflow.
- `admin/post-editor-1280.png` / `-375.png`: "New post" with Basics, bilingual Title/Summary (Devanagari labels render), Body Markdown editors with Write/Preview, Scripture & categories, Display with the upload hint on Cover image link and the publish-date time-zone hint, collapsed SEO section. At 375 all pairs stack. The sticky "Save draft"/"Publish" bar appears mid-image (full-page capture of `position: sticky`, known).
- `admin/settings-1280.png` / `-375.png`: Identity (Demo Ministry, logo link + upload hint, hello@example.org, Demo site checked), Social links, Messages pre-filled with seeded en + ne text, six Markdown editors, Donations with the Important warning box; no "tax-deductible" phrase. Same sticky-bar capture artefact. Single column at 375, no overflow.
- `home-en-1280.png`, `home-en-768.png`, `home-ne-375.png`, `home-ne-375-menu-open.png`: header unchanged: logo + "Demo Ministry" left, nav + English/नेपाली centre, gold "Support the Mission" right (at 375 the CTA + menu button sit right). Demo banner, "FAITH · HOPE · SERVICE" eyebrow, "Demo Ministry" hero, mission text, DEMO CONTENT badges, Isaiah 6:8 (WEB) featured verse, about section, three seeded updates, sermons, events, CTA band, footer with placeholder socials and "Demonstration site.". The Nepali menu dialog shows मेनु, nav items, switcher and gold CTA.

## Hygiene

No AWS references, `.env` ignored, `.env.example` values only for the two allowed keys, no real secrets, no client-side env leaks, no commits, fence refuses non-local URLs, DB stopped at the end. Temp logs in `%TEMP%` deleted.
