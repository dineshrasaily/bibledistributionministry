# Phase 4 + 5 Design: database-backed content and secure admin CMS

Status: revision 2. Revision 1 addressed the first review (2 HIGH, 9 MEDIUM, 11 NIT); revision 2 addresses the second review in `design-review.md` / `design-review.json` (0 HIGH, 4 MEDIUM, 8 NIT). Section 21 has the per-finding responses for both rounds. Author: design step.
Project root: `c:\Users\rasaily\Downloads\mission app` (path has a space; quote it in every shell command).
Do NOT use a worktree. Do NOT commit. Never run `npm run dev` / `npm start` in the foreground.

## 0. Overview

Phase 4 moves every piece of public content (posts, events, Bible verses, media items, site settings) from the typed demo arrays in `src/content/demo/*` and `src/config/site.ts` into PostgreSQL via Prisma 7. `src/lib/content.ts` keeps its function names and view-model shapes, so the home page and its components barely change; it now queries Prisma for PUBLISHED rows only and resolves bilingual columns with a `ne` -> `en` fallback. Site settings are read through a request-deduplicated `getSiteSettings()` with a static fallback when the singleton row is missing. Public pages stay statically generated; every admin mutation calls `revalidatePath("/[locale]", "layout")` so edits show up on the next request.

Phase 5 adds a non-localized `/admin` area with its own root layout, protected by Auth.js v5 (Credentials provider, JWT sessions) plus a two-step login: password (Argon2id) then TOTP (otplib), with a DB-backed one-time login challenge, account lockout and per-IP rate limiting. Every admin page, server action and route handler is guarded server-side by `requireAdmin*()` / `requireOwner*()` helpers that re-load the user from the database on each request (so deactivation, 2FA reset and password changes revoke sessions immediately). Every mutation runs through one `runAdminAction()` wrapper that does guard -> Zod -> transaction -> AuditLog -> revalidation. Markdown bodies are stored raw and rendered through `marked` + `sanitize-html` on the server.

Local development and all tests run against a real PostgreSQL 17 server started from the `embedded-postgres` npm package (no Docker, no Neon account). `npx prisma dev` was evaluated on this machine and rejected because its TCP endpoint accepts only one connection (details in section 3). Every command that can migrate, reset or recreate a database is fenced by `scripts/assert-local-db.ts`, and test harnesses force both `DATABASE_URL` and `DIRECT_URL` to local URLs, so a local test run can never reach Neon. Production uses Neon via `DATABASE_URL` / `DIRECT_URL` with the same `@prisma/adapter-pg` code path. Vercel runs `prisma migrate deploy` before `next build` (`vercel-build` script).

---

## 1. Requirements

### 1.1 Summary

Let the site owner (and up to 3 editors) log in at `/admin` with password + authenticator code and manage all site content in English and Nepali without code changes, while the public site keeps looking exactly as it does today after seeding.

### 1.2 Functional requirements

- FR1 Database: Prisma 7 + PostgreSQL schema covering SiteSettings, AdminUser, LoginChallenge, LoginAttempt, AuditLog, Post, Category, PostCategory, BibleVerse, Event, MediaItem, PrayerRequest, ContactMessage (section 4). Migrations live in `prisma/migrations`.
- FR2 Local DB without Docker: `npm run db:start|db:stop|db:status` manage a local PostgreSQL server; databases `mission_dev` (dev), `mission_unit` (Vitest), `mission_test` (Playwright).
- FR3 Seed: `npm run db:seed` loads all demo data with `isDemo: true` and the SiteSettings singleton ("Demo Ministry" + current `site.ts`/message values). Idempotent and non-destructive (create-only).
- FR4 Public content swap: `src/lib/content.ts` reads from Prisma, PUBLISHED only, `ne` -> `en` fallback. Home sections (hero name/tagline/mission statement, intro, featured verse, updates, featured content, events) render from the DB. Header/footer name and contact email come from SiteSettings.
- FR5 Revalidation: an admin edit is visible on the public site on the next page load after the action completes.
- FR6 Auth: Auth.js v5 Credentials + Argon2id + TOTP; roles OWNER (exactly one) and EDITOR (max 3 active); lockout + rate limiting; HTTP-only SameSite cookies; generic login errors.
- FR7 Owner bootstrap CLI `npm run admin:create-owner` (+ `--reset` recovery) printing otpauth URI, secret and terminal QR.
- FR8 Admin area `/admin`: login (2 steps + first-login TOTP enrolment for editors), logout, session indicator, dashboard counts + quick links.
- FR9 CRUD (list with search/filter/pagination, create, edit, publish/unpublish, delete with confirmation): Posts (all 5 types), Categories (no publish state, see 4.3), Bible verses (incl. featured verse of the day), Events (incl. post-trip report), Media items (URL based).
- FR10 Site Settings form (OWNER only) incl. `donationsEnabled`, `taxDeductibleVerified` with warning.
- FR11 Users page (OWNER only): list, create EDITOR (max 3 active, clear error), deactivate/reactivate, reset 2FA, set a new temporary password for an editor. Account page (any admin): change own password.
- FR12 Inbox (OWNER + EDITOR): prayer requests and contact messages list + detail + status change, privacy notice; empty until Phase 6.
- FR13 Audit log viewer (OWNER only).
- FR14 `/admin` excluded from next-intl proxy, sitemap; `noindex`; disallowed in robots.txt; security headers.
- FR15 README + `.env.example` updated (local DB, first owner + authenticator setup, Neon switch, env vars, non-technical admin guide).

### 1.3 Non-functional requirements

- NFR1 Security: authorization enforced server-side in every page, action and route handler; secrets server-only; Zod on every input; sanitized HTML output; no email enumeration; CSRF covered by Server Action origin checks + Auth.js CSRF token; no AWS anywhere.
- NFR2 Accessibility: labelled fields, errors via `aria-describedby`, focus management, keyboard-operable Radix dialogs, axe: no serious/critical violations on login + dashboard.
- NFR3 Responsive: every admin page usable at 375 px with no horizontal page overflow.
- NFR4 Reproducibility: exact pinned versions, deterministic seed, tests runnable on a clean Windows machine with no Docker and no Neon.
- NFR5 Brand: existing navy/ivory/beige/gold tokens and `src/components/ui/*` primitives.

### 1.4 Acceptance criteria (numbered, testable)

Build and tooling
1. `npm run lint`, `npm run typecheck`, `npm run build` (with the local DB started, migrated and seeded), `npm run format:check` all exit 0.
2. `package.json` contains no `^` or `~` version ranges.
3. `npm run db:start` on a machine without Docker starts PostgreSQL on `127.0.0.1:54329`; `npm run db:status` reports running; `npm run db:stop` stops it; running `db:start` twice is a no-op the second time.
4. `npm run db:migrate` applies the initial migration cleanly to `mission_dev`; `npx prisma migrate status` reports up to date.
5. `npm run db:seed` run twice in a row exits 0 both times and leaves identical row counts (asserted by a DB test).

Public site
6. After seeding, the existing 38 Playwright tests pass unchanged in assertions, and the home screenshots match the previous layout (logo+name left, nav center, CTA right).
7. A DRAFT post/event/media item/verse never appears on the public site (DB test + E2E).
8. With `titleNe` null or whitespace, `/ne` shows the English title (DB test).
9. Creating and publishing a MINISTRY_UPDATE post in the admin makes it appear in "Recent ministry updates" on `/en` on the next page load (E2E).
10. Changing the ministry name in Settings changes the public header text on the next load (E2E), and the test restores it.
11. `/sitemap.xml` contains no `/admin` URL; `/robots.txt` contains `Disallow: /admin` (unit + E2E).

Auth and authorization
12. Unauthenticated GET `/admin`, `/admin/posts`, `/admin/settings` -> redirect to `/admin/login` (E2E).
13. Full login with password + TOTP generated in-test from the seeded secret lands on the dashboard showing the user's name and role (E2E).
14. Logged-in EDITOR navigating to `/admin/settings`, `/admin/users`, `/admin/audit` receives a server redirect (3xx, `location` ending in `/admin/forbidden`) (checked via `request.get` with `maxRedirects: 0` and via page navigation) and the settings form is not in the response HTML (E2E). This is achievable because no route-level `loading.tsx` exists under `src/app/admin/` and every page awaits its guard before any Suspense boundary (section 12); a static test asserts both.
15. Calling `updateSiteSettingsAction` / `createEditorAction` with an EDITOR session returns `{ ok: false, code: "FORBIDDEN" }` and leaves the DB unchanged; calling any content action with no session returns `code: "UNAUTHENTICATED"` (unit/DB tests).
16. `requireAdmin()` throws UNAUTHENTICATED for: no session, unknown user id, inactive user, `sessionVersion` mismatch; `requireOwner()` throws FORBIDDEN for EDITOR (unit tests).
17. Login error text is identical for unknown email, wrong password, inactive and locked accounts (DB test compares returned messages).
18. 5 consecutive failures (password or TOTP) set `lockedUntil = now + 15 min`; a correct password during the lock is rejected; after the lock expires login works (DB test with injected clock). Under concurrency: 10 parallel wrong-password `startLoginAction` calls for one account result in at most 5 `verifyPassword` calls against the real hash (spy) and a set `lockedUntil`, with exactly one `auth.lockout` audit row (DB test).
19. More than 20 failed attempts from one IP hash in 15 minutes returns the rate-limit message without checking the password; 30 parallel step-1 calls from one IP hash (distinct unknown emails) result in at most 20 password/dummy-hash checks (spy) (DB test).
20. A TOTP code accepted once cannot be reused (replay); 2 parallel `completeLogin` calls with the same challenge token and the same valid code result in exactly 1 success and 1 `challenge_expired` (DB test).
21. Creating a 4th active editor fails with "You can have at most 3 active editors."; 3 concurrent create requests when 2 editors exist result in exactly 1 success (DB test). Reactivating an editor when 3 are active fails the same way.
22. Logout clears the session; `/admin` then redirects to login (E2E).
23. TOTP secret encrypt/decrypt round-trips; a tampered ciphertext, wrong AAD or wrong key throws (unit test).

Data integrity
24. Every successful mutation action writes exactly one AuditLog row in the same transaction; a failed mutation writes none (DB tests on posts create/update/delete + settings + users). Read-only actions (`previewMarkdownAction`) write no audit row and trigger no revalidation. The failed-current-password path of `changePasswordAction` writes its own `auth.password.change_failed` row outside the (never-started) mutation transaction (section 11).
25. Zod schemas reject: empty required `en` fields, over-length fields, bad slugs, non-https/`javascript:` URLs, non-YouTube video URLs, IMAGE media without alt text, invalid enums (unit tests).
26. Markdown pipeline output contains no `<script`, no `on*=` attributes, no `javascript:` / `data:` hrefs; links get exactly `rel="noopener noreferrer nofollow"`, overwriting any author-supplied `rel` (unit tests).
27. Only `src/server/services/inbox.ts` (and seed/test helpers) reference `prayerRequest` / `contactMessage` Prisma delegates, and every exported function there calls `requireAdmin()` first (static source-scan unit test).

UI
28. axe on `/admin/login` and `/admin` (as owner) at 1280 px: no serious/critical violations (E2E).
29. Screenshots of login, dashboard, post editor, settings at 1280 and 375 px saved to `.agents/screenshots/admin/`, no horizontal overflow (`scrollWidth <= width` asserted), visually reviewed.
30. Every list page shows an EmptyState when empty, a Skeleton fallback via an explicit `<Suspense>` placed after the page's guard (no `loading.tsx` files under `src/app/admin/`), and is covered by the `(dashboard)/error.tsx` boundary; every successful save shows a toast (`role="status"`).

Hygiene
31. With the repository having no commits (all files untracked), these exact PowerShell commands, run from the project root, give the stated results:
    - `Get-ChildItem -Recurse -File | Where-Object { $_.FullName -notmatch '\\(node_modules|\.next|\.git|\.local|\.agents|playwright-report|test-results|src\\generated|playwright)\\' -and $_.Name -ne 'package-lock.json' -and $_.Extension -ne '.png' } | Select-String -Pattern '\baws\b|amazon|\bs3\b|cognito|\bses\b|amplify|\brds\b'` returns nothing.
    - `git check-ignore .env` prints `.env` (it is ignored).
    - `Select-String -Path .env.example -Pattern '=\S' | Where-Object { $_.Line -notmatch '^\s*#' }` matches only the `NEXT_PUBLIC_SITE_URL` and local `DATABASE_URL` lines (no secret has a value; empty values are written unquoted as `KEY=`, section 15).

Database safety and deployment
32. `scripts/assert-local-db.ts` exits 1 when `DATABASE_URL` is empty or has a non-local host, or when `DIRECT_URL` is non-empty with a non-local host (`127.0.0.1` / `localhost` only). `npm run db:migrate`, `npm run db:reset`, the Vitest DB globalSetup and `e2e:prepare` all run it first (unit test of `assertLocalDbUrls` + a manual check: `$env:DIRECT_URL="postgresql://u:p@ep-x.neon.tech/db"; npm run db:reset` exits 1 before Prisma runs).
33. The Vitest DB project and the Playwright web server set both `DATABASE_URL` and `DIRECT_URL` to the local test database URL; Prisma is spawned via `process.execPath` + the resolved Prisma CLI entry (no `npx`, no shell) and the child env carries both URLs.
34. `package.json` has `"vercel-build": "prisma migrate deploy && next build"`.
35. No module under `scripts/**` or `prisma/seed*.ts` imports `@/lib/db`, `@/lib/env`, `@/server/auth/guards`, `@/server/services/*` or `@/auth` (static test); `npm run admin:create-owner` and `npm run e2e:prepare` run under `tsx` without a `server-only` error.

### 1.5 Out of scope

- Phase 3 page content (About, Devotionals, Missions, Media, Prayer, Support, Contact stay placeholders). Post/event detail pages are not built.
- Phase 6 public prayer/contact forms, Turnstile, Resend emails (only models + read-only inbox now).
- Phase 7 uploads (Vercel Blob): image fields are URL/path text inputs with a `TODO(Phase 7)` comment. The user asked to "upload pictures and video", so the admin must say this plainly: every image/media URL field shows the hint "Uploading files arrives in a later update. For now, paste an image link or a YouTube link." and the README admin guide repeats it.
- Stripe/donations behaviour (flags stored only).
- Admin UI translation (admin chrome is English; content fields are en + ne).
- Full CSP with nonces, WebAuthn, recovery codes, email-based password reset (backlog, section 20).

### 1.6 Assumptions (explicit)

- A1 Verse text stays English only (WEB/KJV); there is no `textNe` column, consistent with "do not fabricate Nepali Bible text". The existing localized note on `/ne` stays.
- A2 Editors may create, edit, publish and delete any content (the task says editors "can manage content").
- A3 "Max 3 editors" counts ACTIVE editors; deactivated editors do not count but reactivation re-checks the limit.
- A4 The "featured verse of the day" day boundary is UTC (matches `timeZone: 'UTC'` already used by next-intl).
- A5 Public pages may require the DB at build time (static generation); a build without a reachable DB fails loudly rather than shipping empty pages.

---

## 2. Technology stack (locked once approved)

Existing (unchanged): Next.js 16.4.3 App Router (Turbopack), React 19.3.1, TypeScript 6.0.3 strict, Tailwind 4.3.3, next-intl 4.14.9, @radix-ui/react-dialog 1.3.1, Vitest 5.0.5, Playwright 1.64.1, @axe-core/playwright 4.14.0, ESLint 9.39.5, Prettier 3.9.10.

New dependencies, versions checked with `npm view` on this machine (the coder re-runs `npm view <pkg>@<ver> version` before installing and installs with `npm install --save-exact`):

| Package | Version | Kind | Why / notes |
| --- | --- | --- | --- |
| `@prisma/client` | 7.10.1 | dep | `latest` dist-tag of @prisma/client |
| `@prisma/adapter-pg` | 7.10.1 | dep | Prisma 7 requires a driver adapter; same adapter for local PG and Neon |
| `pg` | 8.23.1 | dep | driver used by adapter-pg |
| `next-auth` | 5.0.0-beta.32 | dep | v5 is only published under the `beta` tag; peer `next: ^14 \|\| ^15 \|\| ^16`; depends on `@auth/core` 0.41.3 |
| `@node-rs/argon2` | 2.2.2 | dep | Argon2id, prebuilt napi binaries (no install script); already in Next's built-in `serverExternalPackages` list (verified in `node_modules/next/dist/lib/server-external-packages.jsonc`) |
| `otplib` | 13.5.0 | dep | v13 functional API: `generateSecret`, `generate`, `verify({ secret, token, epochTolerance, afterTimeStep })`, `generateURI` (verified in a spike) |
| `zod` | 4.6.7 | dep | validation |
| `marked` | 18.1.1 | dep | Markdown -> HTML (ships its own types) |
| `sanitize-html` | 2.18.1 | dep | HTML allow-list sanitizer |
| `qrcode` | 1.5.4 | dep | otpauth QR as SVG (admin) and terminal (CLI) |
| `@radix-ui/react-alert-dialog` | 1.2.1 | dep | confirm dialogs; depends on react-dialog 1.3.1 (same as installed), peer react ^19 |
| `server-only` | 0.0.1 | dep | build-time guard for server modules |
| `prisma` | 7.10.1 | dev | CLI. NOTE: the `latest` dist-tag of `prisma` is `8.0.0-rc.27` (a release candidate). Pin the stable `7.10.1` to match `@prisma/client` |
| `embedded-postgres` | 17.10.0-beta.17 | dev | local PostgreSQL 17.10 binaries for Windows/macOS/Linux. "beta" is this package's permanent version suffix (every published version has it); 17.x chosen to match Neon's default major version |
| `tsx` | 4.23.15 | dev | runs TS scripts (seed, CLI, local-db) with tsconfig `paths` |
| `@types/pg` | 8.23.1 | dev | |
| `@types/sanitize-html` | 2.16.2 | dev | |
| `@types/qrcode` | 1.5.6 | dev | |

Not added: `dotenv` (Node 24 `process.loadEnvFile()` is used instead; verified on this machine that it does NOT override variables already present in `process.env`), `@auth/prisma-adapter` (JWT strategy, section 7.3), `sonner` (a 60-line toast component is enough), any Docker tooling.

npm 11.19 note (observed in the spike): npm prints "install scripts not yet covered by allowScripts" and does NOT run dependency install scripts for `prisma`, `@prisma/engines` and `@embedded-postgres/windows-x64`. The spike showed everything still works on Windows without them (schema engine binary is shipped in the tarball; `hydrate-symlinks` is only needed for Linux/macOS shared-library symlinks). The coder must NOT approve scripts blindly; if `prisma generate` or `db:start` fails on another OS, document `npm install-scripts approve <pkg>` in the README troubleshooting section.

---

## 3. Local PostgreSQL without Docker

### 3.1 Options considered (spiked on this machine, 2026-10-25, then cleaned up)

1. `npx prisma dev` (Prisma Postgres local server on PGlite). Version note (review finding 12): the spike ran unpinned `npx prisma dev`, which printed "prisma dev v0.16.28"; that is not the `@prisma/dev` 0.24.17 pulled in by the pinned `prisma@7.10.1`. The rejection does not depend on the version, because the limit comes from PGlite itself (one Postgres backend per process). Even so, the coder re-runs the probe once with the pinned CLI, `npx prisma@7.10.1 dev --detach --name probe`, then a second concurrent client, and records the exact version and result in the verification report. Whatever the result, the choice below stands (the stack is locked), and `npx prisma@7.10.1 dev stop probe` / `rm` cleans up. It starts fine (`prisma dev --detach --name x`), migrations apply over its TCP URL `postgres://postgres:postgres@localhost:51214/template1`, but a SECOND Prisma client (separate connection) failed immediately with `P1017 Server has closed the connection` (`DriverAdapterError: ConnectionClosed`). PGlite is single-connection. `next build` (parallel workers), `next start` + a seeding/test process, and Vitest would each open their own connections, so this is not viable. Its `prisma+postgres://` HTTP URL would need a different client mode than production. Rejected.
2. PGlite + `@electric-sql/pglite-socket`: same single-connection limitation. Rejected.
3. Native PostgreSQL Windows installer: works but requires admin install, a Windows service and manual steps; not reproducible from `npm install`. Rejected.
4. **`embedded-postgres` (chosen)**: npm package with real PostgreSQL 17.10 binaries per platform (optional deps). Verified on this machine: `initdb` with `--encoding=UTF8 --locale=C`, detached `pg_ctl start`, `prisma migrate dev` (incl. shadow DB), 20 parallel transactions from two separate Prisma clients, Devanagari round-trip (`नमूना अपडेट`), `prisma migrate reset`, `pg_ctl stop`. All passed.

Two pitfalls found in the spike that the implementation MUST handle:
- Without `--encoding=UTF8` initdb picks `WIN1252` on this machine, which cannot store Devanagari. Always pass `initdbFlags: ["--encoding=UTF8", "--locale=C"]`.
- Running `pg_ctl start` from PowerShell with captured output hangs forever (the postgres child inherits the pipe). Start it from Node with `spawnSync(pg_ctl, [...], { stdio: "ignore", windowsHide: true })`, which returned exit 0 and left the server running detached.

### 3.2 `scripts/local-db.ts` (new)

Exports functions (used by npm scripts, Vitest globalSetup and the E2E prepare script) and has a CLI entry (`start|stop|status`).

- Constants: `PORT = 54329` (avoids a native 5432), `HOST = "127.0.0.1"`, `USER = "postgres"`, `PASSWORD = "postgres"` (local-only server bound to localhost; documented as dev-only), `DATA_DIR = <root>/.local/postgres`, databases `mission_dev`, `mission_unit`, `mission_test`.
- Binary paths: `const pkg = { win32: { x64: "@embedded-postgres/windows-x64" }, darwin: { arm64: "@embedded-postgres/darwin-arm64", x64: "@embedded-postgres/darwin-x64" }, linux: { x64: "@embedded-postgres/linux-x64", arm64: "@embedded-postgres/linux-arm64" } }[process.platform]?.[process.arch]`; resolved synchronously inside a function, never with top-level `await` (tsx compiles these scripts as CommonJS because `package.json` has no `"type"`, and top-level await fails there; verified by the reviewer): `function binaries() { const { pg_ctl } = createRequire(import.meta.url)(pkg) as { pg_ctl: string }; return { pg_ctl }; }` (that package's `dist/index.js` exports `pg_ctl`, `initdb`, `postgres` absolute paths; verified in the spike). `EmbeddedPostgres` is imported normally at the top (`import EmbeddedPostgres from "embedded-postgres"`). UNVERIFIED: that `require()` of the platform package works under tsx CJS (it is a CommonJS package, so it is expected to); if it does not, `binaries()` becomes `async` and uses `await import(pkg)` inside the function.
- CLI entry check (same in `scripts/local-db.ts` and `scripts/assert-local-db.ts`), so importing the module from Vitest globalSetup or `e2e-prepare` never runs the CLI: `const isMain = process.argv[1] !== undefined && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url; if (isMain) void main();`. `main()` catches errors, prints the message and sets `process.exitCode = 1`. Unsupported platform -> throw `Error("Local Postgres is not available for <platform>/<arch>. Set DATABASE_URL to another Postgres server.")`, exit 1.
- `ensureInitialised()`: if `DATA_DIR/PG_VERSION` missing, `new EmbeddedPostgres({ databaseDir: DATA_DIR, user, password, port, persistent: true, initdbFlags: ["--encoding=UTF8", "--locale=C"] }).initialise()`.
- `isRunning()`: `spawnSync(pg_ctl, ["-D", DATA_DIR, "status"])`, exit code 0 = running, 3 = stopped.
- `start()`: `ensureInitialised()`; if running return `{ startedNow: false }`; else `spawnSync(pg_ctl, ["-D", DATA_DIR, "-l", DATA_DIR + "/server.log", "-o", "-p 54329 -c listen_addresses=127.0.0.1", "-w", "-t", "60", "start"], { stdio: "ignore", windowsHide: true })`; non-zero -> throw with the last 20 lines of `server.log`. Then `ensureDatabase(name)` for all three names (connect with `pg` to `postgres` db, `SELECT 1 FROM pg_database WHERE datname=$1`, `CREATE DATABASE "<name>"` if missing; names are constants, never user input). Returns `{ startedNow: true }`.
- `stop()`: if running, `pg_ctl -D DATA_DIR -m fast -w stop` with `stdio: "ignore"`.
- `recreateDatabase(name)`: allowed only for `mission_unit` and `mission_test` (throws otherwise): `DROP DATABASE IF EXISTS "<name>" WITH (FORCE)` then `CREATE DATABASE`.
- `urlFor(name)` -> `postgresql://postgres:postgres@127.0.0.1:54329/<name>`.
- `runPrisma(args: string[], url: string)`: the only way harness code invokes the Prisma CLI. `spawnSync("npx", …)` fails on this Windows + Node 24 machine (`ENOENT`, and `npx.cmd` gives `EINVAL` without a shell; verified by the reviewer), so the helper calls the CLI entry with the current Node binary and no shell:
  ```ts
  import { createRequire } from "node:module";
  const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js"); // the "prisma" bin
  export function runPrisma(args: string[], url: string) {
    assertLocalDbUrls({ DATABASE_URL: url, DIRECT_URL: url });
    const r = spawnSync(process.execPath, [prismaCli, ...args], {
      env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
      stdio: "inherit", windowsHide: true,
    });
    if (r.error) throw r.error;
    if (r.status !== 0) throw new Error(`prisma ${args.join(" ")} failed (exit ${r.status})`);
  }
  ```
  It is used by `db-global-setup.ts` and `e2e-prepare.ts` (`runPrisma(["migrate", "deploy"], urlFor(db))`). npm scripts keep calling `prisma` directly; npm resolves `.bin` shims itself.

### 3.2a `scripts/assert-local-db.ts` (new; production-safety fence)

- Exports a pure function `assertLocalDbUrls(env: { DATABASE_URL?: string; DIRECT_URL?: string }): void`. It throws `LocalDbGuardError` when `DATABASE_URL` is empty or can't be parsed with `new URL`, when its hostname is not `127.0.0.1` or `localhost`, or when `DIRECT_URL` is non-empty and fails the same host check. The message names the variable but not the URL (which may contain a password): "Refusing to run: DIRECT_URL points to a non-local database. Destructive and test commands only run against the local Postgres. See README > Switching to Neon."
- CLI entry (when run directly, `isMain` check as in 3.2): it loads `.env` with `process.loadEnvFile` (ENOENT is ignored), calls `assertLocalDbUrls(process.env)`, and on failure prints the message and exits 1.
- Callers: the `db:migrate` and `db:reset` npm scripts (chained before Prisma), `src/test/db-global-setup.ts` (first statement, applied to the URLs it is about to use), `scripts/e2e-prepare.ts` (first statement, applied to `process.env`; it also requires `DATABASE_URL === urlFor("mission_test")`), and `runPrisma`.
- Not guarded on purpose: `db:deploy` (`prisma migrate deploy`, the documented way to migrate Neon), `vercel-build`, and `db:seed` (create-only upserts, non-destructive, documented as a one-time step on Neon). `db:studio` is read/write but interactive and explicit.
- Unit test `scripts/assert-local-db.test.ts` covers: a local pair passes; `localhost` passes; a Neon host in either variable throws; empty `DATABASE_URL` throws; garbage throws; empty `DIRECT_URL` with a local `DATABASE_URL` passes. The Vitest `unit` project `include` adds `scripts/**/*.test.ts`.
- CLI prints the dev URL on start and a one-line status; exits 0/1. Never blocks (the server is detached).
- Concurrency note: two simultaneous `start()` calls can race; `pg_ctl` fails safely for the second ("another server might be running"), which the function treats as running if `isRunning()` is then true.

`.gitignore` adds `.local/`; ESLint and Prettier ignore `.local/**`.

### 3.3 Env loading and URLs

- One local env file: `.env` (gitignored by the existing `.env*` rule). Next.js loads it; Prisma CLI and scripts load it via `process.loadEnvFile(".env")` wrapped in `try/catch` for ENOENT. Process env always wins (verified), which is how tests inject their own URLs. `.env.local` is NOT read by Prisma or the scripts. The `.env.example` header therefore says "Copy this file to `.env`", and the README says the same.
- `.env.example` gets `DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54329/mission_dev"` and an empty, unquoted `DIRECT_URL=`.
- Rule (README, and the comment in `.env.example`): never put Neon URLs in the local `.env`. Neon commands run in a separate PowerShell session with explicit variables, e.g. `$env:DATABASE_URL="<neon pooled>"; $env:DIRECT_URL="<neon direct>"; npm run db:deploy`. Because of that rule and the `assert-local-db` fence, every test harness overrides BOTH variables.
- `prisma.config.ts` (new, Prisma 7 requires it):
  ```ts
  import { defineConfig } from "prisma/config";
  try { process.loadEnvFile(".env"); } catch {}
  export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
    datasource: { url: process.env.DIRECT_URL || process.env.DATABASE_URL || "" },
  });
  ```
  `DIRECT_URL` (Neon non-pooled) is used by the CLI for migrations; the app runtime always uses `DATABASE_URL` (Neon pooled). UNVERIFIED: that `prisma generate` succeeds with an empty URL (no DB needed for generate). Verify on implementation with `$env:DATABASE_URL=""; npx prisma generate`; if it fails, use a placeholder `postgresql://localhost/placeholder` for generate only.

### 3.4 npm scripts (exact)

```
"postinstall": "prisma generate",
"pretypecheck": "prisma generate && next typegen",
"db:start": "tsx scripts/local-db.ts start",
"db:stop": "tsx scripts/local-db.ts stop",
"db:status": "tsx scripts/local-db.ts status",
"db:migrate": "tsx scripts/assert-local-db.ts && prisma migrate dev",
"db:deploy": "prisma migrate deploy",
"db:seed": "tsx prisma/seed.ts",
"db:reset": "tsx scripts/assert-local-db.ts && prisma migrate reset --force && tsx prisma/seed.ts",
"db:studio": "prisma studio",
"admin:create-owner": "tsx scripts/create-owner.ts",
"e2e:prepare": "tsx scripts/e2e-prepare.ts",
"vercel-build": "prisma migrate deploy && next build"
```
`db:reset` runs the seed explicitly because Prisma 7 no longer seeds automatically on reset (UNVERIFIED; harmless either way since the seed is idempotent). Existing scripts are unchanged except `pretypecheck`.

`vercel-build`: Vercel runs `vercel-build` instead of `build` when the script exists. `postinstall` has already run `prisma generate`. `migrate deploy` uses `DIRECT_URL` through `prisma.config.ts` before static generation reads the DB, so a deploy that adds a migration builds against the new schema. `migrate deploy` only applies pending committed migrations and never resets. Preview deployments get their own `DATABASE_URL`/`DIRECT_URL` (a Neon branch, see README section 5), so preview migrations never touch production. Locally, `npm run build` stays plain `next build`.

### 3.5 How each consumer uses the DB

- Dev: `npm run db:start` once per boot, `npm run db:migrate`, `npm run db:seed`, then `npm run dev`. `npm run build` also needs the DB running (static generation reads it).
- Vitest (`npm test`): project `db` has `globalSetup: src/test/db-global-setup.ts`. It first runs `assertLocalDbUrls({ DATABASE_URL: urlFor("mission_unit"), DIRECT_URL: urlFor("mission_unit") })`, then `start()` (remembering `startedNow`), `recreateDatabase("mission_unit")` and `runPrisma(["migrate", "deploy"], urlFor("mission_unit"))`. It writes `.local/vitest-running` at setup and deletes it at teardown. Its teardown calls `stop()` only if `startedNow` AND `.local/e2e-running` does not exist; symmetrically, `e2e/global-teardown.ts` stops the DB only if `.local/e2e-started-db` exists AND `.local/vitest-running` does not. So whichever runner finishes last with the other gone leaves the server as it found it, and neither stops Postgres under the other. Stale markers (after a crash) only mean the server is left running, which is harmless (`npm run db:stop`). The README Testing section still says: "Don't run `npm test` and `npm run test:e2e` at the same time" (both share the one local server and Playwright recreates only `mission_test`, Vitest only `mission_unit`, so they don't corrupt each other's data, but the advice keeps runs predictable). The project's `test.env` sets BOTH `DATABASE_URL` and `DIRECT_URL` to `urlFor("mission_unit")`, so a Neon `DIRECT_URL` in `.env` can never be used.
- Playwright: `webServer.command = "npm run e2e:prepare && npm run build && npm run start -- -p 3210"` with `webServer.env = { DATABASE_URL: <mission_test url>, DIRECT_URL: <same mission_test url>, AUTH_SECRET: <random per run>, TOTP_ENCRYPTION_KEY: <random per run>, E2E: "1" }`. `scripts/e2e-prepare.ts` does the following, in order:
  1. `assertLocalDbUrls(process.env)`, and requires `process.env.DATABASE_URL === urlFor("mission_test")` (else exit 1).
  2. `start()`, writing the marker `.local/e2e-started-db` if `startedNow`. It also writes `.local/e2e-running` (removed by the global teardown), which the Vitest teardown checks (below).
  3. `recreateDatabase("mission_test")`, then `runPrisma(["migrate", "deploy"], urlFor("mission_test"))`.
  4. `seedDemoContent()`.
  5. Creates exactly these E2E admin users, each with a random 24-char password and a random TOTP secret, sealed with `seal(secret, "totp:<id>", readTotpKey())` and `totpEnabled: true`: `{ key: "owner", name: "E2E Owner", email: "owner@e2e.test", role: OWNER }`, `{ key: "editor", name: "E2E Editor", email: "editor@e2e.test", role: EDITOR }`, `{ key: "editor2", name: "E2E Editor 2", email: "editor2@e2e.test", role: EDITOR }`.
  6. Writes `{ [key]: { email, password, totpSecret, name, role } }` to `playwright/.auth/e2e-users.json` (gitignored).

  It imports only pure modules (section 6.1a). `e2e/global-teardown.ts` deletes `.local/e2e-running`, stops the DB only if `.local/e2e-started-db` exists and `.local/vitest-running` does not, then deletes the started marker. `reuseExistingServer` changes to `false` so every run starts from a reset+seeded DB (documented). Random secrets are generated in `playwright.config.ts` at load time with `crypto.randomBytes`; only the main process (which spawns the web server) uses them, so per-worker re-evaluation is harmless.

---

## 4. Prisma schema

### 4.1 Bilingual modeling: columns, not a translations table

Chosen: paired columns `xxxEn` (required where the field is required) + `xxxNe` (nullable). Reasons: the locale set is fixed at two (en, ne) by the product; every read is a single-row select without joins; Prisma types and Zod schemas map one-to-one onto the admin form (side-by-side en/ne fields); "published only + fallback" stays a trivial `pick()` in TypeScript; a translations table would need joins/`include` on every query, a composite key per field, and a much more complex form/validation layer for no benefit at two locales. Trade-off accepted: adding a third locale later means a migration adding `xxxHi` columns, which is mechanical.

Fallback rule (single function, `src/lib/localize.ts`): `pick(en, ne, locale) = locale === "ne" && ne != null && ne.trim() !== "" ? ne : en`. Zod normalizes empty/whitespace `ne` inputs to `null` before saving, so the DB normally holds `null`, but the read side also treats whitespace as missing (defence for seeded/legacy rows).

### 4.2 Full schema (`prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

// ---------- enums ----------
enum AdminRole { OWNER EDITOR }
enum ContentStatus { DRAFT PUBLISHED }
enum PostType { DEVOTIONAL ARTICLE MINISTRY_UPDATE BIBLE_STUDY TESTIMONY }
enum EventKind { MISSION_TRIP OUTREACH SERVICE ANNOUNCEMENT }
enum EventStatus { UPCOMING COMPLETED CANCELLED }
enum BibleTranslation { WEB KJV }
enum MediaType { IMAGE AUDIO VIDEO_EMBED }
enum MediaCategory { SERMON WORSHIP PODCAST GALLERY GENERAL }
enum PrayerStatus { NEW PRAYED ARCHIVED }
enum MessageKind { GENERAL TESTIMONY VOLUNTEER }
enum MessageStatus { NEW READ ARCHIVED }
enum ChallengePurpose { VERIFY ENROLL }

// ---------- settings ----------
model SiteSettings {
  id                    String   @id @default("singleton")
  ministryName          String
  taglineEn             String?
  taglineNe             String?
  missionStatementEn    String?
  missionStatementNe    String?
  visionEn              String?  // Markdown
  visionNe              String?
  valuesEn              String?  // Markdown
  valuesNe              String?
  statementOfFaithEn    String?  // Markdown
  statementOfFaithNe    String?
  aboutIntroEn          String?  // plain text, paragraphs separated by blank lines
  aboutIntroNe          String?
  logoUrl               String?  // TODO(Phase 7): Vercel Blob upload
  contactEmail          String
  socialLinks           Json     @default("[]") // SocialLink[] validated by Zod
  donationsEnabled      Boolean  @default(false)
  taxDeductibleVerified Boolean  @default(false) // OWNER only; stored for future wording
  isDemo                Boolean  @default(true)  // drives site-wide DemoBanner + hero/intro DemoBadge
  updatedAt             DateTime @updatedAt
}

// ---------- admin auth ----------
model AdminUser {
  id               String    @id @default(cuid())
  email            String    @unique // stored lower-cased + trimmed
  name             String
  passwordHash     String    // Argon2id PHC string
  totpSecretEnc    String?   // "v1:<iv>:<tag>:<ct>" AES-256-GCM, AAD "totp:<id>"
  totpEnabled      Boolean   @default(false)
  lastTotpStep     Int?      // replay protection (otplib afterTimeStep)
  role             AdminRole
  isActive         Boolean   @default(true)
  failedLoginCount Int       @default(0)
  lockedUntil      DateTime?
  lastLoginAt      DateTime?
  sessionVersion   Int       @default(1) // bump to revoke all JWTs of this user
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  posts      Post[]
  auditLogs  AuditLog[]
  challenges LoginChallenge[]

  @@index([role, isActive])
}

model LoginChallenge {
  id               String           @id @default(cuid())
  tokenHash        String           @unique // sha256(base64url token); raw token only in cookie
  userId           String
  user             AdminUser        @relation(fields: [userId], references: [id], onDelete: Cascade)
  purpose          ChallengePurpose
  pendingSecretEnc String?          // ENROLL only; AAD "enroll:<userId>"
  attempts         Int              @default(0)
  expiresAt        DateTime
  consumedAt       DateTime?
  createdAt        DateTime         @default(now())

  @@index([userId])
  @@index([expiresAt])
}

model LoginAttempt {
  id        String   @id @default(cuid())
  ipHash    String   // sha256(AUTH_SECRET + ip), never the raw IP
  userId    String?  // null for unknown emails
  success   Boolean
  createdAt DateTime @default(now())

  @@index([ipHash, createdAt])
  @@index([createdAt])
}

model AuditLog {
  id         String     @id @default(cuid())
  actorId    String?
  actor      AdminUser? @relation(fields: [actorId], references: [id], onDelete: SetNull)
  actorEmail String?    // snapshot; "cli" for the bootstrap script
  action     String     // e.g. "post.create", "settings.update", "auth.login.success"
  entityType String     // "Post", "SiteSettings", "AdminUser", ...
  entityId   String?
  metadata   Json?      // field names changed, status transitions; never secrets or message bodies
  createdAt  DateTime   @default(now())

  @@index([createdAt])
  @@index([entityType, entityId])
  @@index([actorId, createdAt])
}

// ---------- content ----------
model Post {
  id               String         @id @default(cuid())
  type             PostType
  slug             String         @unique
  titleEn          String
  titleNe          String?
  excerptEn        String
  excerptNe        String?
  bodyEn           String         @default("") // Markdown
  bodyNe           String?
  scriptureRefs    String[]       @default([])
  coverImageUrl    String?        // TODO(Phase 7)
  status           ContentStatus  @default(DRAFT)
  publishedAt      DateTime?
  isFeatured       Boolean        @default(false)
  isDemo           Boolean        @default(false)
  seoTitleEn       String?
  seoTitleNe       String?
  seoDescriptionEn String?
  seoDescriptionNe String?
  authorId         String?
  author           AdminUser?     @relation(fields: [authorId], references: [id], onDelete: SetNull)
  categories       PostCategory[]
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  @@index([status, type, publishedAt])
  @@index([status, isFeatured, publishedAt])
}

model Category {
  id        String         @id @default(cuid())
  slug      String         @unique
  nameEn    String
  nameNe    String?
  posts     PostCategory[]
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt
}

model PostCategory {
  postId     String
  categoryId String
  post       Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@id([postId, categoryId])
  @@index([categoryId])
}

model BibleVerse {
  id          String           @id @default(cuid())
  reference   String           // "Isaiah 6:8"
  text        String           // English text of `translation` only (never a Nepali translation)
  translation BibleTranslation @default(WEB)
  featuredOn  DateTime?        @unique @db.Date // verse of the day (UTC date)
  status      ContentStatus    @default(PUBLISHED)
  isDemo      Boolean          @default(false)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  @@index([status, featuredOn])
}

model Event {
  id              String        @id @default(cuid())
  kind            EventKind
  slug            String        @unique
  titleEn         String
  titleNe         String?
  descriptionEn   String?       // Markdown
  descriptionNe   String?
  reportEn        String?       // Markdown post-trip report
  reportNe        String?
  startsAt        DateTime
  endsAt          DateTime?
  locationEn      String?
  locationNe      String?
  volunteerInfoEn String?
  volunteerInfoNe String?
  status          EventStatus   @default(UPCOMING)   // lifecycle
  publishStatus   ContentStatus @default(DRAFT)      // visibility
  coverImageUrl   String?       // TODO(Phase 7)
  isDemo          Boolean       @default(false)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([publishStatus, status, startsAt])
}

model MediaItem {
  id              String        @id @default(cuid())
  type            MediaType
  category        MediaCategory @default(GENERAL)
  titleEn         String
  titleNe         String?
  descriptionEn   String?
  descriptionNe   String?
  url             String?       // IMAGE / AUDIO: https URL or site path. TODO(Phase 7)
  embedUrl        String?       // VIDEO_EMBED: normalized https://www.youtube-nocookie.com/embed/<id>
  altTextEn       String?       // required for IMAGE (Zod)
  altTextNe       String?
  durationMinutes Int?
  thumbnailUrl    String?       // TODO(Phase 7)
  publishedAt     DateTime      @default(now())
  isFeatured      Boolean       @default(false)
  status          ContentStatus @default(DRAFT)
  isDemo          Boolean       @default(false)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([status, isFeatured, publishedAt])
  @@index([status, category, publishedAt])
}

// ---------- inbox (Phase 6 writes, Phase 5 reads) ----------
model PrayerRequest {
  id           String       @id @default(cuid())
  name         String?
  email        String?
  isAnonymous  Boolean      @default(false)
  body         String
  shareConsent Boolean      @default(false)
  status       PrayerStatus @default(NEW)
  locale       String?      // "en" | "ne", set by the Phase 6 form
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  @@index([status, createdAt])
}

model ContactMessage {
  id           String        @id @default(cuid())
  name         String
  email        String
  kind         MessageKind   @default(GENERAL)
  subject      String
  body         String
  shareConsent Boolean       @default(false)
  status       MessageStatus @default(NEW)
  locale       String?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  @@index([status, createdAt])
}
```

The initial migration is created by the coder with `npm run db:migrate -- --name init` and committed to the working tree (not git-committed).

### 4.3 Deviations from the TASK schema (with reasons)

| Deviation | Reason |
| --- | --- |
| `Post.isFeatured`, `MediaItem.isFeatured` | Home "Featured sermons and devotionals" is driven by `featured` in the demo data; without it the home page cannot look the same. |
| `MediaItem.descriptionEn/Ne`, `durationMinutes`, `publishedAt`, `thumbnailUrl`, `status` | Featured cards show description, duration and date today; `status` makes "drafts never public" and publish/unpublish apply to media. |
| `MediaItem.altTextEn/Ne` (bilingual alt) | Alt text is user-facing text; rule "every user-facing text field has en and ne". Required = `altTextEn` for IMAGE. |
| `url` nullable | Demo media has no URL. Zod requires `url`/`embedUrl` for every create/update, so only seeded demo rows can be URL-less (editing them requires adding a URL; documented). |
| `Event.locationEn/Ne`, `volunteerInfoEn/Ne` | Demo location is localized; both are user-facing. |
| `Event.publishStatus` (in addition to lifecycle `status`) | The TASK requires publish/unpublish for events and "drafts never appear publicly"; lifecycle status (UPCOMING/COMPLETED/CANCELLED) is a different concept. |
| `BibleVerse.status` | Publish/unpublish for verses; default PUBLISHED because verses are reference data. |
| Categories have no publish state | Categories are taxonomy; they are only shown through published posts. Publish/unpublish is not meaningful for them. |
| `seoTitleEn/Ne`, `seoDescriptionEn/Ne` | SEO text is user-facing (search results) in both locales. |
| `SiteSettings.isDemo` | Keeps the hero/intro DemoBadge and DemoBanner "driven by isDemo"; owner unchecks it once real content exists. |
| `SiteSettings.id = "singleton"` | Singleton enforced by a constant primary key + upsert; there is no other insert path. |
| `AdminUser.lastTotpStep`, `sessionVersion` | TOTP replay protection; JWT revocation (section 7.3). |
| `LoginChallenge`, `LoginAttempt` models | Two-step login state and DB-backed rate limiting that works on serverless (in-memory counters reset per Vercel instance). |
| `AuditLog.actorEmail` | Keeps the log readable for CLI actions (no actor row). |
| `ContactMessage.status` values `NEW/READ/ARCHIVED`; `locale` on both inbox models | TASK left the enum open; `locale` lets Phase 6 reply in the right language. |
| No Auth.js `User/Account/Session/VerificationToken` tables | JWT session strategy (section 7.3). |
| Single-language exceptions to the bilingual rule: `SiteSettings.ministryName`, `BibleVerse.reference`, `BibleVerse.text` | `ministryName` is a proper noun and today shows identically in both locales (`site.ts` has one `name`), so one column keeps current behaviour. `reference` goes with the English verse text (A1), and Nepali Bible text must not be fabricated. These are the only deliberate exceptions. |
| "Exactly one OWNER" is enforced in application code (CLI is the only OWNER creation path; no UI changes roles) rather than a partial unique index | Prisma's schema language cannot express `WHERE role='OWNER'` partial indexes; a hand-written index would show up as drift in `migrate dev`. Backlogged. |

---

## 5. Seed (`prisma/seed.ts` + `prisma/seed-lib.ts`)

- `seed-lib.ts` exports `seedDemoContent(prisma: PrismaClient): Promise<SeedReport>` (reused by DB tests and `e2e-prepare`). `seed.ts` creates a client from `DATABASE_URL`, calls it, prints counts, disconnects; exit 1 on error with the message.
- Idempotent and non-destructive: every write is `upsert({ where: <stable key>, create: {...}, update: {} })`. Re-running never overwrites admin edits; `npm run db:reset` is the documented way back to pristine demo data.
- Sources (single source of truth, no copy-paste of content): `src/content/demo/{posts,events,verses,media}.ts` and `defaultSiteSettings` from `src/config/site.ts`.
- Mapping (every content row's primary key is its demo `id`, so existing tests that match by id, such as `demoPosts.find((p) => p.id === update.id)`, keep working):
  - Posts: key `id` (`post-1..6`, used as the primary key; `slug` copied as is). `type`, `titleEn/Ne`, `excerptEn/Ne`, `scriptureRefs`, `publishedAt`, `isFeatured = featured ?? false`, `status: PUBLISHED`, `bodyEn: ""`, `isDemo: true`, `authorId: null`.
  - Events: key `id` (`event-1..`, used as the primary key). `slug`, `kind` and `startsAt` copied, `titleEn/Ne` from `title.en/.ne`, `locationEn/Ne` from `location.en/.ne` (demo events have no description, end date or report, so those stay null), `status` as stored, `publishStatus: PUBLISHED`, `isDemo: true`.
  - Verses: key `id` (the demo ids `isaiah-6-8` etc. are used as primary keys). `isaiah-6-8` gets `featuredOn = 2026-01-01` (fixed past date, so it is "the most recent featured verse" forever and the home page is deterministic); others `featuredOn: null`. `status: PUBLISHED`, `isDemo: true` (required: `FeaturedVerse.tsx` renders its DemoBadge only when `verse.isDemo`).
  - Media: key `id` (`media-1..3`). Demo `kind` mapping keeps today's labels: `SERMON` -> `{ type: VIDEO_EMBED, category: SERMON }`, `VIDEO` -> `{ type: VIDEO_EMBED, category: GENERAL }`, `AUDIO` -> `{ type: AUDIO, category: PODCAST }`. `titleEn/Ne` from `title.en/.ne`, `descriptionEn/Ne` from `description.en/.ne`, `thumbnailUrl` copied (null today), `embedUrl/url: null`, `durationMinutes`, `publishedAt`, `isFeatured`, `status: PUBLISHED`, `isDemo: true`.
  - SiteSettings: key `id: "singleton"`, create from `defaultSiteSettings`.
  - No categories, no admin users, no inbox rows are seeded (users come from the CLI).
  - Seed DB test (`prisma/seed.db.test.ts`) asserts that every seeded row in Post, Event, BibleVerse and MediaItem has `isDemo = true`, that `SiteSettings.isDemo = true`, that `socialLinks` equals `[]`, and that post/event/verse/media ids equal the demo ids.
- `src/config/site.ts` becomes:
  - `siteConfig = { siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000" }` + `getSiteConfig()` (still used by sitemap/robots/metadataBase).
  - `defaultSiteSettings` typed as the `SiteSettings` create input: `ministryName: "Demo Ministry"`, `contactEmail: "hello@example.org"`, `taglineEn/Ne` = current `Home.heroEyebrow` en/ne values, `missionStatementEn/Ne` = current `Home.missionStatement`, `aboutIntroEn/Ne` = `Home.introBody1 + "\n\n" + Home.introBody2` (both locales, copied verbatim from the message files), `socialLinks: []` (renders exactly like today's three placeholder rows; see the footer rule in 6.3), `vision/values/statementOfFaith: null` (no invented details), `isDemo: true`, flags false.
  - Those four keys (`heroEyebrow`, `missionStatement`, `introBody1`, `introBody2`) are removed from BOTH `messages/en.json` and `messages/ne.json` (parity test stays green). `messages.test.ts` keeps forbidding "Demo Ministry" in messages; the only literal is in `site.ts`.

---

## 6. Data access and public site

### 6.1 Prisma client (`src/lib/db.ts`, `import "server-only"`)

```ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
const g = globalThis as unknown as { prisma?: PrismaClient };
function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. See README > Local database.");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}
export const prisma = g.prisma ?? create();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
```
Lazy failure: the throw happens when the module is first imported at request/build time, which is the desired loud failure (A5). The `new PrismaClient({ adapter })` construction itself lives in a pure `src/lib/prisma-factory.ts` (`createPrismaClient(url: string): PrismaClient`). `db.ts` and every script use it, so there is one construction path. Vitest aliases `server-only` to an empty module (section 17.1).

### 6.1a Pure vs `server-only` modules (scripts run under plain `tsx`)

`server-only` throws when imported outside the `react-server` condition, and `tsx` scripts (`create-owner`, `e2e-prepare`, seed, `local-db`, `assert-local-db`) run without that condition. So:

- Pure: no `server-only` import, no `next/*` imports, no `@/lib/db`. Safe for scripts and app alike:
  - `src/lib/prisma-factory.ts`
  - `src/server/auth/password.ts`
  - `src/server/auth/totp.ts`
  - `src/server/auth/secret-box.ts`: `seal(plaintext, aad, key = readTotpKey())` / `open(sealed, aad, key = readTotpKey())`; the key is a parameter with a default.
  - `src/server/auth/keys.ts` (new): `readTotpKey(env = process.env): Buffer` (base64 that decodes to exactly 32 bytes, else throws `ConfigError("TOTP_ENCRYPTION_KEY must be base64 for 32 bytes")`) and `readAuthSecret(env = process.env): string` (>= 32 chars, else `ConfigError`).
  - `src/server/auth/lockout.ts` (`reserveCredentialAttempt`, `refundCredentialAttempt`, `applyLock`, section 7.6; each takes a Prisma client or transaction as a parameter)
  - `src/lib/validation/*`, `src/lib/localize.ts`, `src/lib/content-mappers.ts`, `src/lib/site-settings-mappers.ts`, `src/config/site.ts`, `src/config/social.ts`, `src/content/demo/*`, `prisma/seed-lib.ts`
  - `scripts/local-db.ts`, `scripts/assert-local-db.ts`

  These modules pull in `node:crypto` / `@node-rs/argon2`, so a client component importing them fails the client build anyway. That is an adequate guard without `server-only`.
- `server-only`: `src/lib/env.ts` (a thin wrapper: `getTotpKey = () => readTotpKey()`, `getAuthSecret = () => readAuthSecret()`, memoized), `src/lib/db.ts`, `src/lib/site-settings.ts`, `src/lib/content.ts` (via `db.ts`), `src/lib/markdown.ts`, `src/server/auth/{guards,login,rate-limit}.ts`, `src/server/services/*`, `src/server/actions/run-admin-action.ts`, `src/auth.ts`.
- Static test `src/test/script-imports.test.ts`: no file under `scripts/**` or matching `prisma/seed*.ts` imports (directly, by import specifier) `@/lib/db`, `@/lib/env`, `@/server/auth/guards`, `@/server/auth/login`, `@/server/services/`, `@/server/actions/` or `@/auth`. It also asserts that the pure-module list above contains no `import "server-only"`.

`src/generated/` is gitignored and ignored by ESLint/Prettier; it is produced by `postinstall` and `pretypecheck`. UNVERIFIED: that Turbopack bundles the Prisma 7 `prisma-client` output without extra config. Verify with `npm run build`; if it fails, add `serverExternalPackages: ["@prisma/adapter-pg", "pg"]` (and only that) to `next.config.ts`.

### 6.2 `src/lib/content.ts` (same function names; Prisma inside)

View models keep their current fields and ISO-string dates, so components keep working. Types:
- `PostSummary.type: PostType`, `EventSummary.kind/status` and `VerseView.translation` use the Prisma enum types imported type-only from `@/generated/prisma/enums` (erased at runtime; safe for client components).
- `MediaSummary.kind: "SERMON" | "VIDEO" | "AUDIO" | "IMAGE"` = display kind via `mediaDisplayKind(type, category)`: `category === SERMON` -> `SERMON`; else `VIDEO_EMBED` -> `VIDEO`; `AUDIO` -> `AUDIO`; `IMAGE` -> `IMAGE`. Add `MediaKinds.IMAGE` to both message files ("Image" / "तस्बिर").
- `MediaSummary.durationMinutes: number | null`; `FeaturedContent.tsx` renders the minutes span only when non-null (one-line change).
- Nullable columns vs non-null view-model fields (in `content-mappers.ts`): `MediaSummary.description = pick(descriptionEn, descriptionNe, locale) ?? ""` and `FeaturedContent.tsx` renders the description `<p>` only when it is non-empty; `PostSummary.publishedAt = (row.publishedAt ?? row.createdAt).toISOString()` (a PUBLISHED post always has `publishedAt` set by the service, but the mapper never yields `null` to `new Date()`); `EventSummary.description` (if exposed) follows the media rule. Mapper unit tests cover both null cases.

Functions (all filter on PUBLISHED; mapping functions are exported separately from `src/lib/content-mappers.ts` so they are unit-testable without a DB):
- `getRecentUpdates(locale, limit = 3)`: `post.findMany({ where: { status: PUBLISHED, type: MINISTRY_UPDATE }, orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }], take: limit })`.
- `getFeaturedContent(locale, limit = 3)`: posts `{ status: PUBLISHED, type: DEVOTIONAL, isFeatured: true }` take `limit` + media `{ status: PUBLISHED, isFeatured: true }` take `limit`, merged, sorted by `publishedAt` desc, sliced to `limit`.
- `getUpcomingEvents(locale, limit = 3)`: `{ publishStatus: PUBLISHED, status: UPCOMING }` order `startsAt asc`. Status remains stored (deterministic builds), as decided in Phase 2.
- `getVerseById(id)`: published only, else `null`.
- `getFeaturedVerse(now = new Date())`: returns `VerseView | null` (signature change: was non-null and threw). Order: published verse with `featuredOn = todayUTC`; else the published verse with the greatest `featuredOn <= todayUTC`; else the most recently created published verse; else `null`. Home page: `{verse ? <FeaturedVerse .../> : null}`.
- Text resolution through `pick()`; `location` falls back to `""` when both are null (UpcomingEvents renders it as-is; the pin icon stays, acceptable).

`src/lib/content.test.ts` (9 existing tests, demo-array based) is renamed to `src/lib/content.db.test.ts` and its 9 cases are kept with identical names and intent, now asserting against a seeded `mission_unit` DB (the demo arrays are still imported to compare text). The "demo data makes no tax claims / no Nepali scripture quotes" checks still run against the demo arrays. New cases are listed in 17.2.

### 6.3 Site settings (`src/lib/site-settings.ts`, `import "server-only"`)

- `getSiteSettings = cache(async () => { const row = await prisma.siteSettings.findUnique({ where: { id: "singleton" } }); return row ?? { ...defaultSiteSettings, id: "singleton", updatedAt: new Date(0) }; })` using React `cache` for per-request dedupe (Header, Footer, Hero, metadata all call it).
- Fallback policy: a missing row (not seeded yet) -> defaults + `console.warn("[site-settings] singleton row missing; using defaults")` once per process. A DB error is NOT swallowed: it propagates (build fails / runtime error page). Swallowing errors would ship a wrong-but-static page.
- `getLocalizedSiteSettings(locale)` -> `{ name, tagline: string | null, missionStatement: string | null, aboutIntroParagraphs: string[], contactEmail, socialLinks: { platform, label, url: string | null }[], logoUrl, isDemo }`. The mapping is the pure `toLocalizedSiteSettings(row, locale)` in `src/lib/site-settings-mappers.ts` (unit tested). `aboutIntroParagraphs` = `pick(...)` split on `/\n\s*\n/`, trimmed, empties removed. `tagline` / `missionStatement` resolve to `null` when the picked value is null or whitespace.
- Social links rule (one rule for save, read and render):
  - `src/config/social.ts` exports `SOCIAL_PLATFORMS = { facebook: "Facebook", youtube: "YouTube", instagram: "Instagram", x: "X", tiktok: "TikTok", whatsapp: "WhatsApp", website: "Website" } as const` (key order = display order) and `PLACEHOLDER_PLATFORMS = ["facebook", "youtube", "instagram"]`.
  - On save, the settings action stores only platforms with a non-empty URL, as `[{ platform, url }]` in `SOCIAL_PLATFORMS` order.
  - On read, the stored JSON is parsed with `storedSocialLinksSchema` (array of `{ platform: keyof SOCIAL_PLATFORMS, url: https string }`). Invalid entries are dropped and logged with `log.warn("site-settings.social.invalid")`. Labels always come from `SOCIAL_PLATFORMS`, never from the DB.
  - Mapper output: if at least one valid entry exists, those entries with their URLs. Otherwise `PLACEHOLDER_PLATFORMS` mapped to `{ platform, label, url: null }`, which is exactly today's three "Facebook (placeholder)" rows.
  - The seed stores `[]`, and an owner saving Settings without entering any social URL keeps storing `[]`. Neither the seed nor AC10's settings E2E changes the footer.
  - Unit test `site-settings-mappers.test.ts`: `[]` gives 3 placeholders; one URL gives exactly that one link labelled from the constant; an unknown platform or a non-https URL is dropped.
- Empty-value render rules:
  - Hero omits the eyebrow `<p>` and its gold rule when `tagline` is null, and omits the mission `<p>` when `missionStatement` is null.
  - MinistryIntro keeps its eyebrow and title and renders no body paragraphs when `aboutIntroParagraphs` is empty.
  - The Footer `missionLine` stays a message key, unchanged.
- Consumers changed (each is an `async` server component already, or becomes one): `Header.tsx` (name, logo), `Footer.tsx` (name, email, social), `Hero.tsx` (name, tagline as eyebrow, mission statement, DemoBadge if `isDemo`), `MinistryIntro.tsx` (paragraphs from `aboutIntroParagraphs`, DemoBadge if `isDemo`; `introEyebrow/introTitle/introPanelLabel` stay in messages), `PlaceholderPage.tsx` (email), `[locale]/layout.tsx` (`generateMetadata` name; DemoBanner rendered only if `isDemo`), `src/lib/metadata.ts` (`buildPageMetadata` takes `siteName` as a parameter; `localizedPageMetadata` awaits settings). Header layout/nav are NOT changed: only the text source of the name changes. If `logoUrl` is set, Header and Footer render `<img src={logoUrl} alt="" className="... object-contain">` in place of `<Logo decorative />`. It is decorative because the name text sits next to it. The eslint rule `@next/next/no-img-element` is disabled on that line with `TODO(Phase 7): next/image + Blob`. Sizes match today's SVG: `size-9` in the header (Logo's default) and `size-10` in the footer.
- Footer social: `url` null -> current placeholder rendering (`{label} {t("placeholder")}`); `url` set -> `<a href={url} rel="noopener noreferrer" className={linkClass}>{label}</a>`.
- Footer DemoBadge: rendered only when `isDemo` (today it is unconditional). The "Demonstration site." wording in the copyright message and `Metadata.siteDescription` stays as it is until Phase 3 content work. The README admin guide notes that this text remains after unchecking "Demo site".

### 6.4 Caching and revalidation

Decision: keep public pages statically generated (as today: `generateStaticParams` for both locales) and invalidate on demand from server actions with `revalidatePath("/[locale]", "layout")`, which marks every page under the locale layout stale; the next request renders fresh. No `unstable_cache` and no `cacheComponents`/`"use cache"`:
- `cacheComponents` would change rendering semantics app-wide (Suspense requirements, next-intl `setRequestLocale` interplay) for a small site: too much risk for Phase 4.
- `unstable_cache` + tags is legacy in Next 16 and duplicates the full-route cache; with one layout-wide invalidation the site is always consistent (header name + home sections + metadata together).
- Revalidating the whole locale tree on each edit is cheap at this size (two locales x ~12 pages).

Additionally `src/app/[locale]/page.tsx` exports `export const revalidate = 3600` so the "verse of the day" rolls over within an hour of UTC midnight without an edit. Nothing else gets time-based revalidation.

Admin pages are dynamic (they read cookies via `auth()`), so they are never cached. Actions that change admin lists also call `revalidatePath("/admin", "layout")` so the client router cache refreshes.

UNVERIFIED: that `revalidatePath` from a Server Action makes the very next `next start` request render fresh (not stale-while-revalidate) in 16.4.3. E2E criteria 9 and 10 verify it. Fallback if they fail: wrap the public reads (`content.ts` functions and `getSiteSettings`) in `unstable_cache` with tag `"public-content"` and call `updateTag("public-content")` (documented as Server-Action read-your-writes in the 16.4.3 type definitions) alongside `revalidatePath`. The coder must report which path was needed.

### 6.5 Proxy, sitemap, robots

- `src/proxy.ts`: matcher becomes `"/((?!api(?:/|$)|admin(?:/|$)|trpc(?:/|$)|_next|_vercel|.*\\..*).*)"`. The segment-anchored lookahead keeps `/administration` or `/admins` localized; the old bare `api|admin` prefixes excluded them. Next.js requires `export const config` to be a static literal, so the matcher stays inline in `proxy.ts`. `src/lib/admin-path.test.ts` reads `src/proxy.ts` as text, extracts the `matcher` string literal with a regex, unescapes it via `JSON.parse`, compiles it as `new RegExp("^" + matcher + "$")` and asserts: `/admin`, `/admin/posts`, `/api/auth/session` and `/icon.svg` do not match, while `/`, `/en`, `/administration` and `/ne/about` do. The default export wraps next-intl: `export default function proxy(req: NextRequest) { if (isAdminPath(req.nextUrl.pathname)) return NextResponse.next(); return intlMiddleware(req); }` where `isAdminPath(p) = p === "/admin" || p.startsWith("/admin/")` lives in `src/lib/admin-path.ts` (unit tested). Belt and braces: the matcher keeps the proxy from running at all; the guard keeps it correct if someone edits the matcher. Proxy does NOT do auth (not a security boundary).
- `src/app/robots.ts`: `rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }]`.
- `src/app/sitemap.ts`: unchanged route list (no admin); a unit test asserts no URL contains `/admin`.
- Route precedence: `src/app/admin/*` is a static segment and wins over `src/app/[locale]`.

---

## 7. Authentication

### 7.1 Files

- `src/auth.ts`: `export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)`.
- `src/app/api/auth/[...nextauth]/route.ts`: `export const { GET, POST } = handlers;` (the only route handler in this phase; already excluded from the proxy by `api`).
- `src/server/auth/password.ts`: Argon2id hash/verify (pure, 6.1a).
- `src/server/auth/totp.ts`: otplib wrappers (pure).
- `src/server/auth/secret-box.ts`: AES-256-GCM (pure; key parameter defaults to `readTotpKey()`).
- `src/server/auth/keys.ts`: `readTotpKey`, `readAuthSecret` (pure).
- `src/server/auth/lockout.ts`: `reserveCredentialAttempt(db, userId, now)`, `refundCredentialAttempt(db, userId)`, `applyLock(db, userId, now)` (pure; shared by login step 1, the TOTP step and change-password).
- `src/server/auth/login.ts`: login service (`beginLogin`, `completeLogin`), clock injectable.
- `src/server/auth/rate-limit.ts`: IP hashing + `reserveIpAttempt(db, ipHash, now)` (insert-then-count, returns `{ attemptId, limited }`).
- `src/server/auth/guards.ts`: `getCurrentAdmin`, `requireAdmin`, `requireOwner`, `requireAdminPage`, `requireOwnerPage`, `AuthzError`.
- `src/server/actions/auth.ts` (`"use server"`): `startLoginAction`, `completeLoginAction`, `cancelLoginAction`, `logoutAction`.
- `src/types/next-auth.d.ts`: augment `Session.user` with `id`, `role`, `sessionVersion`; JWT with `uid`, `role`, `sv`.
- `src/lib/env.ts` (`server-only`): memoized lazy getters `getAuthSecret()`, `getTotpKey()` that delegate to `keys.ts` (app code uses these; scripts call `keys.ts` directly).

### 7.2 Auth.js config

```ts
NextAuth({
  trustHost: true,               // Vercel + next start on localhost:3210
  session: { strategy: "jwt", maxAge: 60 * 60 * 8, updateAge: 60 * 15 },
  pages: { signIn: "/admin/login", error: "/admin/login" },
  providers: [Credentials({
    id: "admin-totp",
    credentials: { challenge: {}, code: {} },
    authorize: async (raw) => completeLogin({ challengeToken: raw.challenge, code: raw.code, ip }) // returns AdminUser view or throws InvalidLoginError (extends CredentialsSignin)
  })],
  callbacks: {
    jwt({ token, user }) { if (user) { token.uid = user.id; token.role = user.role; token.sv = user.sessionVersion; } return token; },
    session({ session, token }) { session.user = { ...session.user, id: token.uid, role: token.role, sessionVersion: token.sv }; return session; },
  },
});
```
- `AUTH_SECRET` is read by Auth.js from env (required; validated by `getAuthSecret()` at login time too: >= 32 chars).
- Cookies: Auth.js defaults are kept deliberately: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` + `__Secure-` prefix whenever the request is https (Vercel). On `http://localhost` (dev, E2E) cookies are not Secure, which browsers require for http. Lax (not Strict) because Lax already blocks cross-site POSTs and Server Actions additionally verify `Origin`; overriding Auth.js cookie definitions risks breaking its CSRF/callback cookies. `authorize` gets `ip` from `headers()` (`x-forwarded-for` first hop, else `x-real-ip`, else `"unknown"`).
- No `SessionProvider` / `useSession`: the session never needs to reach client JS.

### 7.3 JWT vs database sessions

Chosen: JWT (encrypted JWE cookie signed with `AUTH_SECRET`) plus a per-request DB check. Auth.js does not support database sessions with the Credentials provider out of the box (it documents JWT for credentials), so DB sessions would require custom session-token plumbing. JWT alone cannot be revoked, so `getCurrentAdmin()` loads the user by `token.uid` on every guarded request and requires `isActive === true && sessionVersion === token.sv`. `sessionVersion` is incremented on: deactivate, 2FA reset, password change (own or by owner), owner `--reset` via CLI, logout, and a change-password lockout. Logout also bumps it (section 7.6). This gives immediate revocation with one indexed primary-key lookup per request (deduped with React `cache`). Role and name are always taken from the DB row, never trusted from the token.

### 7.4 Password hashing (`password.ts`)

- `hashPassword(pw)`: `@node-rs/argon2` `hash(pw, { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 })` (OWASP baseline; verified it produces `$argon2id$v=19$m=19456,t=2,p=1...`).
- `verifyPassword(hash, pw)`: `verify(hash, pw)`; returns false on malformed hash (catch).
- `DUMMY_HASH`: computed lazily once per process (`hashPassword(randomBytes(32).toString("hex"))`) and verified against when the user is unknown/inactive/locked, so response timing does not reveal account existence.
- Password policy (Zod `passwordSchema`): string, 12..128 chars, must not equal the email (case-insensitive). No composition rules (NIST 800-63B).

### 7.5 TOTP and secret encryption

- `totp.ts`: `newTotpSecret()` = `generateSecret()` (base32, 32 chars, 160 bit); `otpauthUri({ secret, email, issuer })` = `generateURI({ issuer, label: email, secret })` with `issuer = "<ministryName> Admin"`; `verifyTotp(secret, code, lastStep)` = `verify({ secret, token: code, epochTolerance: 30, afterTimeStep: lastStep ?? undefined })` -> `{ valid, timeStep }`. Spike confirmed reuse is rejected when `afterTimeStep` is the accepted step.
- `secret-box.ts`: `seal(plaintext, aad)` / `open(sealed, aad)` with `aes-256-gcm`, 12-byte random IV, 16-byte tag, AAD bound to the row (`totp:<userId>` or `enroll:<userId>`) so ciphertexts cannot be swapped between users. Format `v1:<iv b64url>:<tag b64url>:<ct b64url>`. Key: `TOTP_ENCRYPTION_KEY` = base64 of exactly 32 bytes (`readTotpKey()` in `keys.ts` throws `ConfigError("TOTP_ENCRYPTION_KEY must be base64 for 32 bytes")` otherwise; fatal configuration error, logged at `error`, user sees the generic login error). `open` throws on unknown version, malformed input, tag mismatch. Key rotation is backlog (the `v1` prefix leaves room).

### 7.6 Two-step login flow

Step 1 (`startLoginAction(prev, formData)`, public action):
1. Zod `loginStep1Schema`: `email` trimmed, lower-cased, `z.email()`, max 254; `password` string 1..256. Failure -> `{ ok: false, fieldErrors }` (no DB work).
2. IP rate limit, insert-then-count (`rate-limit.ts` `reserveIpAttempt(db, ipHash, now)`): `ipHash = sha256(AUTH_SECRET + ip)`. FIRST insert `LoginAttempt { ipHash, success: false, userId: null }` (autocommitted), THEN `count(LoginAttempt where ipHash, success=false, createdAt > now-15m)`, which includes this row. If the count is > 20, return `{ ok: false, formError: RATE_LIMITED_MSG }` ("Too many sign-in attempts from this network. Please wait 15 minutes and try again.") without loading the user or checking the password. Because every request's row is committed before it counts, the k-th committed request sees at least k rows, so at most 20 requests per window get past this step even when fired in parallel. The returned `attemptId` is updated later (`userId`, and `success: true` on password success) instead of inserting a second row.
3. Load user by email. If missing: `verifyPassword(DUMMY_HASH, password)`, return `{ ok: false, formError: GENERIC_MSG }` ("Email or password is incorrect.").
4. Reserve-then-verify (`lockout.ts` `reserveCredentialAttempt(db, userId, now)`), one atomic statement BEFORE any Argon2 work:
   ```ts
   const rows = await db.$queryRaw<{ failedLoginCount: number }[]>`
     UPDATE "AdminUser" SET "failedLoginCount" = "failedLoginCount" + 1
     WHERE id = ${userId} AND "isActive" = true AND ("lockedUntil" IS NULL OR "lockedUntil" <= ${now})
     RETURNING "failedLoginCount"`;
   ```
   - No row (inactive or currently locked): verify `DUMMY_HASH`, return GENERIC_MSG.
   - Returned count > 5 (other in-flight requests already used the budget): `applyLock(db, userId, now)`, verify `DUMMY_HASH`, return GENERIC_MSG. Applying the lock here also self-heals a counter left above 5 by a crashed request.
   - Count 1..5: `verifyPassword(user.passwordHash, password)`.
     - Wrong: if the reserved count is 5, `applyLock(db, userId, now)`. Then write audit `auth.login.failed` (metadata `{ step: "password" }`) and return GENERIC_MSG. The counter was already incremented by the reservation.
     - Correct: refund the reservation (`UPDATE "AdminUser" SET "failedLoginCount" = GREATEST("failedLoginCount" - 1, 0) WHERE id = ...`), so a correct password neither counts as a failure nor clears earlier failures. Counters are only fully reset after the TOTP step succeeds; otherwise an attacker who knows the password could get unlimited TOTP guesses by restarting step 1.
   - `applyLock(db, userId, now, opts?: { bumpSessionVersion?: boolean })` (pure, `lockout.ts`): in one transaction, `updateMany({ where: { id: userId, OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] }, data: { lockedUntil: now + 15m, failedLoginCount: 0, ...(opts?.bumpSessionVersion ? { sessionVersion: { increment: 1 } } : {}) } })`, and only when that affected 1 row, write audit `auth.lockout`. Returns `{ locked: true, newlyLocked: count === 1 }`, so concurrent callers produce one lock and one audit row.
   This guarantees at most 5 real-hash verifications per user between locks, regardless of concurrency. `recordFailedCredential` from revision 1 is replaced by `reserveCredentialAttempt` + `applyLock` + `refundCredentialAttempt`, all in `lockout.ts`, all taking a Prisma client/transaction parameter.
5. Correct: update the attempt row (`userId`, `success: true`), delete the user's unconsumed challenges, create `LoginChallenge` with random 32-byte token (`randomBytes(32).toString("base64url")`), store `sha256(token)`, `expiresAt = now + 5m`, purpose `VERIFY` if `totpEnabled` else `ENROLL` (new secret sealed into `pendingSecretEnc`). Set cookie `admin_login_challenge=<token>` (`httpOnly`, `sameSite: "strict"`, `path: "/admin"`, `maxAge: 300`, `secure` when the request is https per `x-forwarded-proto`). `failedLoginCount` is NOT reset yet. Return `{ ok: true, step: "verify" }` or `{ ok: true, step: "enroll", otpauthUri, secret, qrSvg }` (QR via `qrcode.toString(uri, { type: "svg", margin: 1 })`, rendered as an `<img src="data:image/svg+xml;utf8,...">` with alt "QR code for your authenticator app" plus the secret in grouped text for manual entry).

Step 2 (`completeLoginAction(prev, formData)`, public action):
1. Zod `code`: `/^\d{6}$/` after removing spaces. Failure -> field error.
2. Read the challenge cookie; missing -> `{ ok: false, step: "credentials", formError: "Your sign-in session expired. Please start again." }`.
3. Call `signIn` and map its errors:
   ```ts
   try { await signIn("admin-totp", { challenge, code, redirect: false }); }
   catch (e) {
     unstable_rethrow(e);                       // Next redirect/notFound control-flow errors propagate
     if (e instanceof InvalidLoginError) {      // AuthError subclasses pass through Auth.js unwrapped (verified in @auth/core 0.41.3)
       if (e.code === "invalid_code") return { ok: false, step: <same>, fieldErrors: { code: "That code didn't work. Check the time on your phone and try again." } };
       return { ok: false, step: "credentials", formError: "Your sign-in session expired. Please start again." }; // "challenge_expired"
     }
     // Anything else thrown in authorize (bad TOTP key, decrypt tag mismatch, DB error) arrives as CallbackRouteError
     log.error("auth.login.error", { name: (e as Error).name, cause: (e as { cause?: { err?: Error } }).cause?.err?.name });
     return { ok: false, step: "credentials", formError: GENERIC_MSG };
   }
   ```
   Unexpected errors are never rethrown, so the user sees GENERIC_MSG as in the section 16 table, and the cause shows up only in the server log. DB test: a user whose `totpSecretEnc` was corrupted (one ciphertext char flipped) gets GENERIC_MSG from `completeLoginAction`, and `log.error` was called.
4. Success: delete the cookie, `redirect(safeNext(formData.get("next")) ?? "/admin")`. Source of `next`: the login page reads `searchParams.next` (set by `requireAdminPage`) and passes it as a hidden `<input name="next">` on both step forms (step 1 echoes it into its result so the step-2 form keeps it). `safeNext(v)` returns `v` only when it is a string matching `/^\/admin(\/[\w\-/]*)?$/`, else `null` (open-redirect protection; a unit test covers `//evil.com`, `https://evil.com`, `/admin/../x`, `/administration`).

`completeLogin()` (called only from `authorize`, so a session can never be minted without the TOTP check, even via a direct POST to `/api/auth/callback/admin-totp`, which additionally needs Auth.js's CSRF token):
Every check here is an atomic conditional write, never a read followed by a write (review revision 2, finding 3):
1. IP limit: `reserveIpAttempt` exactly as in step 1.2 (insert-then-count; > 20 -> throw `challenge_expired`, which the action shows as "start again"; the rate-limit message is shown on the next step-1 attempt).
2. Reserve a challenge attempt atomically: `const r = await prisma.loginChallenge.updateMany({ where: { tokenHash: sha256(token), consumedAt: null, expiresAt: { gt: now }, attempts: { lt: 5 } }, data: { attempts: { increment: 1 } } })`. `r.count !== 1` -> throw `challenge_expired`. Then load the challenge with its user (by `tokenHash`).
3. Reserve an account attempt: `reserveCredentialAttempt(prisma, user.id, now)` (step 1.4). No row -> throw `challenge_expired`; count > 5 -> `applyLock`, throw `challenge_expired`.
4. Secret = `open(pendingSecretEnc, "enroll:<id>")` for ENROLL or `open(user.totpSecretEnc, "totp:<id>")` for VERIFY.
5. `verifyTotp(secret, code, user.lastTotpStep)`. Invalid: if the reserved account count is 5, `applyLock`; audit `auth.login.failed { step: "totp" }`; throw `invalid_code`, or `challenge_expired` when the challenge's `attempts` (after the increment) is 5 or the account got locked.
6. Valid: one transaction with two conditional writes that must each affect exactly one row:
   ```ts
   await prisma.$transaction(async (tx) => {
     const c = await tx.loginChallenge.updateMany({ where: { id: challenge.id, consumedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } });
     const u = await tx.adminUser.updateMany({
       where: { id: user.id, isActive: true, OR: [{ lastTotpStep: null }, { lastTotpStep: { lt: timeStep } }] },
       data: { lastTotpStep: timeStep, failedLoginCount: 0, lockedUntil: null, lastLoginAt: now,
               ...(enroll ? { totpSecretEnc: seal(secret, `totp:${user.id}`), totpEnabled: true } : {}) },
     });
     if (c.count !== 1 || u.count !== 1) throw new InvalidLoginError("challenge_expired"); // rolls back both
     await tx.loginAttempt.update({ where: { id: attemptId }, data: { success: true, userId: user.id } });
     await tx.auditLog.create({ data: { actorId: user.id, actorEmail: user.email, action: "auth.login.success", entityType: "AdminUser", entityId: user.id } });
     // ENROLL also writes "auth.totp.enrolled"
   });
   ```
   Two parallel completions with the same challenge and code: Postgres row locks serialize the `UPDATE`s, the second sees `consumedAt` set (or `lastTotpStep` already equal to `timeStep`) and affects 0 rows, so exactly one session is minted. Returns `{ id, email, name, role, sessionVersion }`.

Housekeeping: on every `startLoginAction`, `deleteMany` LoginAttempt older than 24 h and LoginChallenge with `expiresAt < now - 1h` (both indexed).

`cancelLoginAction`: deletes the cookie and the challenge, and returns to step 1.

`logoutAction`:
1. `requireAdmin()`. If that throws `AuthzError`, just `signOut({ redirectTo: "/admin/login" })`, which clears the stale cookie.
2. In one transaction, `sessionVersion += 1` and audit `auth.logout`.
3. `signOut({ redirectTo: "/admin/login" })`.

Bumping `sessionVersion` revokes the JWT on the server, so a copied cookie stops working right away (review finding 20). The trade-off, documented in the admin guide: logging out signs that admin out on all devices. That is acceptable for a handful of admins, and it is the safer default.

Enumeration safety: identical GENERIC_MSG for unknown email, wrong password, inactive, locked. The login page shows a static note: "For security, sign-in pauses for 15 minutes after 5 unsuccessful attempts." Known trade-off: an attacker can lock out a known account for 15 minutes (DoS); acceptable for a small ministry; owner recovery `npm run admin:create-owner -- --reset` also unlocks.

Editor first login risk: an editor created by the owner enrols TOTP on first successful password login, so whoever first knows the temporary password can enrol. Mitigation documented in the admin guide: share the temporary password privately, have the editor sign in promptly; the owner sees `totpEnabled` ("2FA: set up / pending") on the Users page and can reset it.

### 7.7 Authorization guards (`src/server/auth/guards.ts`, `import "server-only"`)

```ts
export type AdminActor = { id: string; email: string; name: string; role: AdminRole };
export class AuthzError extends Error { constructor(public code: "UNAUTHENTICATED" | "FORBIDDEN") { super(code); } }
export const getCurrentAdmin = cache(async (): Promise<AdminActor | null> => resolveActor(await auth(), loadUserById));
export function resolveActor(session, load): Promise<AdminActor | null> // pure logic, unit tested with fakes
export async function requireAdmin(): Promise<AdminActor>   // throws AuthzError("UNAUTHENTICATED")
export async function requireOwner(): Promise<AdminActor>   // UNAUTHENTICATED or FORBIDDEN (role !== OWNER)
export async function requireAdminPage(path: string): Promise<AdminActor> // redirect(`/admin/login?next=${encodeURIComponent(path)}`)
export async function requireOwnerPage(path: string): Promise<AdminActor> // + redirect("/admin/forbidden") for EDITOR
```

Where they are called (the invariant "authorization is server-side" is owned by the page/action layer, not the proxy or the UI):
- Every `page.tsx` under `src/app/admin/(dashboard)/**` awaits `requireAdminPage()` or `requireOwnerPage()` as its first statement, outside any Suspense boundary. There are no `loading.tsx` files under `src/app/admin/`, so nothing has been streamed yet when the guard runs, and `redirect()` produces a real 307 (section 12). The `(dashboard)/layout.tsx` does NOT redirect: it calls `getCurrentAdmin()` and renders `<AdminShell actor={actor}>{children}</AdminShell>` only when the actor is non-null, else returns `null`. The redirect is left to the page guard, so `next` is always the page's own path (layouts and pages render concurrently, and a layout redirect would race with `next=/admin`). Layouts are never relied upon for authorization, because they don't re-run on every client navigation and can be bypassed by direct RSC requests.
- `/admin/login` page: if `getCurrentAdmin()` returns a user, `redirect("/admin")`.
- Every mutation server action goes through `runAdminAction({ role })` (section 8), which calls `requireAdmin()` / `requireOwner()` before parsing input. The allow-listed exceptions are the login actions (public by nature), plus `logoutAction`, `previewMarkdownAction` and `changePasswordAction`, which each call `requireAdmin()` themselves. A static test enforces this (section 8).
- `src/server/services/inbox.ts`: every exported function calls `await requireAdmin()` itself (defence in depth for private data), in addition to the page/action guard.
- Route handlers: only Auth.js's. Any future admin route handler must call `requireAdmin()` and return `401`/`403` JSON (documented in README developer notes).
- Owner-only: settings (page + action), users (page + all user actions), audit log (page). Editors: everything else incl. inbox and their own account.

---

## 8. Admin mutations: one wrapper for guard, validation, audit, revalidation

`src/server/actions/run-admin-action.ts` starts with `import "server-only"` and has NO `"use server"` directive. It is a plain server helper. Exported functions in a `"use server"` file become callable endpoints, and the wrapper itself must never be one. The `formDataToObject` helper lives next to it, in the same non-`"use server"` file. Every other file in `src/server/actions/` begins with `"use server"`.

```ts
export type ActionResult<T = undefined> =
  | { ok: true; message: string; data?: T }
  | { ok: false; code: "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "CONFLICT" | "NOT_FOUND" | "LIMIT" | "ERROR";
      formError?: string; fieldErrors?: Record<string, string> };

export async function runAdminAction<S extends z.ZodType, T>(def: {
  name: string;                    // "post.update" (also the AuditLog action)
  role: "ADMIN" | "OWNER";
  schema: S;
  entityType: string;
  revalidate: Array<"public" | "admin">;
  successMessage: string;
  run: (tx: Tx, input: z.output<S>, actor: AdminActor) => Promise<{ entityId: string | null; metadata?: Json; data?: T }>;
}, raw: unknown): Promise<ActionResult<T>>
```

Order: (1) guard by role -> `AuthzError` mapped to `{ ok:false, code }` with messages "Your session has expired. Please sign in again." / "You don't have permission to do that."; logged `warn` `{ action, code, actorId? }`. (2) `schema.safeParse(raw)` -> `VALIDATION` with `fieldErrors` from `z.flattenError(err).fieldErrors` first message per field; not logged. (3) `prisma.$transaction(async (tx) => { const r = await def.run(tx, input, actor); await tx.auditLog.create({ data: { actorId, actorEmail, action: def.name, entityType, entityId: r.entityId, metadata: r.metadata } }); return r; })` — audit is in the same transaction, so a mutation without an audit row is impossible and a failed mutation leaves no audit row (invariant owned by this wrapper; services never write audit rows themselves). (4) `revalidatePath("/[locale]", "layout")` for `"public"`, `revalidatePath("/admin", "layout")` for `"admin"`. (5) return `{ ok: true, message, data: r.data }` (create services return `data: { id }`).

Error mapping inside (3): Prisma `P2002` -> `CONFLICT` with field error on the unique field (`slug`: "This URL slug is already used. Choose another.", `email`: "An admin with this email already exists."); `P2025` -> `NOT_FOUND` "This item no longer exists. Refresh the list."; domain errors thrown by services (`EditorLimitError` -> `LIMIT`, `DomainError(code, message, field?)` -> as given); `P2003` (foreign-key violation, e.g. a stale or forged `categoryIds` entry) -> `VALIDATION` with `fieldErrors.categoryIds = "One of the selected categories no longer exists. Refresh and try again."`, logged at `info`; anything else -> `ERROR` "Something went wrong. Your changes were not saved." logged at `error` with `{ action, actorId, err.name, err.message }` (never input values). `next/navigation` notFound errors are rethrown via `unstable_rethrow` (after the transaction has rolled back).

Redirect rule (review revision 2, finding 4): `def.run` must NOT call `redirect()`. A redirect thrown inside the transaction would abort `prisma.$transaction`, rolling back the new row and its audit row, and send the user to a record that doesn't exist. `notFound()` inside `run` is allowed and intentionally rolls back. Create actions redirect in the `"use server"` action, after `runAdminAction` has returned (so the transaction is committed and step (4) revalidation has already run):
```ts
export async function createPostAction(prev: ActionResult<{ id: string }> | null, formData: FormData) {
  const result = await runAdminAction({ name: "post.create", /* ... */ }, formDataToObject(formData, { arrays: ["categoryIds", "scriptureRefs"] }));
  if (result.ok && result.data?.id) redirect(`/admin/posts/${result.data.id}?toast=created`);
  return result;
}
```
Delete actions follow the same pattern (`redirect("/admin/posts?toast=deleted")` after an ok result). `runAdminAction` itself never redirects. Static test (in `guard-coverage.test.ts`): no file under `src/server/services/` and not `src/server/actions/run-admin-action.ts` contains `redirect(` or imports `redirect` from `next/navigation`.

Inputs: each action is `export async function xAction(prev: ActionResult | null, formData: FormData)` (for `useActionState`) that converts `FormData` with `formDataToObject(formData, { arrays: ["categoryIds", "scriptureRefs"] })` (strings only; checkboxes -> `"on"` normalized by Zod `z.stringbool()`-style helper `checkbox()`), then calls `runAdminAction`. IDs are validated as `z.cuid()` or, for seeded verse/media ids, `z.string().regex(/^[a-z0-9-]{1,40}$/)` (shared `idSchema` accepting both).

Static guard test (`src/server/actions/guard-coverage.test.ts`) reads every `.ts` file in `src/server/actions/` except `run-admin-action.ts` (skipped by filename) and `*.test.ts`, and checks:
- each file's first statement is `"use server"`;
- each `export async function` body contains `runAdminAction(`, unless the function is in the allow-list `{ startLoginAction, completeLoginAction, cancelLoginAction, logoutAction, previewMarkdownAction, changePasswordAction }`;
- for the allow-listed non-login actions (`logoutAction`, `previewMarkdownAction`, `changePasswordAction`), the body contains `requireAdmin(`;
- `run-admin-action.ts` contains `import "server-only"` and does not contain `"use server"`;
- neither `run-admin-action.ts` nor any file under `src/server/services/` contains `redirect(` or an import of `redirect` from `next/navigation` (redirect rule above).

Logging: `src/lib/log.ts` = `log.info/warn/error(event: string, fields: Record<string, unknown>)` -> `console[level](JSON.stringify({ level, event, ...fields }))`. Never log passwords, codes, TOTP secrets, tokens, raw IPs, prayer/message bodies or email addresses of the public.

---

## 9. Validation schemas (`src/lib/validation/*.ts`, Zod 4)

Shared helpers (`common.ts`):
- `requiredText(max)`: `z.string().trim().min(1, "Required").max(max, \`Use at most ${max} characters\`)`.
- `optionalText(max)`: trim, max, `"" -> null`.
- `markdown(max)`: like optional/required text but max 50 000; NO HTML stripping on input (raw Markdown is stored; sanitization happens on output, section 10).
- `slug`: trim, lower-case, `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`, 1..120.
- `safeUrl({ required })`: `https:` absolute URL (parsed with `new URL`) max 500, or a site path matching `^/(?!/)[A-Za-z0-9/_.\-]*$`; rejects `http:`, `javascript:`, `data:`, protocol-relative `//`.
- `youtubeUrl`: https; host in `youtube.com`, `www.youtube.com`, `m.youtube.com`, `youtu.be`, `youtube-nocookie.com`, `www.youtube-nocookie.com`; id `[A-Za-z0-9_-]{11}` from `watch?v=`, `/embed/`, `/shorts/`, `/live/` or `youtu.be/<id>`; transforms to `https://www.youtube-nocookie.com/embed/<id>`. Error: "Enter a YouTube link (youtube.com or youtu.be)."
- `isoDateTime`: `z.iso.datetime({ offset: true })` -> `Date` (client `DateTimeField` posts ISO with offset).
- `dateOnly`: `z.iso.date()` -> UTC `Date`.
- `checkbox()`: `"on" | "true"` -> true, missing -> false.
- `enumOf(PrismaEnum)`.

Schemas and limits:
- `postSchema`: `type` enum; `titleEn` req 160, `titleNe` opt 160; `slug`; `excerptEn` req 400, `excerptNe` opt 400; `bodyEn` markdown (may be empty), `bodyNe` opt; `scriptureRefs`: textarea split on newlines/commas, trimmed, empties dropped, each 1..60 chars, max 10; `categoryIds` array of ids max 20; `coverImageUrl` safeUrl optional; `isFeatured` checkbox; `seoTitleEn/Ne` opt 70; `seoDescriptionEn/Ne` opt 160; `publishedAt` optional ISO; `intent: "draft" | "publish"` (two submit buttons). On publish with no `publishedAt` -> now (set by the service, not Zod).
- `categorySchema`: `nameEn` req 60, `nameNe` opt 60, `slug`.
- `verseSchema`: `reference` req 60; `text` req 2000; `translation` enum WEB|KJV; `featuredOn` optional date; `intent`.
- `eventSchema`: `kind`, `slug`, `titleEn/Ne` 160, `descriptionEn/Ne` markdown opt 10 000, `reportEn/Ne` markdown opt 20 000, `startsAt` required ISO, `endsAt` optional and must be `>= startsAt` (refine, error on `endsAt`), `locationEn/Ne` opt 160, `volunteerInfoEn/Ne` opt 2000, `status` EventStatus, `coverImageUrl`, `intent`.
- `mediaSchema`: discriminated union on `type`: `IMAGE` requires `url` (safeUrl) + `altTextEn` req 300 (`altTextNe` opt 300); `AUDIO` requires `url` (safeUrl); `VIDEO_EMBED` requires `embedUrl` (youtubeUrl). Common: `category`, `titleEn/Ne` 160, `descriptionEn/Ne` opt 1000, `durationMinutes` optional int 0..1440, `thumbnailUrl` safeUrl opt, `publishedAt` opt, `isFeatured`, `intent`.
- `settingsSchema` (OWNER): `ministryName` req 80; `taglineEn/Ne` opt 120; `missionStatementEn/Ne` opt 600; `visionEn/Ne`, `valuesEn/Ne`, `statementOfFaithEn/Ne` markdown opt 10 000; `aboutIntroEn/Ne` opt 3000; `logoUrl` safeUrl opt; `contactEmail` req email 254; `socialLinks`: one form field per key of `SOCIAL_PLATFORMS` (`social.facebook`, …, `social.website`). Each is optional, `""` becomes null, and a value must be an absolute `https:` URL of at most 300 chars (error: "Enter a full link starting with https://"). The transform keeps only non-null entries and assembles `[{ platform, url }]` in `SOCIAL_PLATFORMS` order (empty inputs everywhere give `[]`). The form pre-fills each input from the stored entry for that platform; `donationsEnabled`, `taxDeductibleVerified`, `isDemo` checkboxes.
- `createEditorSchema`: `name` req 80, `email`, `password` (`passwordSchema`), `confirmPassword` equal (refine on `confirmPassword`).
- `changePasswordSchema`: `currentPassword` 1..256, `newPassword` policy, `confirmPassword`.
- `inboxStatusSchema`: `id`, `status` enum of the model.
- `listQuerySchema` (admin list `searchParams`): `q` trimmed max 100 (else ignored), `page` int >= 1 (invalid -> 1), `type`/`status`/`kind`/`category` enum (invalid -> undefined = all). Page size 20 (audit: 50).

---

## 10. Markdown and sanitization

Chosen: store raw Markdown; render on the server with `marked` -> `sanitize-html` in `src/lib/markdown.ts` (`import "server-only"`): `renderMarkdown(md: string): string`.

Why: it is the smallest maintainable option. A textarea works on every phone keyboard (incl. Nepali IMEs), needs no client editor bundle, and stores portable text. `marked` + `sanitize-html` is a plain string pipeline that is trivial to unit-test. `react-markdown` + `rehype-sanitize` is also safe, but pulls the unified/remark/rehype stack, and TipTap needs a client editor bundle plus HTML storage (bigger attack surface). Live preview is rendered by a server action, so the preview uses the exact production sanitizer and nothing heavy ships to the browser. The client debounces calls by 400 ms. `previewMarkdownAction(md: string)` (in `src/server/actions/markdown.ts`) is a read-only action and does not go through `runAdminAction`:
1. `await requireAdmin()`. On `AuthzError` it returns `{ ok: false, code }`, and the pane shows "Your session has expired. Please sign in again."
2. `z.string().max(50_000).safeParse(md)`. On failure it returns `{ ok: false, code: "VALIDATION" }`, and the pane shows "Preview is limited to 50,000 characters."
3. Returns `{ ok: true, html: renderMarkdown(md) }`.

No AuditLog row, no revalidation. Unexpected errors are logged at `error`, and the pane shows "Preview unavailable".

Configuration:
- `marked.parse(md, { async: false, gfm: true, breaks: false })`.
- `sanitizeHtml(html, { allowedTags: ["p","br","hr","h2","h3","h4","strong","em","del","blockquote","ul","ol","li","a","code","pre"], allowedAttributes: { a: ["href","title","rel"] }, allowedSchemes: ["http","https","mailto"], allowProtocolRelative: false, disallowedTagsMode: "discard", transformTags: { h1: "h2", a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow" }, true) } })`. `rel` must be in `allowedAttributes.a`, because sanitize-html filters attributes after `transformTags` (verified by the reviewer: without it the output has no `rel`). The merge transform always overwrites the author's `rel` (input `rel="opener"` becomes exactly `rel="noopener noreferrer nofollow"`; a `javascript:` link loses its `href` but keeps the forced `rel`). No `img`/`iframe`/`style` (TODO Phase 7 for images). `script`/`style` contents are discarded entirely (sanitize-html default `nonTextTags`).
- Output is passed to `dangerouslySetInnerHTML` ONLY from `renderMarkdown()` (a `MarkdownContent` server component, `src/components/ui/MarkdownContent.tsx`, with prose styles). Public detail pages (Phase 3) will use the same component.
- Plain-text fields (titles, excerpts, about intro, mission statement) are rendered as React text (auto-escaped) and are never passed through HTML.

---

## 11. Domain services (`src/server/services/*.ts`, `server-only`)

Each takes `(tx, input, actor)` and returns `{ entityId, metadata }` for the audit row. `metadata` = `{ changed: string[] }` (field names whose values differ from the current row) plus status transitions like `{ status: { from, to } }`.

- Posts (`posts.ts`): create/update (replace categories with `deleteMany` + `createMany` on PostCategory), `setPostStatus(id, status)` (publish sets `publishedAt ??= now`; unpublish keeps `publishedAt`), delete. `authorId = actor.id` on create.
- Categories: create/update/delete (PostCategory cascade).
- Verses: create/update/delete/publish; `setFeaturedVerse(id, date)` in one transaction: `updateMany({ where: { featuredOn: date, NOT: { id } }, data: { featuredOn: null } })` then set it; the `@unique` on `featuredOn` is the DB-level backstop (P2002 -> CONFLICT). Featuring a DRAFT verse is rejected (`DomainError("Publish this verse before featuring it.")`). `clearFeaturedVerse(id)`.
- Events: create/update/delete/publish (`publishStatus`); report fields are part of the edit form ("Post-trip report" section shown for all statuses, hint "Use after the trip is completed").
- Media: create/update/delete/publish.
- Settings (`settings.ts`): `updateSiteSettings` = upsert singleton. OWNER only (action role + `requireOwner`). Audit metadata lists changed field names; `taxDeductibleVerified` changes are logged as `{ taxDeductibleVerified: { from, to } }`.
- Users (`users.ts`, OWNER only, owner of the editor-limit invariant):
  - `createEditor`: in a transaction, first `SELECT pg_advisory_xact_lock(42001)` (`tx.$executeRaw`) to serialize concurrent creates/reactivations, then `count({ where: { role: EDITOR, isActive: true } })`; `>= 3` -> throw `EditorLimitError` ("You can have at most 3 active editors. Deactivate one first."). Hash password, create with `totpEnabled: false`. The UI also disables the form and shows the same message at the limit, but the service is the authority.
  - `setUserActive(id, active)`: target must be EDITOR (owner can't deactivate self or change the owner); reactivation takes the same lock + count; `sessionVersion += 1` on deactivate.
  - `resetEditorTotp(id)`: EDITOR only; `totpSecretEnc = null, totpEnabled = false, lastTotpStep = null, sessionVersion += 1`, delete challenges.
  - `setEditorPassword(id, password)`: EDITOR only; new hash, `sessionVersion += 1`, unlock.
  - Own password change (any admin, `/admin/account`, `changePasswordAction` in `src/server/actions/account.ts`). This runs in two phases, because a wrong current password must persist a lockout increment that a rolled-back wrapper transaction would undo.
    - Phase A, outside `runAdminAction`:
      1. `const actor = await requireAdmin()`; on `AuthzError` return `{ ok: false, code }`.
      2. `changePasswordSchema.safeParse` -> `VALIDATION` with field errors.
      3. `reserveCredentialAttempt(prisma, actor.id, now)` (atomic, autocommitted, section 7.6). No row (locked) or count > 5 (then `applyLock`): return `{ ok: false, code: "VALIDATION", fieldErrors: { currentPassword: "Too many incorrect attempts. Try again in 15 minutes." } }` without calling `verifyPassword`.
      4. `verifyPassword(user.passwordHash, currentPassword)`. If it is correct, `refundCredentialAttempt` and continue to Phase B. If it is wrong:
         - if the reserved count is 5, `applyLock(prisma, user.id, now, { bumpSessionVersion: true })`: the same lock transaction also does `sessionVersion += 1` (a session guessing passwords is treated as compromised);
         - write a separate audit row `auth.password.change_failed` (metadata `{ locked }`);
         - if locked, return `{ ok: false, code: "UNAUTHENTICATED" }`; the client sends the user to the login page;
         - otherwise return `{ ok: false, code: "VALIDATION", fieldErrors: { currentPassword: "Your current password is incorrect." } }`.
    - Phase B, on success: `runAdminAction({ name: "account.password.change", role: "ADMIN", ... })`. Inside it, `setOwnPassword` sets the new hash, does `sessionVersion += 1`, and resets `failedLoginCount = 0, lockedUntil = null`. Its schema re-validates only `newPassword`/`confirmPassword`, and the actor id comes from the guard, not the form. If the result is ok, call `signOut({ redirectTo: "/admin/login?changed=1" })`.
    - DB test: 5 wrong current passwords set `lockedUntil`, bump `sessionVersion`, and leave 5 `auth.password.change_failed` rows. A 6th attempt with the old session returns `UNAUTHENTICATED`. With a test session carrying the new `sessionVersion`, it gets the lock message without calling `verifyPassword` (spy). The correct password after the lock expires succeeds and writes `account.password.change`.
  - Role is never editable through the UI; no user deletion (deactivate only, keeps audit history).
- Inbox (`inbox.ts`): `listPrayerRequests(query)`, `getPrayerRequest(id)`, `listContactMessages(query)`, `getContactMessage(id)`, `countNewInbox()`, and mutations `setPrayerStatus` / `setMessageStatus` invoked through `runAdminAction`. Every exported function calls `requireAdmin()` first. Audit metadata `{ status: { from, to } }` only, never body/name/email.
- Audit (`audit.ts`): `listAuditLogs({ page, entityType?, actorId? })` (OWNER; page calls `requireOwnerPage`).
- Dashboard (`dashboard.ts`): counts via `Promise.all`: posts PUBLISHED, posts DRAFT, events `{ publishStatus: PUBLISHED, status: UPCOMING }`, prayer NEW, messages NEW (the last two through `inbox.countNewInbox()`).

---

## 12. Admin route tree, layout and security headers

```
src/app/admin/
  layout.tsx                 root layout for /admin: <html lang="en">, fonts, globals.css, <ToastProvider>,
                             metadata { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } }
  not-found.tsx              admin-styled 404
  [...rest]/page.tsx         `import { notFound } from "next/navigation"; export default function AdminCatchAll() { notFound(); }`
                             so unknown /admin/* URLs render admin/not-found.tsx instead of falling through to
                             [locale]/[...rest] with locale "admin". Outside (dashboard), needs no guard (renders nothing).
                             Static segments (incl. those inside the (dashboard) group) win over catch-alls in the
                             App Router; UNVERIFIED on 16.4.3 that the group routes are not shadowed. E2E AC12 plus
                             `GET /admin/does-not-exist` -> 404 with the admin 404 heading verify it.
  login/page.tsx             two-step login (client form), redirects to /admin when signed in
  (dashboard)/
    layout.tsx               getCurrentAdmin(); actor ? <AdminShell actor=...> : null (no redirect here, see 7.7)
    error.tsx                "use client" error boundary with Retry + "Back to dashboard"
                             (NO loading.tsx anywhere under src/app/admin/; see "Guard-then-Suspense" below)
    page.tsx                 /admin dashboard
    forbidden/page.tsx       "You don't have access to this page" (requireAdminPage)
    posts/page.tsx           list   | posts/new/page.tsx | posts/[id]/page.tsx (edit; notFound() if missing)
    categories/page.tsx      list + inline create | categories/[id]/page.tsx
    verses/page.tsx          | verses/new/page.tsx | verses/[id]/page.tsx
    events/page.tsx          | events/new/page.tsx | events/[id]/page.tsx
    media/page.tsx           | media/new/page.tsx  | media/[id]/page.tsx
    inbox/prayer/page.tsx    | inbox/prayer/[id]/page.tsx
    inbox/messages/page.tsx  | inbox/messages/[id]/page.tsx
    settings/page.tsx        requireOwnerPage
    users/page.tsx           requireOwnerPage
    audit/page.tsx           requireOwnerPage
    account/page.tsx         change own password (any admin)
```
Guard-then-Suspense (review finding 1): a route-level `loading.tsx` wraps the page in a Suspense boundary. Next then flushes the shell with status 200 while the guard is still awaiting, and a later `redirect()` turns into a client-side meta refresh instead of a 307. So no `loading.tsx` file exists under `src/app/admin/`. Every page follows this shape:
```tsx
export default async function SettingsPage() {
  await requireOwnerPage("/admin/settings");      // outside Suspense -> real 307 for EDITOR / no session
  return (
    <>
      <PageHeader title="Site settings" />
      <Suspense fallback={<FormSkeleton />}>
        <SettingsFormLoader />                       {/* async server component doing the reads */}
      </Suspense>
    </>
  );
}
```
List pages use `<Suspense key={JSON.stringify(query)} fallback={<ListSkeleton />}>`, so the skeleton also shows while filters change. Edit pages (`[id]`) load their record after the guard and before Suspense, a single primary-key lookup, so `notFound()` returns a real 404. Their secondary data (e.g. the category list) goes inside Suspense. The `(dashboard)/layout.tsx` only reads `getCurrentAdmin()` (deduped with the page guard by React `cache`) and renders `null` without an actor; it never redirects (section 7.7).

Static test `src/app/admin/admin-structure.test.ts`:
- no file named `loading.tsx` exists under `src/app/admin/`;
- every `page.tsx` under `(dashboard)` contains `requireAdminPage(` or `requireOwnerPage(` (the glob covers only `(dashboard)/**`, so `admin/[...rest]/page.tsx` and `admin/login/page.tsx` are excluded by construction);
- `admin/[...rest]/page.tsx` contains `notFound()` and nothing that reads data;
- `settings/page.tsx`, `users/page.tsx` and `audit/page.tsx` contain `requireOwnerPage(`;
- in each page, the guard call appears before the first `<Suspense`.

Fonts: move the four `next/font/google` declarations from `src/app/[locale]/layout.tsx` into `src/app/fonts.ts` (exported constants) and import them in both root layouts (no visual change; `next/font` allows module-level exports). The admin `<html>` always includes the Noto Sans Devanagari variable so Nepali inputs render correctly; Nepali inputs/textareas carry `lang="ne"`.

`src/app/layout.tsx` (pass-through) and `src/app/not-found.tsx` stay.

Security headers (`next.config.ts` `async headers()`), source `/admin/:path*` (matches `/admin` too; E2E asserts both `/admin/login` and the `/admin` redirect response) and `/api/auth/:path*`:
- `X-Frame-Options: DENY`
- `Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'` (deliberately no `script-src`: Next's inline bootstrap scripts would need nonces; full CSP is backlog)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: same-origin`
- `X-Robots-Tag: noindex, nofollow`
- `Cache-Control: no-store`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

Site-wide (all routes, cheap and safe): `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. Server Actions keep Next's built-in Origin/Host check (no `serverActions.allowedOrigins` widening).

---

## 13. Admin UI

Design language: same tokens as the public site. Shell background ivory; sidebar `bg-navy-deep text-white/80` with `text-gold` section labels (4.9:1+), active item `bg-white/10 text-white` + gold left bar (same motif as MobileMenu). Headings Lora; body Inter. Cards: existing `Card`. Buttons: existing `Button` variants (primary navy for Save, gold for Publish, secondary for Cancel, a new `danger` variant `bg-red-700 text-white hover:bg-red-800` added to `Button.tsx` for Delete; red-700 on white is ~6.5:1).

New shared primitives (`src/components/ui/`): `Select.tsx` (native `<select>` with `fieldClasses`, same `invalid/errorId` props as Input), `MarkdownContent.tsx` (section 10), Button `danger` variant. Export from `index.ts`.

Admin components (`src/components/admin/`):
- `AdminShell` (server): lg+ fixed sidebar (16rem) + content; below lg a top bar with site name, `SessionIndicator` and a menu button opening `AdminMobileNav` (Radix Dialog, same a11y pattern as `MobileMenu`). Skip link to `#admin-main`.
- `AdminNav` (client, `usePathname` for `aria-current="page"`): Dashboard, Posts, Categories, Bible verses, Events & missions, Media, Prayer requests, Messages, then for OWNER only: Settings, Users, Audit log; then Account, Log out (form posting to `logoutAction`). Hiding owner items is cosmetic; pages enforce.
- `SessionIndicator`: "Signed in as <name>" + `Badge` with role ("Owner"/"Editor").
- `PageHeader`: title (h1), description, primary action slot.
- `ListToolbar`: GET `<form>` with search `Input` (label "Search"), `Select` filters, "Apply" button (works without JS); values reflect `searchParams`.
- `RecordList`: semantic `<ul>` of row cards (title, type/status `StatusBadge`, updated date, Edit link, Publish/Unpublish button form, Delete button opening `ConfirmDialog`). Single DOM for all widths: stacked on mobile, grid columns at md+. No horizontal scrolling.
- `Pagination`: prev/next links + "Page X of Y" (`nav aria-label="Pagination"`), preserves filters.
- `ConfirmDialog` (client, Radix AlertDialog): title "Delete <item>?", description "This can't be undone.", Cancel (autofocus) + Delete (`danger`), confirm submits a hidden form bound to the delete action; focus returns to the trigger.
- `BilingualField`: label + two inputs "English" / "नेपाली (Nepali)" side by side at md+, stacked on mobile; each with its own `id`, `FieldError`, `aria-describedby`; Nepali hint "Leave empty to show the English text."
- `MarkdownEditor` (client): Write/Preview tabs (`role="tablist"`, arrow-key navigation), Textarea, preview via `previewMarkdownAction`, short syntax help.
- `DateTimeField` (client): `<input type="datetime-local">` + hidden ISO value with the browser offset; shows the time zone name.
- `SlugField` (client): auto-fills from `titleEn` until the user edits it.
- `FormShell` (client): wraps `useActionState`, renders a form-level error summary (`role="alert"`, focused on failure, listing field errors as links to the fields), shows a success toast, keeps entered values on error (actions return nothing to re-render; inputs are uncontrolled with `defaultValue`, so the browser keeps values because React 19 form reset is avoided by using `onSubmit` + `startTransition(() => formAction(fd))` instead of the `action` prop).
- `ToastProvider` + `useToast` (client): fixed bottom-right region (`role="status"`, `aria-live="polite"`), auto-dismiss 5 s, dismiss button, max 3. Redirect-based successes (create -> redirect to edit page) pass `?toast=created|deleted|published` which `FlashToast` turns into a toast (allow-listed keys) then `router.replace` strips the param.
- `StatusBadge`: DRAFT (beige/navy), PUBLISHED (navy/white), UPCOMING/COMPLETED/CANCELLED, NEW/PRAYED/READ/ARCHIVED.
- `PrivacyNotice`: on inbox pages: "Prayer requests and messages are private. Only share them with people the sender has agreed to. Never copy them into public posts unless the sender gave sharing consent." + a `Badge` "Sharing consent: yes/no" on each item.
- `QrSetup`: QR image + grouped secret + copy button (`navigator.clipboard`, with visible fallback text).

Pages:
- Login: centered card on ivory, Logo + "<ministry name> Admin", h1 "Sign in". Step 1 email (`autocomplete="username"`), password (`autocomplete="current-password"`), "Sign in". Step 2 heading "Enter your authenticator code", code input (`inputmode="numeric"`, `autocomplete="one-time-code"`, `maxLength 7`, autofocus), "Verify", "Start over". Enrol step: instructions (install an authenticator app such as Google Authenticator, Microsoft Authenticator or 1Password), `QrSetup`, code input. Lockout note under the form.
- Dashboard: 5 stat cards (Published posts, Drafts, Upcoming events, New prayer requests, New messages; each a link to the filtered list), quick links (New post, New event, New media, Set verse of the day, Site settings (owner)).
- Post editor: sections Basics (type, BilingualField title, SlugField, BilingualField excerpt), Body (MarkdownEditor en + ne), Scripture & categories, Display (featured checkbox, cover image URL with the hint "Uploading files arrives in a later update. For now, paste an image link."), SEO (collapsed `<details>`), sticky footer whose buttons depend on the record's current status (review revision 2, finding 11): new or DRAFT records show "Save draft" (secondary, `intent=draft`) and "Publish" (gold, `intent=publish`); PUBLISHED records show "Update" (gold, `intent=publish`, stays live) and "Unpublish" (secondary, `intent=draft`, with the visible hint "Removes it from the public site" linked via `aria-describedby`). There is never a "Save draft" button on a published record. Plus Delete (edit only). The same rule applies to the event (`publishStatus`), verse and media editors, implemented once in a shared `PublishControls({ status })` component. Shows status badge and last updated.
- Verses list: shows the featured verse of today at the top; row action "Feature on…" opens a small dialog with a date input (default today UTC).
- Events editor: includes "Post-trip report" MarkdownEditor (en/ne), lifecycle status select, publish buttons.
- Media editor: type select switching visible fields (URL vs YouTube link vs alt text), YouTube preview link (no embed in admin to keep it light). A note card at the top: "Uploading pictures and videos arrives in a later update. For now, paste an image link, an audio link or a YouTube link." The same hint goes under the Settings logo URL and the event cover image URL.
- Settings: grouped Cards: Identity (name, logo URL, contact email, isDemo labelled "Demo site (shows demo badges and the demo banner)"), Social links (one https input per `SOCIAL_PLATFORMS` entry, hint "Leave empty to hide. While all are empty the footer shows placeholders."), Messages (tagline, mission statement, about intro, vision, values, statement of faith; bilingual; Markdown where noted), Donations (`donationsEnabled`; `taxDeductibleVerified` labelled "Donation tax status has been verified" with a warning box: "Only check this after a qualified professional has confirmed the ministry's legal eligibility. The public site makes no tax claims either way." The admin UI copy avoids the phrase "tax-deductible"; only the code identifier contains it).
- Users: table of admins (name, email, role, status, 2FA "Set up"/"Pending", last login); "Add editor" card with "N of 3 editors" counter, disabled with the limit message at 3; row actions Deactivate/Reactivate, Reset 2FA (confirm), Set temporary password (dialog with password + confirm).
- Account: change password form; after success the user is signed out with a message. The page shows a note: "Five incorrect current passwords will sign you out and pause sign-in for 15 minutes."
- Inbox lists: filters by status, `EmptyState` "No prayer requests yet. They will appear here when the prayer form launches." Detail: fields, consent badge, status select + Save.
- Audit: list (time, actor, action, entity, metadata in `<details><pre>`), filters by entity type.

Accessibility specifics: every input has a `Label` (`htmlFor`), errors via existing `FieldError` + `invalid/errorId`; `aria-busy` on forms while pending and buttons show "Saving…"; focus moves to the error summary on failed submit and to the h1 after client navigations (Next default is fine); dialogs from Radix; 44 px touch targets; visible focus rings already in tokens.

---

## 14. Owner bootstrap CLI (`scripts/create-owner.ts`)

Usage (README):
```
npm run admin:create-owner -- --email you@example.org --name "Your Name"
```
- Password: from env `OWNER_PASSWORD` if set (for non-interactive use), else prompted twice with hidden input (readline with muted output). Never accepted as a CLI argument (shell history).
- Validation: same `createEditorSchema`/`passwordSchema` rules (email, name 1..80, password 12..128, not equal to email).
- Loads `.env` via `process.loadEnvFile`, requires `DATABASE_URL` and `TOTP_ENCRYPTION_KEY` (clear error + exit 1 otherwise). It imports only pure modules (6.1a): `createPrismaClient`, `hashPassword`, `newTotpSecret`/`otpauthUri`/`verifyTotp`, `seal` + `readTotpKey`, and the Zod schemas. The ciphertext format and AAD are therefore byte-identical to what the app's login reads. Not guarded by `assert-local-db`: creating the owner on Neon is a documented one-time step (README section 5), run with explicit env vars.
- Fails with exit 1 "An owner already exists (owner@…). Use --reset to reset the owner's password and authenticator." if any OWNER exists (exactly-one-owner invariant is owned here; checked inside a transaction with `pg_advisory_xact_lock(42002)`).
- Creates the OWNER with Argon2id hash, new TOTP secret sealed with AAD `totp:<id>`, `totpEnabled: true`.
- Prints: otpauth URI, the base32 secret in groups of 4, and a terminal QR (`qrcode.toString(uri, { type: "terminal", small: true })`), with instructions. If stdin is a TTY it then asks for a current 6-digit code and verifies it (3 tries) to confirm the app is set up; on failure it prints a warning but keeps the account (the owner can rerun with `--reset`).
- `--reset`: for the existing OWNER (email must match `--email`): new password, new TOTP secret, `sessionVersion += 1`, unlock, prints the same output.
- Writes an AuditLog row (`actorEmail: "cli"`, action `owner.create` / `owner.reset`).
- Never prints the password; the TOTP secret is printed once by design (it is what the authenticator needs).

---

## 15. Environment variables (`.env.example`, all server-only unless `NEXT_PUBLIC_`)

```
# Copy this file to `.env` (not .env.local: Prisma and the scripts only read .env).
# Never put Neon/production URLs in your local .env. See README > Switching to Neon.
NEXT_PUBLIC_SITE_URL=http://localhost:3000
# Local dev DB (started with `npm run db:start`).
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54329/mission_dev"
# Neon only (set in Vercel, not here): non-pooled URL used by Prisma migrations. Leave empty locally.
DIRECT_URL=
# Auth.js session encryption. Generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
AUTH_SECRET=
# 32-byte base64 key encrypting authenticator secrets. Same command as above. Changing it invalidates all 2FA setups.
TOTP_ENCRYPTION_KEY=
```
Empty values are written WITHOUT quotes (`KEY=`), so AC31's `'=\S'` pattern does not match them (review revision 2, finding 2). Next.js, `process.loadEnvFile` and Prisma all read `KEY=` as an empty string. The commented Phase 6-8 placeholders follow the same rule (`# RESEND_API_KEY=`). AC31 filters out comment lines (`Where-Object { $_.Line -notmatch '^\s*#' }`), so prose in comments can never cause a false match; only real assignments are checked.
The old commented `# DATABASE_URL=` / `# AUTH_SECRET=` placeholder lines for Phases 4/5 are removed, since the real entries replace them. The Phase 6-8 placeholders stay commented with empty unquoted values (no AWS mentions), so AC31's filtered `=\S` check matches only `NEXT_PUBLIC_SITE_URL` and `DATABASE_URL`. `getAuthSecret()` requires >= 32 chars; `getTotpKey()` requires base64 decoding to 32 bytes. Neither is ever imported by client components (`server-only` makes that a build error).

---

## 16. Error handling summary

| Operation | Failure | Recoverable? | Caller receives | Logged |
| --- | --- | --- | --- | --- |
| Public page render / build | DB unreachable or query error | fatal for that render | build fails; at runtime Next error page, ISR keeps serving the last good page | Next logs error |
| `getSiteSettings` | row missing | yes | defaults from `site.ts` | `warn` once |
| Admin page guard | no/invalid session | yes | redirect to `/admin/login?next=` | no |
| Owner page guard | EDITOR | no | redirect `/admin/forbidden` | `warn` `{ actorId, path }` |
| Admin action | unauthenticated / forbidden | yes / no | `{ ok:false, code }` + message; client redirects to login on UNAUTHENTICATED | `warn` |
| Admin action | Zod failure | yes | `fieldErrors` + summary | no |
| Admin action | unique conflict (P2002) | yes | field error | `info` |
| Admin action | record gone (P2025) | yes | `NOT_FOUND` message | `info` |
| Admin action | foreign key gone (P2003, stale category) | yes | `VALIDATION` with `categoryIds` field error | `info` |
| Admin action | editor limit | yes | `LIMIT` message | `info` |
| Admin action | unexpected | yes (retry) | generic `ERROR`; nothing persisted (transaction) | `error` |
| Login step 1 | bad input | yes | field errors | no |
| Login step 1 | rate limited | yes (wait) | rate-limit message | `warn` `{ ipHash }` |
| Login step 1 | unknown/inactive/locked/wrong password | yes | GENERIC_MSG | `warn` `{ userId? , ipHash, reason }` (reason only in logs) |
| Login step 2 | expired/missing challenge | yes | back to step 1 with message | `info` |
| Login step 2 | wrong/replayed code | yes | field error; challenge dies after 5 | `warn` |
| Login step 2 | `TOTP_ENCRYPTION_KEY` invalid / decrypt fails / DB error inside `authorize` (arrives as `CallbackRouteError`) | fatal config or transient | GENERIC_MSG, back to step 1 (never rethrown) | `error` `{ name, cause }` |
| Change password | wrong current password | yes | field error; at 5 -> locked + signed out (`UNAUTHENTICATED`) | audit `auth.password.change_failed`; `warn` |
| Logout | no valid session | yes | cookie cleared, redirect to login | no |
| Markdown preview | unauthenticated / too long / unexpected | yes | pane message (session expired / 50,000 limit / "Preview unavailable") | `error` only for unexpected |
| `assert-local-db` | non-local or missing URL | fatal (by design) | message naming the variable + exit 1 | stderr |
| `runPrisma` | spawn error / non-zero exit | fatal | thrown Error -> Vitest globalSetup / e2e-prepare fails | stderr (Prisma output inherited) |
| `vercel-build` | `migrate deploy` fails | fatal | Vercel deployment fails; previous deployment stays live | Vercel build log |
| CLI / seed / local-db | any error | fatal | message + exit 1 | stderr |
| `local-db start` | port in use / initdb failure | fatal | message incl. last 20 lines of `server.log` | stderr |

---

## 17. Test plan

### 17.1 Vitest setup

`vitest.config.mts` uses `test.projects`:
- `unit`: `environment: "jsdom"`, `include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"]`, `exclude: ["src/**/*.db.test.ts"]`, `setupFiles: ["./src/test/setup.ts"]` (existing). Static source-scan tests and Node-crypto tests (`secret-box`, `password`, `assert-local-db`) declare `// @vitest-environment node` at the top.
- `db`: `environment: "node"`, `include: ["src/**/*.db.test.ts", "prisma/**/*.db.test.ts"]`, `globalSetup: ["./src/test/db-global-setup.ts"]`, `setupFiles: ["./src/test/db-setup.ts"]`, `fileParallelism: false`, `testTimeout: 20000`, `env: { DATABASE_URL: <mission_unit url>, DIRECT_URL: <same mission_unit url>, AUTH_SECRET: <random at config load>, TOTP_ENCRYPTION_KEY: <random 32-byte base64 at config load> }`.
- Root `resolve.alias`: `@` (existing) and `server-only` -> `src/test/empty-module.ts`.
- `src/test/db-setup.ts`: `vi.mock("next/cache")` (`revalidatePath`, `updateTag` as spies), `vi.mock("next/headers")` (cookie jar + headers fake), `vi.mock("next/navigation")` (`redirect`/`notFound` spies that throw a tagged error, `unstable_rethrow` rethrowing that tag), `vi.mock("@/auth")` (`auth` returns a session from `setTestSession()`; `signIn`/`signOut` spies). Exports `resetDb()` = `TRUNCATE` of every model table `RESTART IDENTITY CASCADE` (table list derived from `Prisma.ModelName`), and factories in `src/test/factories.ts` (`makeOwner`, `makeEditor`, `makePost`, …).
- `npm test` runs both projects (so it now needs the local DB binaries; it starts/stops the server itself). `npx vitest --run --project unit` runs DB-free tests only (README).

### 17.2 New and changed tests (maps to verification item 3)

Unit (jsdom/node, no DB):
- `src/lib/validation/*.test.ts`: every schema: valid sample passes; required en empty fails; ne empty -> null; over-length; slug regex; `safeUrl` rejects `javascript:`, `data:`, `http:`, `//evil`; YouTube variants (watch, youtu.be, shorts, embed) normalize to nocookie and `vimeo.com`/`youtube.com.evil.com` fail; IMAGE without alt fails; `endsAt < startsAt` fails; password policy; social links https only.
- `src/lib/markdown.test.ts`: strips `<script>alert(1)</script>` (text removed too), `<img onerror>`, `onclick` attributes, `[x](javascript:alert(1))` and `data:` links lose `href`, `<iframe>` removed, `# h1` becomes `h2`, links get `rel="noopener noreferrer nofollow"`, raw `<a href="https://x" rel="opener">` comes out with exactly `rel="noopener noreferrer nofollow"`, normal Markdown (lists, emphasis, code) survives.
- `src/server/auth/secret-box.test.ts`: round-trip; tampered ct/iv/tag throws; wrong AAD throws; wrong key throws; invalid key length -> config error.
- `src/server/auth/totp.test.ts`: generate/verify; replay rejected with `afterTimeStep`; ±30 s tolerance; non-numeric codes rejected by schema.
- `src/server/auth/password.test.ts`: Argon2id prefix, verify true/false, malformed hash -> false.
- `src/server/auth/guards.test.ts` (`resolveActor` with fakes + `requireAdmin/requireOwner` with mocked `auth`/loader): no session -> UNAUTHENTICATED; unknown user; inactive; `sessionVersion` mismatch; EDITOR -> `requireOwner` FORBIDDEN; OWNER passes both; `requireOwnerPage` calls `redirect("/admin/forbidden")` for EDITOR, `requireAdminPage` calls `redirect("/admin/login?next=...")`.
- `src/lib/content-mappers.test.ts`: `pick()` fallback (null, "", "  ", real ne); `mediaDisplayKind`.
- `src/app/sitemap.test.ts` (no `/admin`), `src/app/robots.test.ts` (`disallow` includes `/admin`).
- `src/server/actions/guard-coverage.test.ts`: static scan with the rules in section 8 (`"use server"` first, `runAdminAction(` or allow-list + `requireAdmin(`, wrapper file is `server-only` and not `"use server"`).
- `src/app/admin/admin-structure.test.ts`: no `loading.tsx` under `src/app/admin/`; guard present in every dashboard page and before the first `<Suspense`; owner pages use `requireOwnerPage(` (section 12).
- `src/test/script-imports.test.ts`: scripts/seed import no server-only app modules; the pure modules have no `server-only` import (6.1a).
- `scripts/assert-local-db.test.ts`: cases in 3.2a.
- `src/lib/site-settings-mappers.test.ts`: social links (`[]` -> 3 placeholders; one URL -> one labelled link; invalid dropped), `tagline`/`missionStatement` null on empty, paragraph split.
- `src/lib/admin-path.test.ts`: `isAdminPath` plus the compiled proxy matcher cases in 6.5.
- `src/server/services/privacy-scan.test.ts`: static scan for `prayerRequest`/`contactMessage` usage outside `inbox.ts`, `prisma/seed*`, `src/test/**`; asserts each exported function in `inbox.ts` contains `requireAdmin(`.
- Component tests: `ConfirmDialog` (opens, Escape closes, focus returns, confirm calls submit), `BilingualField` (labels + `aria-describedby` wiring), `FormShell` error summary focus.

DB (`*.db.test.ts`, real Postgres `mission_unit`):
- `src/lib/content.db.test.ts`: the 9 existing cases (seeded via `seedDemoContent`), plus: DRAFT post/event/media/verse excluded from every function; `ne` fallback when `titleNe` null/blank; featured-verse precedence (today > latest past > newest > null).
- `prisma/seed.db.test.ts`: seed twice -> identical counts; admin edit survives a re-seed; every seeded Post/Event/BibleVerse/MediaItem row and SiteSettings has `isDemo = true`; ids equal demo ids; `socialLinks` is `[]`.
- `src/lib/site-settings.db.test.ts`: missing row -> defaults; seeded row -> values; localized fallback; paragraphs split.
- `src/server/auth/login.db.test.ts` (clock injected): success path (VERIFY) creates challenge + cookie, completes, resets counters, writes audit; ENROLL path enables TOTP; identical message for unknown/wrong/inactive/locked; lockout at 5 incl. TOTP failures; lock expiry; IP rate limit at 20; challenge expiry, max attempts, single use; TOTP replay rejected; a correct password refunds its reservation (count unchanged) and does not clear earlier failures; concurrency cases from AC18-20 (`Promise.all` of 10 wrong passwords -> <= 5 real-hash verifies + one lock + one `auth.lockout` row; 30 parallel step-1 calls from one IP -> <= 20 hash checks; 2 parallel completions with the same challenge + code -> exactly 1 success; a counter manually set to 7 without a lock is healed by the next attempt applying the lock; the `verifyPassword` spy is installed with `vi.mock("@/server/auth/password", async (importOriginal) => { const m = await importOriginal(); return { ...m, verifyPassword: vi.fn(m.verifyPassword) }; })` and real-hash calls are the calls whose first argument equals the user's stored `passwordHash`; `login.ts` must therefore call `verifyPassword` through the module import, which the mock replaces); corrupted `totpSecretEnc` -> `completeLoginAction` returns GENERIC_MSG with `step: "credentials"` (signIn mocked to run the real `authorize` and wrap non-AuthErrors in a `CallbackRouteError`-shaped error, matching @auth/core 0.41.3).
- `src/server/actions/account.db.test.ts`: change-password lockout cases from section 11; `logoutAction` bumps `sessionVersion` and writes `auth.logout`; `previewMarkdownAction` with no session -> UNAUTHENTICATED, with a session returns sanitized HTML and writes no audit row and calls no `revalidatePath`.
- `src/server/services/users.db.test.ts`: create up to 3 editors, 4th -> LIMIT; concurrent 3 creates with 2 existing -> exactly 1 success; deactivated editor frees a slot; reactivate at limit fails; owner cannot deactivate self; reset 2FA bumps `sessionVersion` and clears secret.
- `src/server/actions/actions.db.test.ts`: with EDITOR session `updateSiteSettingsAction`, `createEditorAction`, `setUserActiveAction` -> FORBIDDEN, DB unchanged, no audit row; with no session `createPostAction` -> UNAUTHENTICATED; with OWNER: post create/update/publish/delete each write exactly 1 audit row and call `revalidatePath("/[locale]", "layout")`; validation failure writes no audit row; P2002 slug -> field error; a non-existent `categoryIds` entry -> `VALIDATION` with a `categoryIds` field error and no rows written; `createPostAction` success calls the mocked `redirect` with `/admin/posts/<id>?toast=created` AFTER the post and its audit row are committed (both readable in the DB when the mock is invoked).
- `src/server/services/inbox.db.test.ts`: with no session every function throws UNAUTHENTICATED; with EDITOR lists work; status change audited without body.

### 17.3 Playwright

`playwright.config.ts` changes: webServer as in 3.5 (`reuseExistingServer: false`, timeout 600 s, env includes both `DATABASE_URL` and `DIRECT_URL`), `globalTeardown: "./e2e/global-teardown.ts"`. Every project uses `use: { ...devices["Desktop Chrome"] }` like the current single project. Viewport changes for 375 px happen per test with `page.setViewportSize`. E2E users (created by `e2e-prepare`, all `totpEnabled: true`): `owner` "E2E Owner" (OWNER), `editor` "E2E Editor" (EDITOR), `editor2` "E2E Editor 2" (EDITOR, used only by the logout test, because logout bumps `sessionVersion` and would invalidate a shared storage state). Projects:
- `public`: `testMatch` = the 6 existing spec files (unchanged, 38 tests). No dependencies.
- `setup`: `e2e/auth.setup.ts` = the "full login with password + TOTP" test: reads `playwright/.auth/e2e-users.json`, logs in as owner (asserts dashboard h1 + "E2E Owner" + "Owner" badge) and as editor (asserts "Editor"), saves `playwright/.auth/owner.json` and `editor.json` storage states. TOTP codes are generated in-test with `otplib.generate({ secret })`. Each user logs in once per run (replay protection); if a code is rejected the helper waits for the next 30 s window and retries once.
- `admin-readonly` (depends on `setup`): `admin-access.spec.ts` (unauthenticated redirects for `/admin`, `/admin/posts`, `/admin/settings`; EDITOR: `request.get("/admin/settings", { maxRedirects: 0 })` -> 3xx with `location` ending in `/admin/forbidden` and body without the settings form, same for `/admin/users`, `/admin/audit`, and page navigation shows the forbidden page; owner nav shows Settings, editor nav does not; security headers present on `/admin/login`; `/admin/does-not-exist` returns 404 and shows the admin 404 heading (not the public one); the unauthenticated `/admin/posts` redirect `location` contains `next=%2Fadmin%2Fposts`, not `next=%2Fadmin` (finding 9); `/robots.txt` has `Disallow: /admin`; `/sitemap.xml` has no `/admin`), `admin-a11y.spec.ts` (axe login at 1280 + 375, dashboard as owner at 1280 + 375, posts editor at 1280; no serious/critical).
- `admin-mutations` (depends on `public` and `admin-readonly`, `workers: 1` via `test.describe.configure({ mode: "serial" })`): `admin-content.spec.ts` (owner creates a MINISTRY_UPDATE post with a unique title and publishes -> visible in `/en` "Recent ministry updates"; saves another as draft -> not visible on `/en` and not on `/ne`), `admin-settings.spec.ts` (owner changes ministry name to "E2E Ministry" -> `/en` header link text shows it -> restores "Demo Ministry" in `finally` and re-checks), `admin-logout.spec.ts` (fresh login as `editor2` -> Log out -> `/admin` redirects to login), `admin-screenshots.spec.ts` (owner: login page (logged-out context), dashboard, `/admin/posts/new`, `/admin/settings` at 1280x900 and 375x812, full page, `scrollWidth <= width` asserted, saved as `.agents/screenshots/admin/{login,dashboard,post-editor,settings}-{1280,375}.png`). Running mutations after `public` keeps the existing home assertions ("Demo Ministry") deterministic.
- `.gitignore` adds `playwright/.auth/`.

Visual verification (item 5): coder and reviewer open each PNG in `.agents/screenshots/admin/` and the regenerated `.agents/screenshots/home-*.png` and confirm brand look, no overflow, header unchanged.

### 17.4 Command checklist the coder runs and reports

1. `npm view` each new package version (table in section 2) -> install pinned; `Select-String -Path package.json -Pattern '"[\^~]'` empty.
2. `npm run db:start`, `npm run db:migrate -- --name init`, `npm run db:seed` (twice), `npx prisma migrate status`.
3. `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build`.
4. `npm test` (report unit + db counts; existing 55 included).
5. `npx playwright test` (report per project; 38 existing + new).
6. Screenshot review.
7. The three exact commands in AC31 (scoped `Select-String` scan returning nothing, `git check-ignore .env` printing `.env`, and the `.env.example` value check), plus a `git status --short` review for unexpected files. Also the AC32 manual fence check (`$env:DIRECT_URL="postgresql://u:p@ep-x.neon.tech/db"; npm run db:reset` must exit 1 before Prisma runs; then `Remove-Item Env:DIRECT_URL`).
7a. Record the pinned `npx prisma@7.10.1 dev` probe result (section 3.1, finding 12).
8. `npm run db:stop`.

---

## 18. Files to add / change

Add: `prisma.config.ts`, `prisma/schema.prisma`, `prisma/migrations/<ts>_init/migration.sql`, `prisma/seed.ts`, `prisma/seed-lib.ts`, `prisma/seed.db.test.ts`, `scripts/local-db.ts`, `scripts/assert-local-db.ts` (+ test), `scripts/create-owner.ts`, `scripts/e2e-prepare.ts`, `src/config/social.ts`, `src/lib/{prisma-factory,site-settings-mappers}.ts`, `src/server/auth/{keys,lockout}.ts`, `src/server/actions/{account,markdown}.ts`, `src/app/admin/admin-structure.test.ts`, `src/test/script-imports.test.ts`, `src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/app/fonts.ts`, `src/app/admin/**` (section 12), `src/components/admin/*`, `src/components/ui/{Select,MarkdownContent}.tsx`, `src/lib/{db,env,log,localize,content-mappers,site-settings,markdown,admin-path}.ts`, `src/lib/validation/*.ts`, `src/server/auth/*.ts`, `src/server/actions/*.ts`, `src/server/services/*.ts`, `src/types/next-auth.d.ts`, `src/test/{db-global-setup,db-setup,factories,empty-module}.ts`, tests listed in 17, `e2e/{auth.setup,admin-access,admin-a11y,admin-content,admin-settings,admin-logout,admin-screenshots}.spec.ts`, `e2e/global-teardown.ts`, `e2e/helpers/admin.ts`.

Change: `package.json` (deps + scripts), `next.config.ts` (headers), `src/proxy.ts`, `src/app/robots.ts`, `src/config/site.ts`, `src/lib/content.ts`, `src/lib/content.test.ts` -> `src/lib/content.db.test.ts`, `src/lib/metadata.ts`, `src/app/[locale]/layout.tsx` (fonts import, settings name, DemoBanner by `isDemo`), `src/app/[locale]/page.tsx` (nullable verse, `revalidate`), `src/components/home/{Hero,MinistryIntro,FeaturedContent}.tsx`, `src/components/layout/{Header,Footer}.tsx` (data source only; plus the Footer social-link rendering and `isDemo`-gated DemoBadge from 6.3), `src/components/PlaceholderPage.tsx`, `src/components/ui/{Button,index}.ts(x)`, `messages/en.json` + `messages/ne.json` (remove 4 keys, add `MediaKinds.IMAGE`), `vitest.config.mts`, `playwright.config.ts`, `.gitignore` (`.local/`, `src/generated/`, `playwright/.auth/`), `.prettierignore` + `eslint.config.mjs` ignores (`src/generated/**`, `.local/**`), `.env.example`, `README.md`.

Unchanged by design: header layout and nav (`Header.tsx` markup, `navigation.ts`), Phase 3 placeholder pages, demo content files.

## 19. README updates (outline)

1. Phase status (4 + 5 done). 2. Local database without Docker (`db:start/stop/status`, data in `.local/postgres`, port 54329, troubleshooting: port in use, `npm install-scripts approve`, resetting with `db:reset`). 3. First-time setup steps: `npm install` -> copy `.env.example` to `.env` (not `.env.local`) -> generate `AUTH_SECRET` + `TOTP_ENCRYPTION_KEY` -> `db:start` -> `db:migrate` -> `db:seed` -> `admin:create-owner` -> scan QR -> `npm run dev` -> open `http://localhost:3000/admin`. 4. Authenticator app setup for non-technical owners. 5. Switching to Neon:
   - Create a Neon project and copy its pooled URL (`DATABASE_URL`) and direct URL (`DIRECT_URL`).
   - In Vercel, set both, plus `AUTH_SECRET`, `TOTP_ENCRYPTION_KEY` and `NEXT_PUBLIC_SITE_URL`, for the Production environment. Set a Neon branch's URLs for the Preview environment, so preview deployments run their own migrations and never touch production data.
   - Vercel runs `vercel-build` (`prisma migrate deploy && next build`) automatically on every deploy.
   - One-time manual steps, from a separate PowerShell window with explicit variables (never by editing the local `.env`, which must keep only local URLs; `db:migrate`/`db:reset`/tests refuse non-local URLs): `$env:DATABASE_URL="<pooled>"; $env:DIRECT_URL="<direct>"; $env:TOTP_ENCRYPTION_KEY="<same as Vercel>"; npm run db:deploy; npm run db:seed; npm run admin:create-owner -- --email ... --name "..."`, then close that window.
   - Warn that `TOTP_ENCRYPTION_KEY` must be identical between the shell used for `create-owner` and Vercel. 6. Env var reference. 7. Admin guide (posts, drafts vs published, featured items, verse of the day, events + reports, media links ("uploading pictures and videos arrives in a later update; for now paste an image link or a YouTube link"), settings incl. social links and the "Demo site" switch (the footer copyright still says "Demonstration site." until Phase 3), editors max 3, 2FA reset, inbox privacy, audit log, lockout behaviour, "logging out signs you out on all devices", owner recovery via `--reset`). 8. Testing (`npm test`, `--project unit`, `test:e2e`, test DBs are reset automatically; don't run `npm test` and `npm run test:e2e` at the same time). 9. Security notes (where auth is enforced, route-handler rule). 10. Roadmap.

## 20. Risks, unverified assumptions and how they get verified

| Item | Status | Verification during implementation |
| --- | --- | --- |
| embedded-postgres on this machine | VERIFIED in spike (init UTF8, detached start, multi-client, migrate, reset, stop) | `npm run db:start` + `db:status` |
| `prisma dev` unsuitable | VERIFIED with an unpinned CLI (prisma dev v0.16.28: P1017 on 2nd connection); NOT yet re-run with pinned `prisma@7.10.1` (`@prisma/dev` 0.24.17) | coder re-runs the probe with `npx prisma@7.10.1 dev` and records it; the decision stands regardless |
| `spawnSync("npx")` on Windows/Node 24 | VERIFIED broken (reviewer) | replaced by `runPrisma` (`process.execPath` + resolved CLI); first `npm test` proves it |
| No 307 under streaming without `loading.tsx` | design per Next docs; UNVERIFIED on 16.4.3 | AC14 E2E (`maxRedirects: 0`) |
| Non-`AuthError` from `authorize` -> `CallbackRouteError` | VERIFIED by reviewer in @auth/core 0.41.3 source | login DB test with corrupted secret |
| Local DB fence | design | AC32 unit + manual check |
| `process.loadEnvFile` keeps existing env | VERIFIED | n/a |
| otplib 13 API, argon2, marked+sanitize-html, qrcode SVG | VERIFIED in spike | unit tests |
| next-auth 5.0.0-beta.32 works with Next 16.4.3 + React 19.3 | peer range OK, runtime UNVERIFIED | `npm ls next-auth`, build, E2E login |
| Turbopack bundles Prisma 7 generated client | UNVERIFIED | `npm run build`; fallback `serverExternalPackages` |
| `revalidatePath` from an action -> next request fresh | UNVERIFIED | E2E 9/10; fallback in 6.4 |
| `prisma generate` with no DB URL | UNVERIFIED | run with empty env; fallback placeholder URL |
| `/admin/:path*` header source also matches `/admin` | UNVERIFIED | E2E header assertions; add explicit `/admin` source if not |
| Prisma 7 `migrate reset` no longer seeds | UNVERIFIED (harmless) | observe output |
| sanitize-html needs `rel` in `allowedAttributes` | VERIFIED by reviewer (fixed in section 10) | `markdown.test.ts` rel cases |
| Lockout / IP limit / challenge / replay hold under concurrency | design (atomic conditional writes, section 7.6) | AC18-20 parallel DB tests |
| `createRequire(import.meta.url)(platformPkg)` under tsx CJS | UNVERIFIED (CJS package, expected to work; top-level await VERIFIED broken) | first `npm run db:start`; fallback `await import` inside `binaries()` |
| `admin/[...rest]` doesn't shadow `(dashboard)` routes | UNVERIFIED on 16.4.3 (static segments win per docs) | E2E AC12 + `/admin/does-not-exist` 404 |
| Account lockout DoS | accepted risk | documented |
| Editor first-login TOTP enrolment window | accepted risk | documented + Users page shows 2FA pending |
| Exactly-one-owner enforced in app code only | accepted, backlog partial index | CLI test path |

Backlog (not in this phase): partial unique index for OWNER, TOTP key rotation, recovery codes / WebAuthn, full CSP with nonces, email password reset (Resend, Phase 6+), scheduled publishing, post/event detail pages (Phase 3), Vercel Blob uploads (Phase 7).

## 21. Review responses

### 21.1 Revision 2 (responding to the second `design-review.md`: 0 HIGH, 4 MEDIUM, 8 NIT)

| # | Severity | Response | Where |
| --- | --- | --- | --- |
| 1 | MEDIUM | Addressed. `rel` added to `allowedAttributes.a`; the merge transform overwrites any author `rel`. The wrong sentence is replaced. New test: `rel="opener"` becomes exactly `rel="noopener noreferrer nofollow"`. | §10, AC26, §17.2 |
| 2 | MEDIUM | Addressed. Empty values are unquoted (`DIRECT_URL=`, `AUTH_SECRET=`, `TOTP_ENCRYPTION_KEY=`). The AC31 pattern is unchanged; the check also filters comment lines so prose can't cause false matches. | §3.3, §15, AC31 |
| 3 | MEDIUM | Addressed. Reserve-then-verify for the account (atomic `UPDATE … RETURNING` before Argon2; > 5 rejects without verify and applies the lock; a correct password refunds its reservation; full reset only after TOTP success so password knowledge can't buy unlimited TOTP guesses). Insert-then-count for the IP limit. Atomic challenge-attempt reservation, and conditional `consumedAt` + `lastTotpStep` writes that must each hit exactly 1 row. `applyLock` is a conditional write, so concurrent callers create one lock and one audit row. Change-password Phase A uses the same primitives. Parallel DB tests added. | §6.1a, §7.1, §7.6, §11, AC18-20, §17.2 |
| 4 | MEDIUM | Addressed. Rule: `def.run` never calls `redirect()`; actions redirect after `runAdminAction` returns ok using `result.data.id`; `notFound()` inside `run` is allowed (intentional rollback). Static test bans `redirect` in services and the wrapper. DB test checks the redirect happens after commit. | §8, §17.1, §17.2 |
| 5 | NIT | Addressed. Binaries are resolved inside `binaries()` via `createRequire(import.meta.url)`, with no top-level await. A defined `isMain` check for both scripts. | §3.2, §3.2a |
| 6 | NIT | Addressed. `description ?? ""` with conditional `<p>`, `publishedAt ?? createdAt`. Seed mappings list the copied media and event fields (checked against `src/content/demo/*`). | §5, §6.2 |
| 7 | NIT | Addressed. `\baws\b` in AC31. | AC31 |
| 8 | NIT | Addressed. `src/app/admin/[...rest]/page.tsx` calls `notFound()`; it is outside `(dashboard)` and excluded from the guard glob; E2E checks the admin 404. | §12, §17.3 |
| 9 | NIT | Addressed. `next` comes from `searchParams.next` as a hidden input validated by `safeNext`. The dashboard layout uses `getCurrentAdmin()` and renders `null`, leaving the redirect to the page guard. E2E checks `next=%2Fadmin%2Fposts`. | §7.6, §7.7, §12, §17.3 |
| 10 | NIT | Addressed. `P2003` maps to `VALIDATION` with a `categoryIds` field error. | §8, §16, §17.2 |
| 11 | NIT | Addressed. DRAFT/new: "Save draft" + "Publish"; PUBLISHED: "Update" + "Unpublish" (with hint). Shared `PublishControls` for posts, events, verses and media. | §13 |
| 12 | NIT | Addressed (both parts). README warning, plus `.local/vitest-running` / `.local/e2e-running` markers that each teardown checks before stopping the server. | §3.5, §19.8 |

No finding was ignored or backlogged. All changes stay within the original requirements.

### 21.2 Revision 1 (responding to the first review)

Historical note: revision 1 row 6 mentions `recordFailedCredential`. Revision 2 replaced it with `reserveCredentialAttempt` / `refundCredentialAttempt` / `applyLock` (row 3 above).

| # | Severity | Response | Where |
| --- | --- | --- | --- |
| 1 | HIGH | Addressed. No `loading.tsx` anywhere under `src/app/admin/`. Pages await their guard outside Suspense, then render data inside an explicit `<Suspense>` with a Skeleton fallback. `[id]` pages load the record before Suspense, so `notFound()` returns 404. AC30 is reworded. A static test checks that no `loading.tsx` exists and that the guard comes before `<Suspense`. | §7.7, §12, AC14, AC30, §17.2 |
| 2 | HIGH | Addressed. New `scripts/assert-local-db.ts` (pure `assertLocalDbUrls` + CLI) guards `db:migrate`, `db:reset`, the Vitest globalSetup, `e2e-prepare` and `runPrisma`. Vitest `test.env`, Playwright `webServer.env` and the child env of every Prisma spawn set both `DATABASE_URL` and `DIRECT_URL` to the local URL. README and `.env.example`: never put Neon URLs in the local `.env`; run Neon commands in a separate shell with explicit env vars. Unit test plus a manual fence check. | §3.2a, §3.3, §3.4, §3.5, §15, §17.1, §19.5, AC32-33 |
| 3 | MEDIUM | Addressed. Section 6.1a lists the pure modules (`password`, `totp`, `secret-box` with a key parameter, new `keys.ts`, `lockout.ts`, `prisma-factory`, validation, mappers, seed-lib, scripts) and the `server-only` ones. `env.ts` is a thin `server-only` wrapper. A static test enforces both lists. | §6.1, §6.1a, §7.1, §7.5, §14, AC35 |
| 4 | MEDIUM | Addressed. `runPrisma(args, url)` in `scripts/local-db.ts` spawns `process.execPath` with the resolved `prisma/build/index.js`, no shell, both URLs in env. It is used by every harness. | §3.2, §3.5, AC33 |
| 5 | MEDIUM | Addressed. `run-admin-action.ts` is `server-only` with no `"use server"`, and the static test skips it by filename and asserts both properties. The allow-list adds `logoutAction`, `previewMarkdownAction` and `changePasswordAction`, each required to contain `requireAdmin(`. The preview does no audit and no revalidation. AC24 excludes read-only actions. | §7.7, §8, §10, AC24, §17.2 |
| 6 | MEDIUM | Addressed. Change-password runs in two phases: verification and the failure counter (shared pure `recordFailedCredential`, its own committed transaction, plus a separate audit row) happen outside `runAdminAction`, and the hash update goes through `runAdminAction`. Going further than the review asked, a lockout reached through this path also bumps `sessionVersion` (signs the session out). DB test for lock after 5. | §11, §16, §17.2 |
| 7 | MEDIUM | Addressed. After `unstable_rethrow` and the `InvalidLoginError` mapping, any other error is logged at `error` and returns GENERIC_MSG with `step: "credentials"`; it is never rethrown. DB test with a corrupted `totpSecretEnc`. | §7.6, §16, §17.2 |
| 8 | MEDIUM | Addressed. Saves store only platforms with a URL, in `SOCIAL_PLATFORMS` order. Labels always come from `src/config/social.ts`. The footer shows real links when any exist, otherwise today's 3 placeholders. The seed stores `[]`. A mapper unit test covers both cases. | §5, §6.3, §9, §13, §17.2 |
| 9 | MEDIUM | Addressed. The verse mapping sets `isDemo: true`. The seed DB test asserts `isDemo` on all seeded rows and on SiteSettings. | §5, §17.2 |
| 10 | MEDIUM | Addressed. Added `"vercel-build": "prisma migrate deploy && next build"`. The README covers Production + Preview env vars (a Neon branch for Preview) and states that seed and create-owner on Neon are one-time manual steps. | §0, §3.4, §16, §19.5, AC34 |
| 11 | MEDIUM | Addressed. AC31 now uses the exact scoped `Select-String` command, `git check-ignore .env`, and the `.env.example` value check. The §17.4 checklist references them. | AC31, §17.4 |
| 12 | NIT | Addressed. The version mismatch is acknowledged, and the coder re-runs the probe with the pinned `npx prisma@7.10.1 dev` and records the result. The decision stands because the limit comes from PGlite. | §3.1, §17.4 7a, §20 |
| 13 | NIT | Addressed. The matcher lookahead is segment-anchored (`api(?:/|$)|admin(?:/|$)|trpc(?:/|$)`). The test extracts the literal from `proxy.ts`, since Next requires a static `config`. | §6.5, §17.2 |
| 14 | NIT | Addressed by documenting the exception: `ministryName` (proper noun, same in both locales today) and `BibleVerse.reference`/`text` (English only, A1). No `ministryNameNe` column, to avoid inventing a Nepali name. | §4.3 |
| 15 | NIT | Addressed. Hero omits the eyebrow, the gold rule and the mission `<p>` when null. MinistryIntro renders no paragraphs when the list is empty. | §6.3 |
| 16 | NIT | Addressed. The footer DemoBadge is gated on `isDemo`. The copyright and site description wording stay until Phase 3, noted in the README admin guide. | §6.3, §19.7 |
| 17 | NIT | Addressed. Posts and events are seeded with their demo ids as primary keys (upsert on `id`). | §5 |
| 18 | NIT | Addressed. The owner/editor/editor2 set is listed with names, emails and `totpEnabled: true`. All projects use `devices["Desktop Chrome"]`. | §3.5, §17.3 |
| 19 | NIT | Addressed. The custom logo uses `size-9` in the header and `size-10` in the footer. | §6.3 |
| 20 | NIT | Addressed, not backlogged. Logout bumps `sessionVersion`, which revokes the JWT server-side. Documented: logout signs you out on all devices. The E2E logout test uses the dedicated `editor2`. | §7.3, §7.6, §17.3, §19.7 |
| 21 | NIT | Addressed. The upload hint appears on media, post cover, event cover and logo fields, and in the README admin guide. | §1.5, §13, §19.7 |
| 22 | NIT | Addressed. The `.env.example` header says "Copy this file to `.env`", and the README notes that `.env.local` isn't read by the DB scripts. | §3.3, §15, §19.3 |

No finding was ignored. Nothing was backlogged beyond the items already in the section 20 backlog. All responses stay within the original requirements: Docker-free local DB, Neon on Vercel, no AWS, server-side authorization, max 3 editors, en + ne, URL-only media this phase.
