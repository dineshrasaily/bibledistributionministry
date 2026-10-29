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
3. Core public pages (About, Devotionals + detail, Missions + detail, Media
   Center, Privacy, Terms) ✅
4. Database-backed content (Prisma 7 + PostgreSQL) ✅
5. Secure admin (password + authenticator app, owner + max 3 editors) ✅
6. Prayer request and contact forms (Turnstile, honeypot, rate limit,
   link-only email notices, consent-only public prayer wall, retention
   purge) ✅
7. Media uploads (pictures and audio, Vercel Blob in production and a local
   folder in development), media library, galleries, picture pickers ✅
8. Donations in US dollars with Stripe Checkout (one-time and monthly),
   signature-verified idempotent webhook, owner-only donations page with
   totals and CSV export ✅
9. Branding (app icons and social-share image from the logo, logo in the
   footer and admin), security headers with a Content-Security-Policy on
   every route, accessibility sweep, and the step-by-step deployment guide
   ([Going live](#going-live-step-by-step-deployment-guide)) ✅

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

## Going live: step-by-step deployment guide

This guide takes the site from your computer to the internet. It is written
for someone who has never deployed a website. Do the steps in order. Each
step says where to click and what you should see when it worked.

No other cloud provider is needed. The services are: **Neon**
(database), **Vercel** (hosting), **Vercel Blob** (pictures and audio),
**Resend** (email notices), **Cloudflare Turnstile** (spam protection) and
**Stripe** (donations). All of them have free or low-cost starter plans.

### Step 0: What you need before you start

- A domain name (for example `your-ministry.org`) from any registrar, and
  access to its DNS settings. You can go live on the free
  `….vercel.app` address first and add the domain in step 10.
- An email address you check often (all the accounts below use it).
- About 2 hours, and your phone with your authenticator app.
- The code in a **private** GitHub repository. Create one at github.com
  (New → Repository → Private) and upload this project to it (GitHub Desktop
  makes this point-and-click). This project never pushes code for you. The
  `.env` file is git-ignored, so your local secrets are never uploaded.
- A password manager (or a sealed paper note) for the secrets you generate.

### Step 1: Create the database on Neon

1. Sign up at neon.tech and click **Create project**. Name it after the
   ministry, choose **Postgres 17** and a **US East** region (close to
   Vercel's default region).
2. Open the project's **Dashboard → Connect**. You'll see a connection
   string. Copy two versions of it and keep them private:
   - with **Connection pooling ON**: this is `DATABASE_URL` (the host
     contains `-pooler`);
   - with **Connection pooling OFF**: this is `DIRECT_URL`.
3. Open **Branches → Create branch**, name it `preview`, and copy its pooled
   and direct URLs too. Preview deployments use this branch so they can
   never change your live data.

You should see: a project with a `main` branch and a `preview` branch.

### Step 2: Create the Vercel project

1. Sign up at vercel.com with your GitHub account.
2. Click **Add New → Project**, pick your private repository and click
   **Import**. Vercel detects Next.js by itself.
3. **Don't change the build command.** Vercel runs this project's
   `vercel-build` script (`prisma migrate deploy && next build`), so database
   updates are applied automatically on every deploy.
4. Don't click Deploy yet if Vercel lets you skip it; if it deploys anyway
   and fails, that's fine: it needs the variables from step 3.

### Step 3: Add the environment variables in Vercel

Open **Project → Settings → Environment Variables**. Add each variable,
tick the environments shown, and click **Save**. Generate each secret with
this command in PowerShell (run it once per secret; every run gives a new
value):

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

| Variable                                                   | Required    | Production                                            | Preview                      | Where the value comes from |
| ---------------------------------------------------------- | ----------- | ----------------------------------------------------- | ---------------------------- | -------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                     | yes         | `https://your-project.vercel.app` (later your domain) | leave unset                  | your site address          |
| `DATABASE_URL`                                             | yes         | Neon `main` pooled URL                                | Neon `preview` pooled URL    | step 1                     |
| `DIRECT_URL`                                               | yes         | Neon `main` direct URL                                | Neon `preview` direct URL    | step 1                     |
| `AUTH_SECRET`                                              | yes         | a new generated secret                                | a different generated secret | the command above          |
| `TOTP_ENCRYPTION_KEY`                                      | yes         | a new generated secret                                | a different generated secret | the command above          |
| `BLOB_READ_WRITE_TOKEN`                                    | for uploads | added by Vercel in step 6                             | added by Vercel in step 6    | step 6                     |
| `RESEND_API_KEY`                                           | for email   | Resend API key                                        | (optional)                   | step 7                     |
| `RESEND_FROM_EMAIL`                                        | for email   | `notices@your-domain`                                 | (optional)                   | step 7                     |
| `CONTACT_TO_EMAIL`                                         | optional    | who receives notices                                  | (optional)                   | your choice                |
| `TURNSTILE_SITE_KEY`                                       | recommended | Turnstile site key                                    | (optional)                   | step 8                     |
| `TURNSTILE_SECRET_KEY`                                     | recommended | Turnstile secret key                                  | (optional)                   | step 8                     |
| `STRIPE_SECRET_KEY`                                        | for giving  | `sk_test_…`, later `sk_live_…`                        | `sk_test_…`                  | step 9                     |
| `STRIPE_WEBHOOK_SECRET`                                    | for giving  | `whsec_…` of the matching endpoint                    | test endpoint's `whsec_…`    | step 9                     |
| `STRIPE_CUSTOMER_PORTAL_URL`                               | optional    | portal login link                                     | (optional)                   | step 9                     |
| `FORM_RATE_LIMIT_PER_HOUR`, `DONATION_RATE_LIMIT_PER_HOUR` | optional    | leave unset (defaults 5 and 10)                       | leave unset                  | n/a                        |

Never add `LOCAL_UPLOAD_DIR`, `STRIPE_API_BASE_URL_FOR_TESTS`,
`OWNER_PASSWORD`, `VERCEL`, `NODE_ENV` or `AUTH_URL` in Vercel.

Important:

- **`TOTP_ENCRYPTION_KEY` must never change** once the owner has signed in.
  Changing it breaks every authenticator setup. Save it in your password
  manager now, together with `AUTH_SECRET`.
- No variable starting with `NEXT_PUBLIC_` may hold a secret (they are sent
  to every visitor's browser). The only one here is the site address.
- **After adding or changing any variable, redeploy** (Deployments → the
  latest one → ⋯ → Redeploy). Variables only take effect on a new deploy.

### Step 4: Prepare the production database (once)

Do this **before the first successful deploy**, on your computer, in a
**new** PowerShell window opened in the project folder. These commands talk
to Neon directly. Never put these URLs in your local `.env` file: it must
only ever hold local URLs (`db:migrate`, `db:reset` and the tests refuse
non-local URLs on purpose).

```powershell
$env:DATABASE_URL="<Neon main pooled URL>"
$env:DIRECT_URL="<Neon main direct URL>"
$env:TOTP_ENCRYPTION_KEY="<exactly the same value as in Vercel Production>"
npm run db:deploy
npm run db:seed
npm run admin:create-owner -- --email you@example.org --name "Your Name"
```

What happens:

1. `db:deploy` creates the tables. You should see "All migrations have been
   successfully applied".
2. `db:seed` adds the demo content (the same "Demo Ministry" starter text
   you had locally; you replace it in step 5 and before go-live).
3. `admin:create-owner` asks for a password twice (hidden while you type; at
   least 12 characters). **Use a different password from your local one.**
   It then shows a QR code.
4. **This is a new authenticator entry.** In your authenticator app tap "+"
   → "Scan a QR code" and scan it. The new entry is also called
   "Demo Ministry Admin" (it uses the ministry name stored in the
   database), just like the one for your computer. Rename the new one to
   "… (live site)" in the app so you can tell them apart, and **keep the old
   one**: it still signs you in to `localhost`.
5. Close the PowerShell window so the URLs and key don't linger.

The order matters: `db:deploy` → `db:seed` → `admin:create-owner` → deploy.
If you deployed before seeding, click **Redeploy** in Vercel afterwards;
otherwise the pre-built pages stay empty until the next admin edit.

### Step 5: First deploy and smoke test

1. In Vercel, click **Deploy** (or **Redeploy**). Wait for "Ready".
2. Open `https://your-project.vercel.app/en`: you should see the home page
   with the demo banner. Open `/ne`: the Nepali home page.
3. Open `/admin`, sign in with the email, the new password and the code from
   the "(live site)" entry.
4. **Settings**: set the ministry name and the logo (pick
   `/brand/logo-mark.png`, or upload it after step 6), save, and check the
   public header and footer. Leave the other boxes as they are for now.

### Step 6: Setting up Vercel Blob (media uploads)

Without a token, uploads in local development are saved under
`.local/uploads` (git-ignored, not backed up). On Vercel without a token,
uploads are switched off and the admin says so; pasted links keep working.

1. In your Vercel project open **Storage → Create → Blob** and choose
   **Public** access (the site shows the files directly to visitors).
2. Connect the store to **Production** and **Preview** (and Development if
   you want real uploads on your computer).
3. Check that `BLOB_READ_WRITE_TOKEN` now appears under Project → Settings →
   Environment Variables. Uploads from the browser need this token.
4. Redeploy. The Media library's upload note should no longer say "not set
   up yet".

Files uploaded on your computer are **not** copied to Vercel Blob. Upload
them again on the live site.

### Step 7: Setting up Resend (email notices)

1. Create a Resend account at resend.com and open **Domains → Add domain**.
   Enter your domain (or a subdomain such as `mail.your-domain`).
2. Resend shows a few DNS records (SPF/`TXT`, DKIM/`TXT`, and an `MX` for
   the return path). Add each one at your domain registrar's DNS page,
   exactly as shown.
3. Back in Resend click **Verify**. It can take from minutes to a few hours;
   wait until the domain says **Verified**.
4. **API Keys → Create API key** with **Sending access** only. Copy it into
   `RESEND_API_KEY` in Vercel (Production).
5. Set `RESEND_FROM_EMAIL` to an address on the verified domain (for example
   `notices@your-domain`) and optionally `CONTACT_TO_EMAIL`. Redeploy.
6. Admin → **Inbox settings** should say "Resend configured". Send a test
   prayer request from the public site: you should get an email with a link
   only.

The email only says that something new arrived and links to the admin
inbox. It never contains the name, email address, subject or text.

### Step 8: Setting up Cloudflare Turnstile (spam protection)

Without keys the forms use Cloudflare's official always-pass **test** keys,
so they work locally and in tests but do not stop bots.

1. Create a free Cloudflare account and open **Turnstile** in the dashboard.
2. **Add widget**: name it after the site, add **both** your
   `your-project.vercel.app` address and your custom domain (and
   `localhost` if you want to test real keys locally), mode "Managed".
3. Copy the **site key** into `TURNSTILE_SITE_KEY` and the **secret key**
   into `TURNSTILE_SECRET_KEY` in Vercel, then redeploy.
4. In the admin, **Inbox settings** should now say "Cloudflare Turnstile
   (live keys)".

With live keys the token is verified on the server and the form **fails
closed**: if Cloudflare can't be reached, the visitor is asked to try again.

### Step 9: Setting up Stripe (donations)

Until this is done the Support page shows a friendly "online giving is not
set up yet" card with your contact email. Online giving opens only when
**both** the secret key **and** the webhook signing secret are set, and
"Donations are enabled" is ticked in Settings, so nobody can be charged for
a gift the site can't record. Everything below starts in Stripe's **Test
mode** (no real money).

1. Create a Stripe account at stripe.com and keep the **Test mode** switch
   on.
2. **Developers → API keys**: copy the **Secret key** (`sk_test_…`) into
   `STRIPE_SECRET_KEY` (Vercel: Project → Settings → Environment Variables;
   locally: `.env`). There is no publishable key to copy.
3. **Settings → Customer emails**: turn on **Successful payments** so Stripe
   emails a receipt for every gift (this site does not send receipts).
4. **Developers → Webhooks → Add endpoint**: URL
   `https://<your-domain>/api/stripe/webhook`, events
   `checkout.session.completed`, `invoice.paid`, `charge.refunded` and
   `customer.subscription.deleted`. Copy the **Signing secret** (`whsec_…`)
   into `STRIPE_WEBHOOK_SECRET`. Admin → **Donations** shows the exact URL
   and says when the signing secret is still missing.
5. Optional: **Settings → Billing → Customer portal**: activate the portal
   and its **login link**, and put the link into
   `STRIPE_CUSTOMER_PORTAL_URL`. Monthly donors then see "Manage or cancel a
   monthly gift on Stripe"; without it they are asked to email you.
6. Testing on your computer: install the Stripe CLI and run
   `stripe listen --forward-to localhost:3000/api/stripe/webhook`. It prints
   a `whsec_…` secret for your local `.env`. Pay with the test card
   `4242 4242 4242 4242`, any future date and any CVC.
7. Admin → **Settings → Donations**: tick **Donations are enabled** and write
   **How gifts are used** (English, and Nepali if you can). Redeploy (or
   restart `npm run dev`) after changing environment variables.
8. **Going live**: switch Stripe to **Live mode**, create a live secret key
   (`sk_live_…`) and a **separate live webhook endpoint** (same URL and the
   same 4 events). The live endpoint has **its own signing secret**: copy
   that one, not the test one. Put both into Vercel's **Production**
   environment only (Preview keeps the test values) and redeploy.
   Admin → Donations then says "Live mode key set". Test-mode gifts stay
   marked **Test**.

#### Zelle and bank transfer (optional, no keys needed)

You can also let donors give straight from their bank, with or without
Stripe. Both can run together (online giving is shown first).

1. Admin → **Settings → Zelle and bank transfer**.
2. Fill in the **Zelle recipient name** exactly as your bank app shows it to
   people who send you money (donors are asked to check this name), plus
   your Zelle email and/or phone.
3. Optional QR code: in your bank app open Zelle, find **My QR code**, save
   it as a picture and upload it in the **Zelle QR code picture** field.
4. Optional bank transfer: bank name, account holder, account number,
   routing number (9 digits, checked for typos) and a SWIFT/BIC code for
   gifts from outside the US.
5. **Show the account, routing and SWIFT numbers** is **off** by default
   and should usually stay off: anyone can see the numbers when it is on,
   and they can be misused for check or ACH fraud. While it is off donors
   see "Contact us for bank transfer details" instead.
6. Tick **Show Zelle and bank transfer on the Support page** and save. The
   section appears only when at least one Zelle or bank detail is filled in.
   Zelle and bank gifts don't pass through this website, so they don't show
   up in Admin → Donations and no receipt is sent automatically.

### Step 10: Your own domain

1. Vercel → **Project → Settings → Domains → Add**, type your domain.
2. Vercel shows one or two DNS records (an `A` record and/or a `CNAME`). Add
   them at your registrar exactly as shown and wait until Vercel shows a
   green check and "Valid configuration" (the HTTPS certificate is created
   for you).
3. Change `NEXT_PUBLIC_SITE_URL` (Production) to `https://your-domain` and
   **redeploy**. This updates the links in search results and social shares
   and switches on `upgrade-insecure-requests` in the security policy.
4. Update the other services to the new address: the Stripe webhook URL
   (test and live endpoints), the Turnstile widget's domains, and the Resend
   sender (if it was on another domain).
5. The site sends `Strict-Transport-Security` (HSTS) for two years, which
   tells browsers to always use HTTPS. The `preload` option is deliberately
   **off**: it puts the domain on a list built into browsers and is hard to
   undo. Add it yourself only once you're sure every subdomain will always
   have HTTPS.

### Step 11: Backups

- **Database (Neon)**: Neon keeps a point-in-time restore window (its
  length depends on your plan; see **Project → Settings → Storage/History
  retention**). To recover, use **Branches → Restore** (or create a branch
  from a past time) and check the data there first.
- **Monthly copy**: export the database with `pg_dump`. This project's
  bundled Postgres has no `pg_dump.exe`, so install the **PostgreSQL 17
  client tools** (the "Command Line Tools" option in the EDB Windows
  installer), then in a new PowerShell window:

  ```powershell
  & "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" --format=custom --file="ministry-backup-$(Get-Date -Format yyyy-MM-dd).dump" "<Neon main DIRECT URL>"
  ```

  Keep the file somewhere **private and encrypted**: it contains prayer
  requests and messages. Close the window afterwards.

- **Pictures and audio (Vercel Blob)**: there is no automatic backup, so
  keep your original files in a folder or cloud drive of your own.
- **Donations**: Stripe keeps the payment records. Download the CSV from
  Admin → Donations each month as well.
- **Secrets**: keep `TOTP_ENCRYPTION_KEY` and `AUTH_SECRET` in your password
  manager. Without the TOTP key a restored database can't verify anyone's
  authenticator codes.

### Step 12: Go-live checklist

Tick every item before telling people about the site:

- [ ] A qualified professional has reviewed the **Privacy Policy** and
      **Terms** (they are templates). The privacy text names the one visitor
      cookie (next-intl's session-only `NEXT_LOCALE` language preference); an
      E2E test keeps that true.
- [ ] The ministry's **tax status** is confirmed by a qualified professional
      before ticking "Donation tax status has been verified" (it changes the
      donation wording on the Support, thank-you and Terms pages). Until then
      the site says gifts are not tax-deductible.
- [ ] A **refund policy** is decided and added to the Terms.
- [ ] **How gifts are used** is written in Settings (until then the Support
      page shows sample text).
- [ ] All **demo content** is replaced and "Demo site" is unticked in
      Settings.
- [ ] A **native speaker** has reviewed every Nepali text, including the
      Nepali legal templates.
- [ ] **Live keys** are set for Turnstile, Resend and Stripe, and the admin
      status pages (Inbox settings, Donations) show them as configured.
- [ ] The **Vercel Blob** store exists and any pictures uploaded on your
      computer have been uploaded again.
- [ ] A real **$5 gift** in live mode worked (it appears in Admin →
      Donations) and you refunded it in the Stripe Dashboard.
- [ ] The security headers are present. In PowerShell:
      `curl.exe -sI https://your-domain/en` should list
      `content-security-policy`, `strict-transport-security`,
      `permissions-policy`, `referrer-policy`, `x-content-type-options` and
      `x-frame-options`.
- [ ] Unused **editor accounts** are deactivated (Admin → Users).
- [ ] The backup routine from step 11 is in your calendar.

## Environment variables

`.env.example` documents every variable (where to get it, which Vercel
environments need it, and whether it is required). All are server-only
except `NEXT_PUBLIC_SITE_URL`, which is the only `NEXT_PUBLIC_` variable (a
unit test enforces this and that every variable the code reads is
documented).

| Variable               | Purpose                                                             |
| ---------------------- | ------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL` | Public base URL (metadata, sitemap, robots; https = CSP upgrade)    |
| `DATABASE_URL`         | Postgres URL used by the app (Neon pooled URL in production)        |
| `DIRECT_URL`           | Neon direct URL for migrations. Leave empty locally                 |
| `AUTH_SECRET`          | Auth.js session encryption (32+ random bytes, base64)               |
| `TOTP_ENCRYPTION_KEY`  | 32-byte base64 key encrypting authenticator secrets in the database |

Prayer and contact forms (Phase 6), all optional:

| Variable                   | Purpose                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `TURNSTILE_SITE_KEY`       | Cloudflare Turnstile site key (read on the server; empty = Cloudflare's test keys)     |
| `TURNSTILE_SECRET_KEY`     | Turnstile secret key (both keys must be set, otherwise the test keys are used)         |
| `RESEND_API_KEY`           | Resend API key for "new prayer request / message" notices (empty = notice only logged) |
| `RESEND_FROM_EMAIL`        | Sender address on a domain verified in Resend, e.g. `notifications@your-domain`        |
| `CONTACT_TO_EMAIL`         | Who receives the notices (defaults to the contact email in Settings)                   |
| `FORM_RATE_LIMIT_PER_HOUR` | Accepted submissions per form per network per hour (default 5; the E2E suite sets 100) |

Media uploads (Phase 7), both optional:

| Variable                | Purpose                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read-write token (public store). Empty locally = files go to `.local/uploads`; empty on Vercel = uploads are off |
| `LOCAL_UPLOAD_DIR`      | Dev only: folder for locally stored uploads (default `.local/uploads`, never committed)                                      |

Donations (Phase 8), all optional (giving opens only with both the secret
key and the webhook signing secret; otherwise the Support page says "online
giving is not set up yet"). All are server-only; there is no publishable key
because card entry happens on Stripe's own page:

| Variable                        | Purpose                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`             | Stripe secret key (`sk_test_…` while testing, `sk_live_…` when live). Empty = giving off                |
| `STRIPE_WEBHOOK_SECRET`         | Webhook signing secret (`whsec_…`) of the endpoint `https://<your-domain>/api/stripe/webhook`           |
| `STRIPE_CUSTOMER_PORTAL_URL`    | Optional Stripe customer portal login link (`https://billing.stripe.com/p/login/…`)                     |
| `DONATION_RATE_LIMIT_PER_HOUR`  | Checkout attempts per network per hour (default 10; the E2E suite sets 100)                             |
| `STRIPE_API_BASE_URL_FOR_TESTS` | Automated tests only: a loopback mock Stripe API, honoured only with a test key. Never set it in Vercel |

Set automatically or used by scripts only (never put them in `.env` or
Vercel):

| Variable         | Purpose                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `OWNER_PASSWORD` | Optional, only in a one-off shell for `admin:create-owner` (otherwise it asks for a password) |
| `VERCEL`         | Set by Vercel on its servers                                                                  |
| `NODE_ENV`       | Set by Next.js                                                                                |
| `AUTH_URL`       | Do not set: `trustHost` is on and Vercel provides the host                                    |

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
- **Uploading pictures and audio** (Media library → **Upload files**): drag
  files onto the box or press **Choose files**. Pictures can be JPEG, PNG or
  WebP up to 8 MB; audio can be MP3 or M4A up to 100 MB; at most 10 files at
  a time. Every picture needs a short **description (alt text)** for people
  who can't see it. Location data (GPS) is removed from photos before they
  are sent. New uploads are **drafts** unless you tick "Publish on the
  public site"; a draft picture can still be used as a cover or logo.
  **Only upload photos of people who agreed to it, and be careful with faces
  and places that could put believers at risk.**
- **Videos** can't be uploaded: put them on YouTube and paste the link with
  **Add a link**.
- **Choosing a cover, logo or About photo**: next to each picture field press
  **Choose from library** (search, then pick a picture) or upload a new one
  from the same window. You can still paste a link instead. Choosing an
  About photo fills an empty photo description for you.
- **Galleries** (Galleries in the menu): create a gallery, link it to a
  mission/event, add pictures from the library or upload new ones, put them
  in order with **Move up / Move down**, and publish. Visitors only see
  published galleries and published photos, on the event's page and on the
  Media page. Deleting a gallery keeps its pictures in the library.
- **Deleting files**: deleting an uploaded item also deletes the file. It is
  refused while the picture is still used as a post or event cover, the
  logo, the About photo or a thumbnail; change it there first.
  - **YouTube** videos play in privacy-enhanced mode (youtube-nocookie.com)
    and nothing loads from YouTube until a visitor presses play.
  - **Audio** links play in the browser's own audio player on the Media page.
  - **Other photos**: published pictures that are not in a gallery appear
    under "Other photos" on the Media page.
- **Settings** (owner only): ministry name, logo link, contact email, social
  links, the home-page text and the **About page** (story, optional photo
  with a required description, testimony, vision, values, statement of
  faith, goals). Empty About sections are hidden; while "Demo site" is ticked
  they show clearly marked sample text instead. Unticking "Demo site" also
  hides the demo badges and banner and drops "Demonstration site." from the
  footer copyright.
- **Optional demo samples**: `npm run db:seed` adds the Phase 3 sample
  content (post bodies, categories, gallery placeholders, a silent audio
  sample) to a local database. It only creates missing rows and never
  overwrites your edits; existing demo posts keep their current text.
- **Donations** (owner only): every gift Stripe reports, newest first, with
  filters (period, one-time/monthly, status, live/test, donor email),
  totals for the chosen period (gross, refunded, net, one-time, monthly,
  active monthly gifts), the Stripe connection status and **Export CSV**.
  Periods are calendar months/years in **UTC**. Editors can't open this
  page or the export: donor emails and amounts are financial personal data
  and editors don't need them for content work. A **Test** badge marks gifts
  made with Stripe test keys. Refunds are made in the Stripe Dashboard and
  show up here automatically. The CSV opens in Excel; a cell that starts
  with `=`, `+`, `-` or `@` gets a leading `'` on purpose so spreadsheets
  never run it as a formula.
- **Zelle and bank transfer** (owner only, Settings): your Zelle details,
  QR code and bank details for the Support page. Leave **Show the account,
  routing and SWIFT numbers** off unless you accept the fraud risk; see
  "Zelle and bank transfer" under Step 9 of the deployment guide.
- **Users** (owner only): add up to **3 editors**. To add a fourth, deactivate
  one first. "Reset 2FA" makes an editor set up their authenticator app again
  (use it when they change phones). "Set temporary password" helps an editor
  who forgot theirs; share it in person or by phone.
- **Inbox**: prayer requests (from the Prayer page) and messages (from the
  Contact page) are private. Only share them with people the sender agreed
  to, and never copy them into public posts.
  - Open an item to read it, change its **status** (for example "Prayed" or
    "Read") and keep a **private note** that only admins see.
  - **Publishing**: only possible when the sender ticked the sharing box
    (for messages: only testimonies). Write a short public version and
    remove names, places, contact details and anything that identifies the
    person, then tick the confirmation and press "Publish public version".
    Only that text appears in "Prayers and testimonies shared with
    permission" on the Prayer page; the original stays private. The site
    also refuses text that still contains an email address, a phone number
    or the sender's name.
  - **Unpublish** at once if someone withdraws their consent.
  - **Delete** removes the item and its public version for good.
- **Inbox settings** (owner only): how many months prayer requests and
  messages are kept (default 12), and **Delete old items**, which removes
  everything older than that. Nothing is deleted automatically, so purge
  regularly, for example once a month. The page also shows whether spam
  protection and email notices are configured.
- **Audit log** (owner only): who changed what and when.
- **Lockout**: after 5 wrong passwords or codes, sign-in pauses for 15
  minutes.
- **Logging out signs you out on all devices.**
- **Owner lost access?** Run `npm run admin:create-owner -- --email … --name
"…" --reset` (against the production database as in "Going live", step 4).

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
| `npm run brand:generate`          | Rebuild the app icons and social-share image from `public/brand/logo-*.png`  |

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
  `noindex`, and sends the admin Content-Security-Policy (below),
  `Referrer-Policy: same-origin`, `Cache-Control: no-store` and
  `X-Robots-Tag: noindex, nofollow`.
- The per-network sign-in limit (20 failed attempts per 15 minutes) keys on
  the first `x-forwarded-for` address. That is trustworthy on Vercel, which
  overwrites the header with the real client IP. On other hosts (or a bare
  `next start` exposed directly) a client can rotate the header; the
  per-account lockout still caps password guessing.
- Public forms go through one pipeline (`src/server/forms/public-submission.ts`):
  honeypot, Zod validation and sanitization, a rate limit per form and per
  hashed network address (`sha256(AUTH_SECRET + ip)`; the raw IP is never
  stored or logged, and attempt records are deleted after 24 hours), then the
  server-side Turnstile check, then storage. The same `x-forwarded-for`
  trust note as above applies.
- Prayer requests are visible only to signed-in admins; the public prayer
  wall reads only the separate, admin-edited `PublicShare` table, and only
  consented items can be published. Anonymous requests never store a name
  or email (cleared on the server too). Logs and email notices never
  contain names, emails, subjects or message text.
- Uploads (Phase 7): the upload, token and library routes under
  `/api/admin/*` require a signed-in admin (same checks as `requireAdmin`)
  and, for uploads, a same-origin request (`Origin` must match; route
  handlers have no built-in CSRF check). Every upload and token is
  audit-logged (types and sizes only, never file names). The server accepts
  only JPEG/PNG/WebP and MP3/M4A whose extension, declared type **and first
  bytes** agree, within the size limits; SVG is refused (it can carry
  scripts). Files are registered only after the server re-inspects them.
- Local uploads are served by `/api/uploads/...` with strict key checks (no
  `..`, no links outside the folder), `nosniff` and a sandboxing CSP. Public
  file URLs are hard to guess but **public**: anyone with the link can see
  the file.
- Donations (Phase 8): no card data ever reaches this server or the browser
  bundle (Stripe Checkout, no Stripe.js). Amounts are decided on the server
  ($5 to $10,000, USD only) and the checkout action is rate limited per
  hashed network address. The webhook verifies Stripe's signature on the raw
  body bytes, stores each event id once (`StripeEvent`) and upserts on
  unique Stripe ids, so re-sent events never double-count; it ignores
  objects not created by this site and non-USD amounts. The `Donation`
  table has no card fields at all. The donations page and CSV export are
  OWNER only (editors get 403), the export is audit-logged without emails,
  and CSV cells are guarded against formula injection.
  `STRIPE_API_BASE_URL_FOR_TESTS` only works with a test key and a
  loopback address, so it can never send a live key anywhere.
- **Security headers (Phase 9)**, built in `src/lib/security/headers.ts`
  and applied by `next.config.ts` to **every** route:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains` (no
    `preload`; see Going live, step 10). Browsers ignore it on `http://localhost`.
  - `Referrer-Policy: strict-origin-when-cross-origin` (admin:
    `same-origin`), `X-Content-Type-Options: nosniff`,
    `X-Frame-Options: DENY` plus CSP `frame-ancestors 'none'` (nothing may
    frame the site).
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()`.
    Autoplay, fullscreen and clipboard-write are left alone so the YouTube
    player and the copy-link button keep working.
  - **Content-Security-Policy** (public site): `default-src 'self'`;
    `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com`
    (Turnstile is the only third-party script); `style-src 'self'
'unsafe-inline'`; `img-src 'self' data: blob: https:` and
    `media-src 'self' blob: https:` (Vercel Blob files and any https picture
    or audio link the owner pastes; images and audio can't run code);
    `font-src 'self'` (fonts are self-hosted); `connect-src 'self'
https://challenges.cloudflare.com`; `frame-src
https://challenges.cloudflare.com https://www.youtube-nocookie.com`
    (never `youtube.com`); `form-action 'self' https://checkout.stripe.com
https://billing.stripe.com` (the no-JavaScript checkout form follows a
    redirect to Stripe); `object-src 'none'`; `base-uri 'self'`;
    `upgrade-insecure-requests` only when `NEXT_PUBLIC_SITE_URL` is https.
    `next dev` additionally allows `'unsafe-eval'` and websockets (React
    dev tools and hot reload); production builds never do.
  - Admin, `/api/admin/*` and `/api/auth/*`: the same policy but with no
    third-party script, `frame-src 'none'`, `form-action 'self'` and
    `connect-src 'self' https://vercel.com` (the `@vercel/blob` browser
    client uploads to `https://vercel.com/api/blob`).
  - `/api/uploads/*`: `default-src 'none'; sandbox; frame-ancestors 'none'`.
  - Why `'unsafe-inline'` for scripts: Next.js needs nonces to avoid it, and
    nonces force every page to be rendered on each request (no static
    pages, no caching). This site keeps its fast static pages instead; the
    risk is contained because the only HTML that comes from content is
    sanitized on the server (`src/lib/markdown.ts`) and no third-party
    script host except Turnstile is allowed. Upgrade path: generate a nonce
    in `src/proxy.ts`, pass it in the CSP, and make the pages dynamic.
  - There is no CSP report endpoint (it would need a third-party collector).
    Violations show in the browser console; the E2E suite fails on any.

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

## Go-live checklist

Moved into the deployment guide: see
[Going live, step 12](#step-12-go-live-checklist).

## Roadmap

1. Design system ✅
2. Layout + home page ✅
3. Core public pages (About, Devotionals, Missions, Media, Privacy, Terms) ✅
4. Database and content with Prisma + Neon Postgres ✅
5. Auth and admin: one OWNER plus up to 3 EDITOR accounts ✅
6. Prayer request and contact forms (Zod validation, Cloudflare Turnstile, email notifications via Resend) ✅
7. Picture and audio uploads to Vercel Blob, media library and galleries ✅
8. Donations in USD with Stripe (no tax-status claims until verified) ✅
9. Branding, hardening (CSP and security headers on every route) and the deployment guide ✅

Later (not planned yet): admin recovery codes, a nonce-based CSP, automatic
clean-up of unregistered uploads.

## Known limitations (Phase 9)

- The CSP allows inline scripts ('unsafe-inline', no nonces) so the
  public pages can stay static; see Security notes for why and the upgrade
  path.
- There is no `favicon.ico`; browsers use the PNG icons (/icon.png,
  /apple-icon.png). Very old browsers may show no icon.
- Vercel's preview-deployment toolbar (`vercel.live`) is blocked by the CSP
  on Preview deployments. Production is not affected.
- Lighthouse is not run in CI. The E2E suite checks the same SEO and
  best-practice items instead (one h1, title, description, lang, viewport,
  canonical + hreflang, og:image, image alt text, no console errors, no
  CSP violations, no sideways scrolling on phones).
- Donation totals mix test and live gifts unless you filter by **Mode**.
- A refund that Stripe reports before its gift is recorded is not linked to
  that gift.

## Known limitations (Phase 8)

- Donations are US dollars and cards only (including Apple Pay and Google
  Pay, which are card wallets). Other currencies and bank methods are
  ignored by the webhook.
- Totals and periods use UTC, so a gift late in the evening in Nepal or the
  US can count in the next/previous day or month.
- Refunds are made in the Stripe Dashboard, not in the admin.
- The thank-you page does not confirm a specific payment (it never calls
  Stripe); Stripe's receipt email is the confirmation.
- Monthly donors change or cancel only through the Stripe portal link (if
  set) or by emailing you.

## Known limitations (Phase 7)

- Uploads that are never registered (for example a closed tab) leave an
  unused file behind; there is no automatic clean-up yet.
- There is no separate upload rate limit (uploads need a signed-in admin
  with an authenticator code, and the size limits apply).
- Video files can't be uploaded; videos stay YouTube links.
- Location data is removed in the browser. On the Vercel Blob path the
  server never sees the file bytes except the first few (type check).
