# Demo Ministry (mission-app)

A bilingual (English + Nepali) website for a personal Christian ministry, with
a private admin area where the owner and up to 3 editors manage the content.
"Demo Ministry" is a placeholder name and **all seeded content is
demonstration content**: it is marked with "Demo content" badges and a
site-wide banner. No real ministry details, testimonials, donation figures or
claims about charitable or tax status are included. Do not add tax-status
wording until the ministry's legal status has been verified.

## Phase status

1. Design system ✅
2. Layout + home page ✅
3. Core pages (About, Devotionals, …): placeholders for now
4. Database-backed content (Prisma 7 + PostgreSQL) ✅
5. Secure admin (password + authenticator app, owner + max 3 editors) ✅

## Tech stack

All versions are pinned exactly in `package.json` (`.npmrc` has `save-exact=true`).

| Area          | Package                                                               |
| ------------- | --------------------------------------------------------------------- |
| Framework     | Next.js 16.4.3 (App Router, Turbopack), React 19.3.1                  |
| Language      | TypeScript 6.0.3 (strict, `noUncheckedIndexedAccess`)                 |
| Styling       | Tailwind CSS 4.3.3 (`@theme` tokens in `src/app/globals.css`)         |
| i18n          | next-intl 4.14.9 (`/en`, `/ne` prefixed routes)                       |
| Database      | Prisma 7.10.1 + `@prisma/adapter-pg`, PostgreSQL (Neon in production) |
| Local DB      | embedded-postgres 17 (no Docker needed)                               |
| Auth          | Auth.js (next-auth 5.0.0-beta.32), Argon2id, TOTP (otplib)            |
| Validation    | Zod 4; Markdown via marked + sanitize-html                            |
| UI primitives | @radix-ui/react-dialog, @radix-ui/react-alert-dialog                  |
| Unit tests    | Vitest 5.0.5 (`unit` + `db` projects), Testing Library, jsdom         |
| E2E / a11y    | Playwright 1.64.1, @axe-core/playwright 4.14.0                        |
| Lint / format | ESLint 9.39.5 (eslint-config-next), Prettier 3.9.10                   |

## Prerequisites

- Node.js 24 and npm 11 (Windows, macOS or Linux; Docker is not needed)
- Network access on the first build (`next/font` downloads Google Fonts)

## Local database without Docker

The project ships its own PostgreSQL 17 binaries (`embedded-postgres`). Data
lives in `.local/postgres` (git-ignored); the server listens on
`127.0.0.1:54329`.

| Command              | What it does                                                             |
| -------------------- | ------------------------------------------------------------------------ |
| `npm run db:start`   | Start Postgres (first run initialises it). A second run is a no-op       |
| `npm run db:status`  | Is it running?                                                           |
| `npm run db:stop`    | Stop it                                                                  |
| `npm run db:migrate` | Apply migrations to `mission_dev` (local only)                           |
| `npm run db:seed`    | Add the demo content (safe to run again; it never overwrites your edits) |
| `npm run db:reset`   | Wipe `mission_dev`, re-migrate and re-seed (local only)                  |
| `npm run db:studio`  | Prisma Studio                                                            |

Start the database once per computer boot before `npm run dev`,
`npm run build` or `npm test`.

Troubleshooting:

- **Port 54329 in use**: another copy is running; `npm run db:stop`, or stop
  the other process.
- **npm warns about skipped install scripts** (npm 11): the Postgres binaries
  and Prisma work without them on this setup. Only run
  `npm install-scripts approve` for packages you trust.
- **Broken local data**: `npm run db:reset` (it refuses to run against any
  non-local database).

## First-time setup

```powershell
npm install
Copy-Item .env.example .env        # .env, not .env.local: Prisma and the scripts only read .env
# Generate two secrets and paste them into .env as AUTH_SECRET and TOTP_ENCRYPTION_KEY:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
npm run db:start
npm run db:migrate
npm run db:seed
npm run admin:create-owner -- --email you@example.org --name "Your Name"
npm run dev                        # http://localhost:3000 (public) and http://localhost:3000/admin
npx playwright install chromium    # once, before running E2E tests
```

`admin:create-owner` asks for a password twice (hidden; at least 12
characters). It then prints a QR code: scan it with your authenticator app
(next section). There is exactly one owner. Running the command again fails
with "An owner already exists"; to recover a lost password or phone, run it
with `--reset` (same email), which sets a new password and a new
authenticator key and signs the owner out everywhere.

## Setting up your authenticator app (for the owner and editors)

Signing in needs your password **and** a 6-digit code from an app on your
phone. This keeps the site safe even if someone learns your password.

1. Install an authenticator app: Google Authenticator, Microsoft
   Authenticator or 1Password all work.
2. In the app, tap "Add account" (or "+") and choose "Scan a QR code".
3. Scan the QR code (shown by `admin:create-owner` for the owner, or on the
   first sign-in screen for editors). If you can't scan, type the key shown
   under the QR code.
4. When you sign in, type the 6-digit code the app shows. Codes change every
   30 seconds; if one is rejected, wait for the next one. If codes never
   work, check that the phone's clock is set automatically.

## Switching to Neon (production on Vercel)

1. Create a Neon project. Copy its **pooled** URL (`DATABASE_URL`) and its
   **direct** URL (`DIRECT_URL`).
2. In Vercel, set `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`,
   `TOTP_ENCRYPTION_KEY` and `NEXT_PUBLIC_SITE_URL` for the Production
   environment. For the Preview environment use a Neon **branch's** URLs, so
   preview deployments run their own migrations and never touch production
   data.
3. Vercel runs `vercel-build` (`prisma migrate deploy && next build`) on every
   deploy.
4. **Before the first deploy**, prepare the production database once, in a
   separate PowerShell window with explicit variables. Never put these URLs
   in your local `.env`, which must only hold local URLs (`db:migrate`,
   `db:reset` and the tests refuse non-local URLs):

   ```powershell
   $env:DATABASE_URL="<pooled URL>"
   $env:DIRECT_URL="<direct URL>"
   $env:TOTP_ENCRYPTION_KEY="<exactly the same value as in Vercel>"
   npm run db:deploy
   npm run db:seed
   npm run admin:create-owner -- --email you@example.org --name "Your Name"
   ```

   Then close that window. The order matters: `db:deploy` -> `db:seed` ->
   `admin:create-owner`, then deploy. If you already deployed before seeding,
   click "Redeploy" in Vercel afterwards; otherwise the statically built
   pages stay empty until the next admin edit.

`TOTP_ENCRYPTION_KEY` must be identical in the shell used for
`create-owner` and in Vercel; changing it later invalidates every
authenticator setup (each admin would need a 2FA reset).

## Environment variables

See `.env.example`. All are server-only except `NEXT_PUBLIC_*`.

| Variable               | Purpose                                                             |
| ---------------------- | ------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL` | Public base URL (metadata, sitemap, robots)                         |
| `DATABASE_URL`         | Postgres URL used by the app (Neon pooled URL in production)        |
| `DIRECT_URL`           | Neon direct URL for migrations. Leave empty locally                 |
| `AUTH_SECRET`          | Auth.js session encryption (32+ random bytes, base64)               |
| `TOTP_ENCRYPTION_KEY`  | 32-byte base64 key encrypting authenticator secrets in the database |

Future phases (prayer/contact forms, media storage, donations) have
commented, empty placeholders in `.env.example`.

## Admin guide (for non-technical owners and editors)

Open `/admin` (for example `https://your-site/admin`) and sign in with your
email, password and authenticator code.

- **Posts**: devotionals, articles, ministry updates, Bible studies and
  testimonies. Fill in English first; every Nepali field is optional and the
  site shows the English text where Nepali is empty.
- **Drafts vs published**: "Save draft" keeps a post private. "Publish" puts
  it on the public site immediately. On a published post, "Update" saves your
  changes and keeps it live; "Unpublish" removes it from the site.
- **Featured items**: tick "Feature on the home page" on a post or media item.
- **Verse of the day**: under Bible verses, use "Feature on…" to choose the
  day. Verse text is English only (WEB or KJV).
- **Events & missions**: dates, place, how to help, and a post-trip report
  you can add afterwards. "Event status" (upcoming/completed/cancelled) is
  separate from whether the event is published.
- **Pictures and videos**: uploading pictures and videos arrives in a later
  update. For now, paste an image link or a YouTube link into the link
  fields (the hint under each field says the same).
- **Settings** (owner only): ministry name, logo link, contact email, social
  links and the home-page text. Unticking "Demo site" hides the demo badges
  and banner; the footer copyright still says "Demonstration site." until the
  About content is written in Phase 3.
- **Users** (owner only): add up to **3 editors**. To add a fourth, deactivate
  one first. "Reset 2FA" makes an editor set up their authenticator app again
  (use it when they change phones). "Set temporary password" helps an editor
  who forgot theirs; share it in person or by phone.
- **Inbox**: prayer requests and messages are private. Only share them with
  people the sender agreed to, and never copy them into public posts unless
  the sender gave sharing consent. (The public forms arrive in Phase 6.)
- **Audit log** (owner only): who changed what and when.
- **Lockout**: after 5 wrong passwords or codes, sign-in pauses for 15
  minutes.
- **Logging out signs you out on all devices.**
- **Owner lost access?** Run `npm run admin:create-owner -- --email … --name
"…" --reset` (against the production database as in "Switching to Neon").

## Scripts

| Script                            | What it does                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`                     | Dev server (start the DB first)                                              |
| `npm run build`                   | Production build (DB must be running, migrated and seeded)                   |
| `npm run start`                   | Serve the production build                                                   |
| `npm run lint`                    | ESLint                                                                       |
| `npm run typecheck`               | `prisma generate`, `next typegen`, then `tsc --noEmit`                       |
| `npm test`                        | All Vitest tests (unit + database; starts/stops the local DB itself)         |
| `npx vitest --run --project unit` | Unit tests only (no database needed)                                         |
| `npm run test:e2e`                | Playwright E2E, a11y and screenshot specs on port 3210 (prepares its own DB) |
| `npm run format` / `format:check` | Prettier write / check                                                       |
| `npm run admin:create-owner`      | Create (or `--reset`) the single owner account                               |

## Testing

- `npm test` runs the `unit` project (jsdom/node, no DB) and the `db`
  project, which uses a separate `mission_unit` database that is recreated on
  every run.
- `npm run test:e2e` resets and seeds a separate `mission_test` database,
  creates E2E admin users, builds and starts the app, and runs the projects
  `public` (public site), `setup` (full password + authenticator login),
  `admin-readonly` (access rules, headers, axe) and `admin-mutations`
  (publishing, settings, logout, screenshots).
- Don't run `npm test` and `npm run test:e2e` at the same time: both manage
  the local Postgres server.
- Screenshots are written to `.agents/screenshots/` and
  `.agents/screenshots/admin/` (git-ignored).

## Security notes

- Authorization is enforced on the server in every admin page
  (`requireAdminPage` / `requireOwnerPage`), every server action (through
  `runAdminAction` or an explicit `requireAdmin`) and every route handler.
  Hiding menu items is cosmetic only. New route handlers must call
  `requireAdmin()` / `requireOwner()` themselves.
- Passwords are hashed with Argon2id; authenticator secrets are encrypted
  with AES-256-GCM (`TOTP_ENCRYPTION_KEY`). Sessions are JWTs that are
  re-checked against the database on every request, so deactivation, 2FA
  resets, password changes and logout revoke access immediately.
- Every change writes an audit log row in the same transaction. Message
  bodies and passwords are never logged.
- Markdown is sanitized on the server before display.
- `/admin` is excluded from the locale proxy, the sitemap and robots, is
  `noindex`, and sends `X-Frame-Options: DENY`, a restrictive
  `Content-Security-Policy` (frame-ancestors, base-uri, form-action,
  object-src), `Cache-Control: no-store` and related headers.
- The per-network sign-in limit (20 failed attempts per 15 minutes) keys on
  the first `x-forwarded-for` address. That is trustworthy on Vercel, which
  overwrites the header with the real client IP. On other hosts (or a bare
  `next start` exposed directly) a client can rotate the header; the
  per-account lockout still caps password guessing.

## Project structure

```
messages/              en.json, ne.json (UI strings)
prisma/                schema.prisma, migrations/, seed.ts, seed-lib.ts
scripts/               local-db.ts, assert-local-db.ts, create-owner.ts, e2e-prepare.ts
e2e/                   Playwright specs (public + admin), helpers/admin.ts, auth.setup.ts
src/
  proxy.ts             next-intl locale routing (skips /admin and /api)
  auth.ts              Auth.js config (Credentials + TOTP)
  app/
    [locale]/          public site (root layout with <html lang>)
    admin/             admin root layout, login, (dashboard)/ pages
    api/auth/          Auth.js route handler
  components/
    ui/                shared primitives (Button, Card, Input, Select, …)
    layout/, home/     public site
    admin/             admin shell, forms, dialogs, editors
  lib/                 db, content, site settings, validation (Zod), markdown
  server/
    auth/              guards, login, password, TOTP, lockout, rate limit
    actions/           "use server" admin actions (all through runAdminAction)
    services/          domain services (posts, events, users, inbox, …)
  content/demo/        demo data used by the seed
```

## Internationalization

- Locales: `en` (default) and `ne`. `/` always redirects to `/en`. The header
  language switcher keeps the current path.
- Every UI string lives in `messages/en.json` **and** `messages/ne.json`
  (a unit test fails if their keys differ). Content fields are stored as
  English + Nepali columns; an empty Nepali value falls back to English.
- The Nepali translations are demo/machine-assisted and **must be reviewed by
  a native speaker**.
- Bible text: public-domain translations only (WEB or KJV), always with the
  reference and translation. Do not paste a copyrighted Nepali Bible
  translation.
- The admin area is in English; Nepali inputs are marked `lang="ne"` and use
  a Devanagari font.

## Design tokens and contrast

| Token       | Hex       | Use                                                   |
| ----------- | --------- | ----------------------------------------------------- |
| `navy`      | `#1E2A44` | primary, text                                         |
| `navy-deep` | `#141C2F` | footer, admin sidebar                                 |
| `ivory`     | `#FBF8F3` | page background                                       |
| `beige`     | `#EDE4D3` | section bands, panels                                 |
| `gold`      | `#B8924A` | decorative accents, borders, icons; text only on navy |
| `gold-dark` | `#8A6A2F` | gold-coloured text on ivory/white                     |

Approximate WCAG contrast: navy on ivory 13.5:1, white on navy 14.3:1, gold on
navy 4.9:1, navy on gold (gold button) 4.9:1, dark gold on ivory 4.7:1, dark
gold on white 5.0:1, white on red-700 (delete buttons) about 6.5:1. Gold on
ivory/white is about 2.7:1, so it is decorative only.

## Roadmap

1. Design system ✅
2. Layout + home page ✅
3. Core pages (About, Devotionals, Missions, Media, Prayer, Support, Contact)
4. Database and content with Prisma + Neon Postgres ✅
5. Auth and admin: one OWNER plus up to 3 EDITOR accounts ✅
6. Prayer request and contact forms (Zod validation, Cloudflare Turnstile, email notifications via Resend)
7. Picture and video uploads to Vercel Blob (replaces the link fields)
8. Donations in USD with Stripe (no tax-status claims until verified)
9. Hardening (full CSP, recovery codes) and deployment to Vercel
