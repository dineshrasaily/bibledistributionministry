# Phase 8 implementation plan: donations with Stripe (USD)

Scope (from the brief, nothing more):
- A Support page with demo mission text, preset and custom USD amounts (min/max checked on the server), one-time or monthly giving, a disclosure, a redirect to Stripe Checkout, and success/cancel pages. Stripe sends the receipts. There is an optional "manage your monthly gift" link.
- A friendly "online giving is not set up yet" state when `STRIPE_SECRET_KEY` is absent. `SiteSettings.donationsEnabled` switches the public giving form on and off.
- A webhook at `/api/stripe/webhook`: raw body, signature verification, idempotency by stored event id, and a `Donation` model with no card data. It handles `checkout.session.completed`, `invoice.paid`, `charge.refunded` and `customer.subscription.deleted`.
- An admin donations page: list, filters, period totals, CSV export (guarded against CSV injection) and Stripe configuration status.

Root: `c:\Users\rasaily\Downloads\mission app`. The path has a space, so quote every path. Windows + PowerShell. Paths with `[locale]` need `-LiteralPath`. Work on `master` with no worktree. **Do not commit.** The finalize step makes the one Phase 8 commit after review approval.

Baselines (from `.agents/tasks/phase7/verification.md`): `npm test` = 76 files / 756 tests, `npm run test:e2e` = 252 passed. Both must stay green, plus the new tests below. Every test rewritten because its behaviour changed (the Support placeholder) is listed in verification.md. Never delete a test silently.

## Ground rules (from the brief and the code I read)

- **mission_dev holds the user's real data.**
  - Never run `db:reset`, `db:seed`, `prisma migrate reset`, `prisma db push` or TRUNCATE against it.
  - The schema changes only through the one migration in item 2.
  - Vitest uses `mission_unit` and Playwright uses `mission_test`.
  - Don't stop Postgres unless you started it. Don't kill the user's `npm run dev` on :3000.
  - Never run `npm test` and `npm run test:e2e` at the same time.
- **Admin mutations** go through `runAdminAction` (`src/server/actions/run-admin-action.ts`). Admin route handlers go through `requireAdminRoute` (`src/server/auth/route-guard.ts`). Action files start with `"use server";`, and `src/server/actions/guard-coverage.test.ts` checks every export.
- **Public mutations:** the checkout action follows the Phase 6 public-pipeline pattern: honeypot → Zod → rate limit per hashed IP → work. Logs never contain emails, amounts tied to people, or raw IPs.
- **Pure modules** (no `server-only`, no `@/lib/db`) are added to `PURE_MODULES` in `src/test/script-imports.test.ts`. No file under `src/` reads `process.env.E2E` (an existing test enforces this).
- **Messages:** `messages/en.json` and `messages/ne.json` keep identical keys. Extend the ne `_note` with "Phase 8 strings added; review with the rest." **`src/lib/messages.test.ts` forbids `tax[- ]deductible`, `501(c)` and `registered charity` in both message files.** So all tax wording stays in `src/lib/donation-wording.ts`, as Phase 3 decided. The admin UI copy also avoids the phrase. "501(c)" and "registered charity" appear nowhere.
- **No invented facts:** no donation figures, no goals or thermometers, no refund-period promises, no claim that the ministry is a charity. "How gifts are used" is a clearly marked demo text until the owner writes it.
- **The header is NOT changed** (`Header.tsx`, `MobileMenu.tsx`). The "Support the Mission" CTA keeps linking to `/support` in every state.
- **UI:** reuse `src/components/ui/*` (`Button`, `Input`, `Label`, `FieldError`, `Card`, `Badge`/`DemoBadge`, `EmptyState`, `Skeleton`, `SectionHeader`, `Container`), `src/components/public/{PageHero,FormParts,form-messages}`, and in the admin `PageHeader`, `ListToolbar`, `RecordList`, `Pagination`, `DetailList`, `EditorSection`, `StatusBadge`, `Skeletons`, `PrivacyNotice`. Gold `#B8924A` is decorative only. Text uses `text-gold-dark`/`text-navy`.
- **No AWS anywhere.**

## Dependency check (done while planning)

- `npm view stripe dist-tags`: latest = **23.0.1** (modified 2026-10-22). It has zero dependencies, needs node >= 20 (we run 24.22.1), and is the official `stripe` package (stripe/stripe-node). **Pin `"stripe": "23.0.1"`.**
- I read the 23.0.1 tarball:
  - It is pinned to API version `2026-09-30.endive` (`cjs/apiVersion.js`).
  - `new Stripe(key)` **throws when the key is empty**, so the client must be created lazily, only when a key exists.
  - `Stripe.webhooks` is **static** (`Stripe.webhooks.constructEvent(payload, header, secret, tolerance?)` and `Stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp? })`), so verifying a signature needs only the webhook secret.
  - Allowed config keys include `host`, `port`, `protocol`, `timeout`, `maxNetworkRetries`, `telemetry` and `appInfo`.
  - Field locations in this API version:
    - `Invoice.parent.subscription_details.subscription` (and `.metadata`). There is no `invoice.subscription`.
    - `Invoice.payments?` is optional and is not in webhook payloads by default. `InvoicePayment.payment.payment_intent` holds the payment intent, available via `stripe.invoicePayments.list({ invoice })`.
    - `Charge.payment_intent` and `Charge.amount_refunded`.
    - `Checkout.Session.{amount_total, currency, customer, customer_details.email, mode, payment_intent, payment_status, subscription, invoice, metadata, livemode}`.
  - The coder re-checks these against `node_modules/stripe/cjs/resources/*.d.ts` after installing.

## Decisions (picked per the standing directive, with rationale)

1. **Checkout is a server-side redirect only, with no Stripe.js and no publishable key.** A public server action creates a Checkout Session and `redirect()`s to `session.url`. Card entry happens entirely on Stripe's page, so no card data ever touches our server or our browser bundle. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is removed from `.env.example` (it isn't needed, and it was the only remaining `NEXT_PUBLIC_` placeholder).
   - Server actions get Next's built-in origin check (CSRF).
   - Before redirecting, the action checks that `session.url` starts with `https://checkout.stripe.com/`. The one exception is the loopback test override in decision 4.
2. **Amounts are whole or cent USD, from $5.00 to $10,000.00, with presets $25 / $50 / $100 / $250.** These live in a pure module `src/lib/donations/amount.ts`: `DONATION_PRESETS_USD = [25, 50, 100, 250]`, `MIN_CENTS = 500`, `MAX_CENTS = 1_000_000`.
   - `parseUsdToCents(input)` accepts only `^\d{1,5}(\.\d{1,2})?$` after trimming and removing one leading `$` and thousands commas. It uses integer math (no floats) and returns cents or null.
   - The minimum sits well above Stripe's $0.50 floor and discourages card-testing. The maximum limits fraud exposure.
   - The client mirrors these limits only for hints. The server schema decides.
3. **Payment methods are `payment_method_types: ["card"]` (Apple Pay and Google Pay are card wallets).** This way `checkout.session.completed` always means paid (`payment_status === "paid"`), so we need none of the async-payment events, which the brief doesn't list. A completed session that is not `paid` is recorded as `ignored`.
4. **Stripe configuration is resolved per request by the pure `resolveStripeConfig(env)`** (`src/lib/donations/stripe-config.ts`):
   - `secretKey`:
     - `"missing"` when blank
     - `"test"` for `sk_test_` or `rk_test_`
     - `"live"` for `sk_live_` or `rk_live_`
     - `"invalid"` otherwise
   - `checkoutReady` = `secretKey` is test or live.
   - `webhookReady` = `checkoutReady` && `STRIPE_WEBHOOK_SECRET` starts with `whsec_`.
   - `portalUrl` = `STRIPE_CUSTOMER_PORTAL_URL` only when it parses as `https://billing.stripe.com/...`, else null.
   - `apiOverride`: `STRIPE_API_BASE_URL_FOR_TESTS` is honoured **only** when its host is `127.0.0.1` or `localhost` **and** the key is a test key. It yields `{ protocol, host, port }`. This is the seam the E2E mock Stripe server uses. It can't send live keys anywhere, and in production it can only break checkout, never redirect money. It is documented as "tests only".
   - Values are never returned to the UI. The admin sees only the derived statuses.
5. **The public giving state comes from the pure `resolveGivingState({ checkoutReady, donationsEnabled })`:**
   - `"not-configured"` when `!checkoutReady`, whatever the setting. The brief's required state and E2E default.
   - `"closed"` when the keys exist but `donationsEnabled` is false. Shows "Online giving is not open right now".
   - `"open"` when both are true. Shows the form.

   The not-configured and closed states show a short card with the ministry's contact email plus links to Prayer and Contact. The mission text stays visible. The Support page and the checkout action both use this function, so a hidden form can't be bypassed by posting the action directly. The page is `dynamic = "force-dynamic"`, because it reads env and settings per request.
6. **Monthly gifts** use `mode: "subscription"` with inline `price_data` (`recurring: { interval: "month" }`). There is no Product/Price setup in the Dashboard. One-time gifts use `mode: "payment"` with `submit_type: "donate"`.
   - Both modes set `metadata: { app: "mission-site", interval, locale }`.
     - One-time: on the session and in `payment_intent_data.metadata`.
     - Monthly: on the session and in `subscription_data.metadata`.
   - The product name is `"Gift to <ministryName>"` / `"Monthly gift to <ministryName>"`.
   - `success_url` = `<siteUrl>/<locale>/support/thank-you?session_id={CHECKOUT_SESSION_ID}` and `cancel_url` = `<siteUrl>/<locale>/support/cancelled`, with `siteUrl` from `getSiteConfig().siteUrl` (never the Host header).
   - Webhook handlers ignore any object whose metadata `app` is not `mission-site`, so other uses of the same Stripe account are never recorded.
7. **The thank-you page does not call Stripe.** It shows a generic "Thank you. Stripe will email your receipt" message, and ignores `session_id`. That means no network call and nothing to leak. Both result pages are `robots: { index: false }` and are not in the sitemap.
8. **Customer Portal = Stripe's no-code portal login link.** `STRIPE_CUSTOMER_PORTAL_URL` is optional. When it is valid, the Support page and the thank-you page show "Manage or cancel a monthly gift" (opens Stripe). Without it they show "To change or cancel a monthly gift, email <contactEmail>."
   - The donor signs in at Stripe with an email code. We create no portal sessions and expose no customer ids.
   - It is set up in the Dashboard (README).
9. **Data model** (one migration, `phase8_donations`, additive only):
   - `enum DonationInterval { ONE_TIME MONTHLY }`, `enum DonationStatus { PAID PARTIALLY_REFUNDED REFUNDED }`, `enum DonationSubscriptionStatus { ACTIVE CANCELED }`. Add `DONATION` to the existing `enum FormKind` (reuses the Phase 6 rate-limit table).
   - `Donation`:
     - `id cuid`
     - `amountCents Int`, `currency String @default("usd")`
     - `interval DonationInterval`, `status DonationStatus @default(PAID)`
     - `amountRefundedCents Int @default(0)`
     - `donorEmail String?` (lower-cased, max 254; from Stripe's `customer_details.email` / `customer_email`)
     - `livemode Boolean @default(false)`
     - Stripe ids: `stripeCheckoutSessionId String? @unique`, `stripeInvoiceId String? @unique`, `stripePaymentIntentId String? @unique`, `stripeCustomerId String?`
     - `subscriptionId String?` → `DonationSubscription` (`onDelete: SetNull`)
     - `paidAt DateTime`, `refundedAt DateTime?`, `createdAt`, `updatedAt`
     - `@@index([paidAt])`, `@@index([status, paidAt])`, `@@index([interval, paidAt])`
     - **No card fields of any kind** (no brand, last4, expiry or billing address). The comment says so.
   - `DonationSubscription`:
     - `id cuid`, `stripeSubscriptionId String @unique`, `stripeCustomerId String?`
     - `amountCents Int`, `currency String @default("usd")`
     - `status DonationSubscriptionStatus @default(ACTIVE)`
     - `donorEmail String?`, `livemode Boolean`
     - `startedAt DateTime`, `canceledAt DateTime?`
     - `donations Donation[]`, `createdAt`, `updatedAt`, `@@index([status])`
   - `StripeEvent` (the idempotency ledger): `id String @id` (the `evt_…` id), `type String`, `livemode Boolean`, `outcome String` ("processed" | "ignored"), `processedAt DateTime @default(now())`, `@@index([processedAt])`.
   - `SiteSettings`: add `givingInfoEn String?` / `givingInfoNe String?` (Markdown, "how gifts are used"), editable in admin Settings › Donations. When empty, the Support page shows the demo text with a DemoBadge. The owner can then replace the demo text without a code change, as Phase 3 did for About.
   - Nothing is seeded into the donation tables. Fabricated figures are forbidden.
10. **Webhook processing** (`src/server/donations/webhook.ts`, server-only; route `src/app/api/stripe/webhook/route.ts`, `runtime = "nodejs"`, `dynamic = "force-dynamic"`, exports **only** `POST`):
    1. `resolveStripeConfig(process.env).webhookReady` is false → 503 `{ error: "NOT_CONFIGURED" }` (logged once per request without values).
    2. If `Content-Length` > 1 MiB, or the body read with `await request.text()` (raw, never `request.json()`) is over 1 MiB → 413.
    3. If the `stripe-signature` header is missing, or `Stripe.webhooks.constructEvent(raw, header, secret)` throws (default 300 s tolerance) → 400 `{ error: "INVALID_SIGNATURE" }`, logged as `stripe.webhook.invalid_signature` (no body).
    4. `prisma.stripeEvent.findUnique({ id })` already exists → 200 `{ received: true, duplicate: true }`.
    5. `enrich(event, client)` runs **outside** the transaction. Only `invoice.paid` without `payments` in its payload calls `client.invoicePayments.list({ invoice: invoice.id, limit: 1 })` to get the payment intent. The client is injected, so tests mock it.
    6. `prisma.$transaction`: `tx.stripeEvent.create(...)` first, so a concurrent duplicate fails with P2002 → 200 duplicate. Then the handler writes and the transaction commits. A handler error rolls back the event row too → 500 `{ error: "PROCESSING_FAILED" }`, so Stripe retries.
    7. The response is always `Cache-Control: no-store`, and every unknown event type returns 200 with `outcome: "ignored"`.

    Handlers. Every write is an upsert on a unique Stripe id, which protects against duplicates even when Stripe re-sends under a new event id. Non-`usd` currency or a foreign `metadata.app` → ignored.
    - `checkout.session.completed`:
      - mode `payment` + `paid` → upsert a `Donation` (ONE_TIME, `amount_total`, session id, payment intent, customer, email, `livemode`, `paidAt` = event `created`).
      - mode `subscription` → upsert a `DonationSubscription` (ACTIVE, amount from `amount_total`). No Donation row; `invoice.paid` records each month, including the first.
    - `invoice.paid` (the subscription id comes from `parent.subscription_details.subscription`, `metadata.app` from `parent.subscription_details.metadata`): upsert the `DonationSubscription` (creates it if this arrives before the checkout event; Stripe doesn't guarantee order). Then upsert a `Donation` (MONTHLY, `amount_paid`, invoice id, payment intent, `customer_email`, `paidAt` = `status_transitions.paid_at`, or event `created`).
    - `charge.refunded`: find the Donation by `stripePaymentIntentId = charge.payment_intent`. Set `amountRefundedCents = amount_refunded`, `status` = REFUNDED if refunded ≥ amount, else PARTIALLY_REFUNDED, and `refundedAt` = event created. No match → `ignored` with log `stripe.webhook.refund_unmatched` (ids only).
    - `customer.subscription.deleted`: set the subscription to CANCELED with `canceledAt` = `canceled_at` ?? `ended_at` ?? event created. Unknown subscription with foreign/no metadata → ignored. Unknown subscription with our metadata → create it as CANCELED.

    Webhook writes are system writes, so no AuditLog rows. The `StripeEvent` ledger is the trail. Logs carry only event id/type/outcome.
11. **The checkout pipeline** (`src/server/donations/checkout.ts`, server-only, no directive) is called by the public action `startCheckoutAction(prev, formData)` in a new `src/server/actions/public-donations.ts`:
    1. Honeypot `website` filled → pretend success: redirect to the thank-you page, nothing created.
    2. Zod `checkoutSchema` → `{ status: "error", code: "VALIDATION", fieldErrors }`.
    3. Giving state ≠ open → `NOT_AVAILABLE`, with no Stripe call.
    4. `reserveFormSubmission(prisma, { form: "DONATION", ipHash, limit: donationRateLimit(env) })` → `RATE_LIMITED`. `DONATION_RATE_LIMIT_PER_HOUR` must be an integer 1..1000; the default is 10.
    5. `client.checkout.sessions.create(params)`. A Stripe error → `ERROR`, logged as `donation.checkout.error { name, type, code }` with no email or amount.
    6. Validate `session.url`, then `redirect(session.url)` **outside** the try/catch (or `unstable_rethrow` first).

    The params builder `buildCheckoutParams(input, { siteUrl, ministryName })` is a pure, unit-tested function in `src/lib/donations/checkout-params.ts`.
12. **Admin access: OWNER only for the donations page, the CSV export and the Stripe status. Editors get no read access.** Editors have no task that needs donation data: they manage content and the inbox. Donor emails and giving amounts are financial personal data. Least privilege matches how Settings, Users and Audit are owner-only.
    - The page uses `requireOwnerPage("/admin/donations")`, so editors are redirected to `/admin/forbidden`. The nav item sits in the existing OWNER section, which is hidden for editors (cosmetic; the page enforces).
    - The export route uses a new option, `requireAdminRoute(request, { mutation: false, role: "OWNER" })`. It returns 401 without a session and 403 `{ error: "FORBIDDEN" }` for editors, and it logs `admin.route.denied`.
    - This is documented in README › Admin guide and in verification.md.
13. **Admin list and totals** (`src/server/services/donations.ts`, reads only).
    - Filters (lenient, GET `ListToolbar`):
      - `period`: `this-month` (default), `last-month`, `last-30-days`, `this-year`, `last-year`, `all`
      - `interval`: ONE_TIME / MONTHLY
      - `status`: PAID / PARTIALLY_REFUNDED / REFUNDED
      - `mode`: live / test
      - `q`: donor-email contains, max 100
    - Periods are computed in **UTC** by the pure `periodRange(period, now)` in `src/lib/donations/period.ts`, and the page labels them "(UTC)".
    - Totals for the filtered set: count, gross (`sum amountCents`), refunded (`sum amountRefundedCents`), net, plus one-time vs monthly gross, and the number of ACTIVE monthly subscriptions (not period-bound). Rows use `paidAt desc`, 20 per page (`PAGE_SIZE`).
    - Each row shows the date/time, a `formatUsd` amount, Frequency, a status badge, a "Test" badge when `!livemode`, the donor email or "No email", the refunded amount, and a "View in Stripe" link to `https://dashboard.stripe.com/[test/]payments/<pi>` (rel noopener, new tab, text says so).
    - `src/lib/validation/list-query.ts` `Filters` gains `period`, `interval` and `mode` keys.
14. **CSV export** (`GET /api/admin/donations/export?<same filters>`, `src/app/api/admin/donations/export/route.ts`).
    - It uses the same `where` builder as the list. The cap is 10 000 rows; if there are more, the last line reads `# truncated at 10000 rows`.
    - Columns: `Paid at (UTC)`, `Amount (USD)`, `Currency`, `Frequency`, `Status`, `Refunded (USD)`, `Donor email`, `Test mode`, `Stripe payment intent`, `Stripe invoice`, `Stripe subscription`.
    - Encoding uses the pure `src/lib/donations/csv.ts`:
      - every cell is quoted and `"` is doubled
      - **a cell starting with `=`, `+`, `-`, `@`, TAB or CR gets a leading `'`** (OWASP CSV-injection guidance; donor emails may legally start with `=`, and Stripe ids are user-unrelated but treated the same)
      - `\r\n` line endings, plus a UTF-8 BOM for Excel
    - Response headers: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="donations-<period>-<yyyy-mm-dd>.csv"`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`.
    - It writes `recordAdminAudit({ action: "donation.export", entityType: "Donation", metadata: { period, interval, status, mode, hasQuery: boolean, rows } })`. No emails and no query text.
    - The page's "Export CSV" link carries the current filters.
15. **Stripe status panel on `/admin/donations`** (`DetailList`):
    - Secret key: "Test mode key set" / "Live mode key set" / "Not set: online giving shows 'not set up yet'" / "Not recognised (check the key)".
    - Webhook signing secret: set / not set.
    - Webhook URL to enter in Stripe: `<siteUrl>/api/stripe/webhook`.
    - Last webhook received: the newest `StripeEvent.processedAt`, or "Never".
    - Customer portal link: set / not set.
    - Public giving: `donationsEnabled` on/off, with a link to Settings.
    - Tax wording: the verified flag, shown as "verified" / "not verified", with no tax phrase.
    - Values are never shown. A note points to README › Setting up Stripe.
16. **Tax and receipt wording** stays in `src/lib/donation-wording.ts`:
    - `donationTaxNote(locale, verified)` is unchanged and still used by Terms. It returns "not tax-deductible" when unverified. When verified it returns "may be tax-deductible; consult your tax advisor" plus the Stripe receipt note.
    - A new `donationDisclosure(locale, verified)` returns `{ taxNote }` for the Support page and the thank-you page, so all three pages always agree.
    - The disclosure lines that make no tax claim come from messages: "Payments are processed securely by Stripe, in US dollars", "We never see or store your card details", "Questions about a gift or need a refund? Email {email}", and the monthly cancel line.
17. **E2E strategy without real keys.**
    - The main Playwright server (:3210) runs with **no Stripe env**. That covers the not-configured state, the 503 webhook, and admin access.
    - A dedicated helper `e2e/helpers/stripe-server.ts` starts, inside the test worker:
      - (a) a mock Stripe API: a Node `http` server on `127.0.0.1:3212` answering `POST /v1/checkout/sessions` (it records the parsed form body and returns `{ id: "cs_test_e2e_<n>", object: "checkout.session", url: "http://localhost:3211/<locale>/support/thank-you?session_id=cs_test_e2e_<n>" }`), `GET /v1/invoice_payments` (one payment with `payment_intent`), and 404 JSON for anything else
      - (b) a second `next start -p 3211` on the **same build**. It is spawned as `process.execPath <next/dist/bin/next> start -p 3211`, so killing it works on Windows. Its env: `DATABASE_URL`/`DIRECT_URL` = mission_test, random `AUTH_SECRET`/`TOTP_ENCRYPTION_KEY`, `STRIPE_SECRET_KEY=sk_test_e2e_dummy`, `STRIPE_WEBHOOK_SECRET=whsec_e2e_dummy`, `STRIPE_API_BASE_URL_FOR_TESTS=http://127.0.0.1:3212`, `DONATION_RATE_LIMIT_PER_HOUR=100`, and blank `TURNSTILE_*`/`RESEND_API_KEY`/`BLOB_READ_WRITE_TOKEN`/`VERCEL`. It writes its pid to `.local/e2e-stripe-server.pid`, and `e2e/global-teardown.ts` kills any leftover pid.
    - Both servers share mission_test, so a webhook posted to :3211 shows up in the owner's `/admin/donations` on :3210. Session cookies are host-scoped, not port-scoped, but the admin is only used on :3210.
    - No request ever leaves the machine.

## Plan

- [ ] 1. Dependency, env and config (no behaviour change yet)
  - `npm install stripe@23.0.1`. `.npmrc` has `save-exact`. Confirm that `package.json` shows `"stripe": "23.0.1"` and that `package-lock.json` changed only for it (it has no deps). Run `npm audit --omit=dev` and record the output; don't fix anything.
  - Open `node_modules/stripe/cjs/resources/{Invoices,Charges,Subscriptions,InvoicePayments}.d.ts` and `Checkout/Sessions.d.ts`. Confirm the field paths listed under "Dependency check" and note any difference in verification.md.
  - `next.config.ts` `headers()`: add `{ source: "/api/stripe/:path*", headers: [Cache-Control no-store, X-Robots-Tag noindex, nofollow, X-Content-Type-Options nosniff] }`. `/api/admin/:path*` already covers the export. The proxy matcher already skips `/api`, so `src/proxy.ts` is unchanged (the webhook is never localized). Add a comment there saying so.
  - `vitest.config.mts`: in **both** projects' `env`, add `STRIPE_SECRET_KEY: ""`, `STRIPE_WEBHOOK_SECRET: ""`, `STRIPE_CUSTOMER_PORTAL_URL: ""`, `STRIPE_API_BASE_URL_FOR_TESTS: ""`. Tests set values with `vi.stubEnv`.
  - `playwright.config.ts` webServer `env`: add the same four as `""` and `DONATION_RATE_LIMIT_PER_HOUR: "100"`.
  - `.env.example`: replace the "Future phases" block with a "Donations (optional; see README > Setting up Stripe)" section, with no values:
    - `# STRIPE_SECRET_KEY=` (sk_test_… locally; empty = "online giving is not set up yet")
    - `# STRIPE_WEBHOOK_SECRET=` (whsec_…)
    - `# STRIPE_CUSTOMER_PORTAL_URL=` (https://billing.stripe.com/p/login/…)
    - `# DONATION_RATE_LIMIT_PER_HOUR=` (default 10)
    - `# STRIPE_API_BASE_URL_FOR_TESTS=` (automated tests only, loopback + test key only; never set it in Vercel)
    - Remove `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (decision 1).
  - **Files:** `package.json`, `package-lock.json`, `next.config.ts`, `src/proxy.ts` (comment only), `vitest.config.mts`, `playwright.config.ts`, `.env.example`.
  - **Verify:** `npm run typecheck`, `npm run lint` and `npm run build` exit 0.

- [ ] 2. Schema and migration (`phase8_donations`), settings fields
  - **Schema** (`prisma/schema.prisma`): add the enums, `FormKind.DONATION`, `Donation`, `DonationSubscription`, `StripeEvent` and `SiteSettings.givingInfoEn/Ne` exactly as in decision 9. Change the `taxDeductibleVerified` comment to "OWNER only; drives src/lib/donation-wording.ts".
  - **Migration (mission_dev, never reset):**
    1. `npm run db:status`. If Postgres is stopped, `npm run db:start` and record that you started it.
    2. Read-only pre-check with a one-off `npx tsx -e` script using `createPrismaClient(process.env.DATABASE_URL)`. It must assert that the URL contains `/mission_dev`. It prints the OWNER count, `ministryName`, `logoUrl`, `donationsEnabled`, `taxDeductibleVerified`, and the row counts of Post/Event/MediaItem/PrayerRequest/ContactMessage. Use `$queryRaw`. Record the output.
    3. `npx prisma migrate status` must say up to date, with no drift. **On drift, stop; never reset.**
    4. `npm run db:migrate -- --name phase8_donations` (`assert-local-db` + `prisma migrate dev`). The change is additive only (new enums/tables/nullable columns, plus `ALTER TYPE "FormKind" ADD VALUE 'DONATION'`), so there is no data-loss prompt.
       - If the command waits on a prompt or exceeds 180 s, stop it.
       - Then use the Phase 7 fallback: create `prisma/migrations/<UTC yyyymmddHHMMSS>_phase8_donations/` by hand, generate the SQL read-only with `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script --output "<folder>/migration.sql"`, and apply it with `npx tsx scripts/assert-local-db.ts; npx prisma migrate deploy`.
    5. Review the SQL. It must contain **no DROP, no TRUNCATE, no DELETE and no ALTER … TYPE on existing columns**.
    6. `npx prisma migrate status` must be up to date. The post-check must show the same values as the pre-check (plus the two new null columns).
  - `src/config/site.ts` `defaultSiteSettings`: add `givingInfoEn: null`, `givingInfoNe: null`.
  - `src/lib/validation/settings.ts`: add `givingInfoEn: optionalMarkdown(5000)` and `givingInfoNe: optionalMarkdown(5000)`.
  - `src/app/admin/(dashboard)/settings/page.tsx` › Donations section:
    - Add `MarkdownEditor`s "How gifts are used (English)" / "(नेपाली, Nepali)" with the hint "Shown on the Support page. Leave empty to show the sample text."
    - Change the `donationsEnabled` hint to "Shows the giving form on the Support page. Online giving also needs the Stripe keys (see Donations)."
    - Replace the warning note's last sentence with: "Until it is checked, the Support page and the Terms say gifts are not deductible for tax. After it is checked they only say gifts may be, and to ask a tax advisor."
    - The admin copy stays free of the phrase "tax-deductible".
  - `src/test/factories.ts`: add `makeDonation(data)` and `makeDonationSubscription(data)`.
  - **Tests:** extend `src/lib/validation/admin.test.ts` (givingInfo optional, 5000 limit, Markdown kept). `prisma/seed.db.test.ts` stays green (donation tables stay empty after seeding; add that assertion).
  - **Files:** `prisma/schema.prisma`, `prisma/migrations/<ts>_phase8_donations/migration.sql`, `src/config/site.ts`, `src/lib/validation/settings.ts`, `src/app/admin/(dashboard)/settings/page.tsx`, `src/test/factories.ts`, `src/lib/validation/admin.test.ts`, `prisma/seed.db.test.ts`.
  - **Verify:** `npm run typecheck` exits 0. `npx prisma migrate status` is up to date. The pre/post-check matches (recorded). `npx vitest run --project unit src/lib/validation` and `npx vitest run --project db prisma` pass.

- [ ] 3. Pure donation modules + unit tests
  - `src/lib/donations/amount.ts`: presets, `MIN_CENTS`, `MAX_CENTS`, `parseUsdToCents`, `formatUsd(cents, locale)` (`Intl.NumberFormat(locale === "ne" ? "ne-NP" : "en-US", { style: "currency", currency: "USD" })`).
  - `src/lib/donations/stripe-config.ts`: `resolveStripeConfig(env)` (decision 4) and `donationRateLimit(env)` (1..1000, default 10).
  - `src/lib/donations/giving-state.ts`: `resolveGivingState` (decision 5).
  - `src/lib/donations/period.ts`: `DONATION_PERIODS`, `periodRange(period, now)` (UTC, half-open `[from, to)`, `all` → `{}`), `PERIOD_LABELS`.
  - `src/lib/donations/csv.ts`: `csvCell(value)`, `toCsv(rows: (string | number | null)[][])` (decision 14).
  - `src/lib/donations/checkout-params.ts`: `buildCheckoutParams(input, ctx)` (decisions 3, 6). It returns a plain object typed with `Stripe.Checkout.SessionCreateParams` (type-only import).
  - `src/lib/validation/donations.ts`:
    - `checkoutSchema`: fields `locale` (en/ne, catch en), `interval` (`ONE_TIME|MONTHLY`, error `invalidOption`), `amountChoice` (one of the presets as strings, or `custom`), `customAmount`. Its superRefine produces `{ amountCents }`. Error keys (i18n keys, like Phase 6): `amountRequired`, `amountInvalid`, `amountTooSmall:5`, `amountTooLarge:10000`.
    - `DonationFormState` = idle | error `{ code: "VALIDATION" | "RATE_LIMITED" | "NOT_AVAILABLE" | "ERROR", fieldErrors? }`.
    - `parseDonationListQuery(searchParams)`, built on `parseListQuery` with `period` (default `this-month`), `interval`, `status` and `mode`.
  - `src/lib/validation/list-query.ts`: add `period?`, `interval?` and `mode?` to `Filters`.
  - `src/lib/donation-wording.ts`: add `donationDisclosure(locale, verified)` (decision 16) and keep `donationTaxNote` as it is.
  - Add every new module to `PURE_MODULES` in `src/test/script-imports.test.ts`.
  - **Tests** (each one sits next to its module):
    - `amount.test.ts`: "25", "25.5", "25.50", "$1,000", " 5 " parse; "4.99" → below the minimum; "10000.01" → above the maximum; "abc", "1e3", "-5", "5.555", "" and 7-digit values → null. Also checks integer exactness (`19.99` → 1999) and `formatUsd` en/ne.
    - `stripe-config.test.ts`: every key prefix; webhook needs `whsec_`; portal only on billing.stripe.com https; the override is rejected for a non-loopback host, for a live key and for a bad URL, and accepted for `http://127.0.0.1:3212` with a test key.
    - `giving-state.test.ts`: all 4 combinations.
    - `period.test.ts`: month/year edges, 1 Jan, 31 Dec, leap day, `last-30-days`, `all`.
    - `csv.test.ts`: quotes, newlines, `=SUM(1)`, `+1`, `-2`, `@x`, `\tcmd`, `\rX` all prefixed with `'`; plain emails are untouched; the BOM and CRLF are present; null → empty.
    - `checkout-params.test.ts`: payment vs subscription shape, `usd`, `unit_amount` = cents, `submit_type: "donate"` only in payment mode, `payment_method_types: ["card"]`, metadata on session + PI/subscription, locale-specific success/cancel URLs with the literal `{CHECKOUT_SESSION_ID}`, product name from the ministry name, and no email or PII params.
    - `src/lib/validation/donations.test.ts`: presets, custom required when `custom`, preset values outside the list rejected, a tampered `amountChoice=1` rejected, interval enum, and list-query fallbacks.
    - `donation-wording.test.ts`: extended. Unverified → "not tax-deductible", with no "may"/"consult". Verified → contains "may be tax-deductible", "consult your tax advisor" and the receipt note. Neither ever says "is tax-deductible", "501(c)" or "charity". `donationDisclosure` matches `donationTaxNote`.
  - **Verify:** `npx vitest run --project unit src/lib` passes, and `npm run typecheck` exits 0.

- [ ] 4. Stripe client + checkout pipeline + public action (depends on 2, 3)
  - `src/server/donations/stripe-client.ts` (server-only):
    - `getStripeClient(env = process.env): Stripe | null`. It returns null unless `checkoutReady`. It is memoized per key and override, and calls `new Stripe(key, { maxNetworkRetries: 2, timeout: 15_000, telemetry: false, appInfo: { name: "mission-app" }, ...apiOverride })`.
    - It exports a narrow `StripeLike` type (`checkout.sessions.create`, `invoicePayments.list`) so tests can inject fakes. Inject through parameters only: `runCheckoutStart(formData, deps = defaultDeps)` and `processStripeEvent(event, { client })`. No global test setter.
  - `src/server/donations/checkout.ts` (server-only, no directive): `runCheckoutStart` (decision 11). The checks before Stripe (state, validation, rate limit) never call Stripe.
  - `src/server/actions/public-donations.ts` (`"use server";`): only `export async function startCheckoutAction(_prev: DonationFormState | null, formData: FormData)`, which returns `runCheckoutStart(formData)`.
  - `src/server/actions/guard-coverage.test.ts`: turn `PUBLIC_ACTIONS` into a map of name → `{ file, pipeline }`:
    - `submitPrayerAction` / `submitContactAction` → `public-forms.ts` / `runPublicSubmission(`
    - `startCheckoutAction` → `public-donations.ts` / `runCheckoutStart(`

    Add "public-donations.ts exports only startCheckoutAction", and "checkout.ts is server-only and has no use-server directive".
  - **DB tests** `src/server/donations/checkout.db.test.ts` (inject a fake client; `vi.stubEnv` keys; settings row with `donationsEnabled`):
    - Not configured → `NOT_AVAILABLE`, and the fake was not called.
    - Closed → `NOT_AVAILABLE`.
    - Invalid/too-small/too-large amount → `VALIDATION` with the right key and no call.
    - Honeypot → redirect to the thank-you page, with no Stripe call and no attempt row (the honeypot runs first, as in Phase 6).
    - The limit plus one → `RATE_LIMITED` (`FormSubmissionAttempt` rows with `form = DONATION`; raw IP never stored).
    - One-time and monthly: the params passed match `buildCheckoutParams`, and the mocked `redirect` gets `session.url`.
    - A non-Stripe `session.url` → `ERROR`, no redirect.
    - A Stripe error → `ERROR`, and the log spy shows no email or amount.
    - The live-key path never uses the override.
  - **Files:** the three new server files, `guard-coverage.test.ts`, `checkout.db.test.ts`.
  - **Verify:** `npx vitest run --project db src/server/donations` and `npx vitest run --project unit src/server/actions` pass. `npm run typecheck` exits 0.

- [ ] 5. Webhook processing + route (depends on 2, 4)
  - `src/server/donations/webhook.ts` (server-only):
    - `verifyStripeEvent(raw, header, secret)` → `Stripe.Event`. It wraps the static `Stripe.webhooks.constructEvent` and throws `InvalidSignatureError`.
    - `processStripeEvent(event, { db = prisma, client })` → `{ outcome: "processed" | "ignored" | "duplicate" }`. It implements decision 10's steps 4–6 and the four handlers. Each handler is a small function taking `(tx, object, event)`.
  - `src/app/api/stripe/webhook/route.ts`: decision 10's steps 1–3 and 7. Export only `POST`, `runtime` and `dynamic`.
  - **Fixtures** `src/test/fixtures/stripe/*.json` are synthetic, with fake ids (`evt_test_…`, `cs_test_…`, `pi_test_…`, `in_test_…`, `sub_test_…`, `cus_test_…`), `api_version: "2026-09-30.endive"`, `livemode: false`, and `metadata.app = "mission-site"`. Card details are deliberately left out, except one charge fixture that includes `payment_method_details.card.last4: "4242"`, to prove we don't store it.
    - `checkout-session-completed-payment.json`
    - `checkout-session-completed-subscription.json`
    - `checkout-session-completed-unpaid.json`
    - `checkout-session-completed-foreign-app.json`
    - `checkout-session-completed-eur.json`
    - `invoice-paid.json` (without `payments`)
    - `charge-refunded-partial.json`
    - `charge-refunded-full.json`
    - `customer-subscription-deleted.json`
    - `payment-intent-succeeded.json` (unhandled type)
  - A helper `src/test/stripe.ts`: `signedRequest(fixture, { secret, timestamp? })` builds the payload with `JSON.stringify` and the header with `Stripe.webhooks.generateTestHeaderString`.
  - **DB tests** `src/server/donations/webhook.db.test.ts`:
    - Signature: valid passes. Wrong secret, a tampered body (one byte), a timestamp older than the tolerance, a missing header and a malformed header all throw.
    - Each fixture produces the expected rows and columns. Payment → 1 ONE_TIME PAID with the correct cents/email/ids. Subscription → 1 ACTIVE subscription and 0 donations. `invoice.paid` → 1 MONTHLY donation linked to the subscription, with the payment intent taken from the mocked `invoicePayments.list`. `invoice.paid` **before** the checkout event works in either order and leaves one subscription. Partial then full refund → PARTIALLY_REFUNDED then REFUNDED. `subscription.deleted` → CANCELED with `canceledAt`.
    - Ignored: the unpaid, foreign-app, EUR and unhandled types (a `StripeEvent` row with outcome "ignored", no donation). An unmatched refund is ignored.
    - **Idempotency:** the same event twice → `duplicate`, one Donation, one `StripeEvent`. Two events with different ids for the same session → still one Donation (unique upsert). Concurrent `Promise.all` of the same event → one row.
    - **Rollback:** a handler that throws (fault injection via a db proxy, or a mocked client that rejects for `invoice.paid`) → no `StripeEvent` row and no donation, so a retry processes it.
    - **No card data:** after processing every fixture, `JSON.stringify(await prisma.donation.findMany())` contains neither `4242` nor `card`, and the Donation model fields (from `Prisma.DonationScalarFieldEnum`) match none of `/card|last4|brand|exp/i`.
  - **Route tests** `src/app/api/stripe/webhook/route.db.test.ts` (calling `POST(new Request(...))`, as in Phase 7's `routes.db.test.ts`): 503 without keys; 400 for a missing or bad signature; 413 when over 1 MiB; 200 processed; 200 duplicate; 500 when processing fails, and the retry then succeeds. Every response is `no-store`. The route module exports no `GET`.
  - Add a static assertion to `src/app/api/route-guard-coverage.test.ts`, or a sibling `src/app/api/stripe/webhook/route-shape.test.ts`: the webhook source uses `request.text()`, never `request.json()`, calls `verifyStripeEvent(`, and exports only `POST`.
  - **Files:** `src/server/donations/webhook.ts`, `src/app/api/stripe/webhook/route.ts`, fixtures, `src/test/stripe.ts`, the tests above.
  - **Verify:** `npx vitest run --project db src/server/donations src/app/api/stripe` and `npx vitest run --project unit src/app/api` pass. `npm run build` exits 0 (the route is listed as `ƒ /api/stripe/webhook`).

- [ ] 6. Public Support page, DonationForm, result pages, messages (depends on 3, 4)
  - `src/app/[locale]/support/page.tsx` (`dynamic = "force-dynamic"`, metadata via `localizedPageMetadata(params, "support", "/support")`):
    1. `PageHero` (eyebrow, title "Support the Mission", intro).
    2. **"How gifts are used":** `givingInfo` (localized ne→en with the right `lang`) rendered with the existing `MarkdownContent` / `renderMarkdown` pipeline, or the demo text from messages with a `DemoBadge`. The site `missionStatement` is shown above it when set.
    3. State-driven card (decision 5):
       - `open` → `<DonationForm>` inside a `Card`, plus an `aside` "About giving" disclosure list:
         - processor
         - no card data
         - USD
         - the tax note from `donationDisclosure`
         - refunds/contact with `contactEmail` as a `mailto:` link
         - the monthly-management line (portal link or email)
         - a link to the Privacy Policy
       - `not-configured` / `closed` → a `Card` with an h2 ("Online giving is not set up yet" / "Online giving is not open right now"), a friendly body, the contact email, and links to `/prayer` and `/contact`. No form, no amounts, no tax wording.
  - `src/components/public/DonationForm.tsx` (client; `useActionState(startCheckoutAction)`; pattern from `PrayerForm.tsx`):
    - Fieldset "Frequency" with a legend and radios "One-time" / "Monthly" (default one-time).
    - Fieldset "Amount (USD)" with a legend, radios for each preset (shown as `$25`… pill-styled labels with visible focus rings, min 44 px targets) and "Other amount".
    - The "Other amount" choice reveals `Input` `inputMode="decimal"` with a `$` prefix. It is labelled "Other amount in US dollars", with the hint "From $5 to $10,000" (`aria-describedby`). When it is revealed, focus moves to it. It stays enabled (not removed) so the value is kept.
    - Hidden `locale` field and `Honeypot idPrefix="donation"`.
    - `FormAlert` for form errors, and `FieldError`s with ids wired through `aria-describedby`. On error, focus goes to the first invalid field or to the alert.
    - Submit "Continue to secure payment" (monthly: "Continue to set up monthly gift"), with a pending label "Opening Stripe…". Below it, the note "You'll finish on Stripe's secure page."
    - `prefers-reduced-motion` respected (no animated transitions).
  - `src/components/public/form-messages.ts`: handle `amountRequired`, `amountInvalid`, `amountTooSmall:<min>` and `amountTooLarge:<max>`. Add `NOT_AVAILABLE` to a donation form-code mapper (a separate `useDonationErrorText`, or widen the type).
  - `src/app/[locale]/support/thank-you/page.tsx` and `src/app/[locale]/support/cancelled/page.tsx`:
    - Static content with an h1.
    - Thank-you: "Thank you for your gift", "Stripe will email your receipt", the tax note, the monthly-management line, and links home and to Prayer.
    - Cancelled: "No payment was made", plus a "Back to the Support page" button.
    - `generateMetadata` with `robots: { index: false, follow: false }`, via new `PageKey`s `supportThanks` and `supportCancelled` (path `/support/thank-you`, `/support/cancelled`). The sitemap is unchanged.
  - `src/lib/metadata.ts`: add the two `PageKey`s, and an optional `noindex` flag in `localizedPageMetadata`.
  - **Messages** (en + ne, identical keys; ne marked for review; **no tax words**):
    - `Metadata.support.description` → "Ways to support the work of {name}, including online giving in US dollars."
    - `Metadata.supportThanks`, `Metadata.supportCancelled`
    - New namespaces:
      - `SupportPage`: eyebrow, title, intro, howGiftsUsed, demoGivingInfo ("Sample text: the ministry will describe here how gifts are used."), notConfiguredTitle/Body, closedTitle/Body, otherWaysTitle, prayLink, contactLink, emailUs, aboutGivingTitle, processorNote, noCardNote, usdNote, refundNote ("Questions about a gift, or need a refund? Email {email}."), manageMonthlyLink, manageMonthlyEmail, privacyLink
      - `DonationForm`: formLabel, frequencyLegend, oneTime, monthly, amountLegend, otherAmount, otherAmountLabel, amountHint, submitOneTime, submitMonthly, opening, finishOnStripe, notAvailable
      - `SupportThanks`, `SupportCancelled`
    - `FormErrors`: amountRequired, amountInvalid, amountTooSmall ("The smallest gift online is {min} US dollars."), amountTooLarge, notAvailable.
    - Extend the ne `_note`.
  - Remove `src/components/PlaceholderPage.tsx` and the `Placeholder` messages namespace **only if** `git grep -n "PlaceholderPage\|\"Placeholder\"\|namespace: \"Placeholder\""` shows no other users after this change. Otherwise keep them.
  - **Component tests** `src/components/public/DonationForm.test.tsx`, mocking the action like `PrayerForm.test.tsx`:
    - The radios have accessible names and fieldsets have legends.
    - Choosing "Other amount" reveals the input, focuses it, and wires `aria-describedby` to the hint.
    - The monthly label changes the button text.
    - A returned field error is shown, with `aria-invalid`, and gets focus.
    - `NOT_AVAILABLE` and `RATE_LIMITED` show the alert.
    - The honeypot is rendered hidden.
  - **Page-logic test** `src/lib/donations/support-view.test.ts`, if the page's choice of state/wording is extracted into a pure `supportViewModel({ state, verified, portalUrl, locale })`. Extract it, so "wording driven by taxDeductibleVerified" is also tested at view level: unverified → not-deductible text, verified → may + consult + receipt; not-configured → no tax text at all.
  - **Files:** the pages above, `DonationForm.tsx` (+ test), `form-messages.ts`, `metadata.ts`, `messages/en.json`, `messages/ne.json`, `src/lib/donations/support-view.ts` (+ test, PURE_MODULES), and possibly removing PlaceholderPage.
  - **Verify:** `npx vitest run --project unit src/components src/lib` passes (including `messages.test.ts`). `npm run build` exits 0. Then `npm run dev` on a **different port** (`npx next dev -p 3005`, never touching :3000). `/en/support` and `/ne/support` show the not-configured state, and `/en/support/thank-you` renders. Stop that dev server afterwards.

- [ ] 7. Admin donations page, CSV export, nav (depends on 2, 3, 5)
  - `src/server/auth/route-guard.ts`: add an optional `role?: "OWNER"`. After the session check, `actor.role !== "OWNER"` → 403 `{ error: "FORBIDDEN" }` with `log.warn("admin.route.denied", { path, code: "FORBIDDEN" })`. Existing callers are unchanged. Extend its tests (Phase 7's `routes.db.test.ts` pattern, or a new `route-guard.db.test.ts`): anonymous → 401, editor with role OWNER → 403, owner → actor.
  - `src/server/services/donations.ts` (server-only, reads):
    - `donationWhere(query)`
    - `listDonations(query)`, using the `paginate` helper
    - `donationTotals(query)`, via `prisma.donation.aggregate` / `groupBy`
    - `activeSubscriptionCount()`
    - `lastWebhookAt()`
    - `exportDonationRows(query, cap = 10_000)`
  - `src/app/admin/(dashboard)/donations/page.tsx`: `requireOwnerPage("/admin/donations")`.
    - `PageHeader` "Donations", with the description "Gifts recorded from Stripe. Amounts in US dollars; periods in UTC."
    - A `PrivacyNotice`-style note: "Donor emails are personal data. Only the owner can see this page."
    - The Stripe status `EditorSection` (decision 15).
    - `ListToolbar` (search label "Donor email", filters period/frequency/status/mode).
    - The totals `DetailList` cards, and the "Export CSV" link (`/api/admin/donations/export?…`, `download`).
    - `RecordList` rows (decision 13) inside `Suspense` with `ListSkeleton`, and `Pagination`.
    - Empty state: "No gifts in this period" / "No gifts recorded yet". When not configured, add "Online giving is not set up yet. See the README to connect Stripe."
  - `src/components/admin/labels.ts`: `DONATION_STATUS_LABELS`, `DONATION_INTERVAL_LABELS`, `DONATION_MODE_LABELS`. Extend `StatusBadge` for PAID / PARTIALLY_REFUNDED / REFUNDED, or render a `Badge` directly.
  - `src/components/admin/AdminNav.tsx`: add `{ href: "/admin/donations", label: "Donations" }` to `OWNER`, after Settings. Don't touch the sidebar layout; the Log out reachability NIT belongs to Phase 9.
  - `src/app/api/admin/donations/export/route.ts`: `GET` only, with `requireAdminRoute(request, { mutation: false, role: "OWNER" })` (decision 14).
  - `src/app/api/route-guard-coverage.test.ts`:
    - Add `donations/export/route.ts` to the expected list.
    - Assert that any handler under `donations/` passes `role: "OWNER"`.
  - **DB tests:**
    - `src/server/services/donations.db.test.ts`, using `makeDonation` across months/modes/statuses:
      - each filter on its own and combined
      - `q` is case-insensitive
      - pagination
      - totals: gross/refunded/net/one-time/monthly exact cents
      - the `this-month` boundary uses UTC (fake timers)
      - `activeSubscriptionCount`
    - `src/app/api/admin/donations/export/route.db.test.ts`:
      - 401 anonymous, 403 editor (with `admin.route.denied` logged), and a deactivated owner → 401
      - owner → 200 with the CSV headers, BOM and header row; the filters are applied
      - a donor email `=HYPERLINK("x")@example.org` is exported as `"'=HYPERLINK(""x"")@example.org"`
      - the cap/truncation line (cap injected small)
      - exactly one `donation.export` audit row whose metadata has `rows` and no `@`
  - **Files:** the files above, plus `src/components/admin/StatusBadge.tsx` if extended.
  - **Verify:** `npx vitest run --project db src/server/services/donations.db.test.ts src/app/api/admin` and `npx vitest run --project unit src/app/api src/components/admin` pass. `npm run build` exits 0 (it lists `/admin/donations` and `/api/admin/donations/export`).

- [ ] 8. Docs (README + legal check)
  - `README.md`:
    - **Phase status:** Phase 8 done.
    - **Environment variables:** a Donations table with the 5 variables from item 1. Remove the "placeholders" sentence.
    - **New "Setting up Stripe (donations)" section,** step by step for a non-technical owner:
      1. Create a Stripe account and stay in **Test mode**.
      2. Developers › API keys: copy the secret key into `STRIPE_SECRET_KEY`. There's no publishable key to copy.
      3. Settings › Customer emails: turn on "Successful payments" so Stripe emails receipts.
      4. Developers › Webhooks › Add endpoint: `https://<your-domain>/api/stripe/webhook` with the 4 events. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
      5. Optional: Settings › Billing › Customer portal › activate the login link, and put it in `STRIPE_CUSTOMER_PORTAL_URL`.
      6. Local testing with the Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhook`, which prints a `whsec_` for `.env`. Use test card 4242 4242 4242 4242.
      7. Admin › Settings: tick "Donations are enabled".
      8. Going live: switch to Live mode, create live keys and a live webhook, and update the Vercel env vars.
    - **Admin guide:** the Donations page (OWNER only, with the reason), filters, totals in UTC, CSV export (opens in Excel; cells starting with `= + - @` are prefixed with `'` on purpose), and the meaning of the "Test" badge. Refunds are made in the Stripe Dashboard and show up automatically.
    - **Security notes:** no card data, signature-verified webhook, idempotency, OWNER-only access, the CSV-injection guard, and the loopback-only test override.
    - **Go-live checklist:** confirm the tax status before ticking the box, write "How gifts are used" in Settings, decide a refund policy and put it in the Terms, and switch Stripe to live.
    - **Known limitations:** USD and card only (incl. Apple/Google Pay); totals are UTC; no in-app refunds; the thank-you page doesn't confirm the specific payment; donors manage monthly gifts only through the Stripe portal link or by email.
  - `src/content/legal/privacy.ts` / `terms.ts`: read both. The donation paragraphs already describe exactly what is stored (amount, currency, frequency, status, Stripe reference numbers, optional email, no card numbers). Change them only if something the implementation does is missing. Expected: no change. Record the result in verification.md. `legal.test.ts` must stay green.
  - **Verify:** `npm run format:check` exits 0. `git grep -n -i "NEXT_PUBLIC_STRIPE"` returns nothing.

- [ ] 9. E2E specs, helpers and screenshots (depends on 1–8)
  - `e2e/helpers/stripe-server.ts` (decision 17):
    - `startStripeE2e(): Promise<{ baseUrl: "http://localhost:3211", requests: RecordedRequest[], stop(): Promise<void> }>`
    - It waits until `GET http://localhost:3211/en` returns 200 (timeout 120 s).
    - It parses Stripe's bracketed form encoding (`line_items[0][price_data][unit_amount]`) with `URLSearchParams` into a flat map. That is enough for assertions.
    - It exports `signedWebhook(fixtureObject)`, which imports `Stripe` from `stripe` and uses `Stripe.webhooks.generateTestHeaderString` with `whsec_e2e_dummy`.
  - `e2e/global-teardown.ts`: if `.local/e2e-stripe-server.pid` exists, kill that pid (ignore errors) and delete the file.
  - `e2e/support.spec.ts` (**public** project; add it to `PUBLIC_SPECS`):
    - `/en/support` and `/ne/support` return 200 with an h1. The not-configured heading is visible (en + ne text from the message files). There is no amount radio and no submit button. The contact email is shown, and Prayer/Contact links work.
    - `/en|ne/support/thank-you` and `/cancelled` return 200 with an h1 and `<meta name="robots" content="noindex, nofollow">`.
    - `POST /api/stripe/webhook` on :3210 → 503 with `no-store`. A `GET` → 405.
    - `/sitemap.xml` contains `/support` and no `thank-you`.
    - The header is unchanged: the logo, the ministry name and the "Support the Mission" link to `/en/support` are still present.
    - axe has no serious/critical violations for `/support`, `/support/thank-you` and `/support/cancelled` in en and ne, at 1280 and 375.
  - `e2e/donation-access.spec.ts` (**admin-readonly**):
    - Anonymous: `/admin/donations` → redirected to `/admin/login?next=%2Fadmin%2Fdonations`; `GET /api/admin/donations/export` → 401 + `no-store` + `noindex`.
    - Editor (`EDITOR_STATE`): `/admin/donations` → `/admin/forbidden`; export → 403 `{ error: "FORBIDDEN" }`; the sidebar has no "Donations" link.
    - Owner: the page shows "Not set" for the secret key and the empty state; export → 200 `text/csv` with only the header row.
    - axe on `/admin/donations` at 1280 and 375 as owner.
  - `e2e/donations-checkout.spec.ts` (**admin-mutations**, before `phase8-screenshots`; `beforeAll` `startStripeE2e()`, `afterAll` `stop()` plus restoring the settings):
    1. Owner on :3210 `/admin/settings`: tick "Donations are enabled", save, see the toast.
    2. :3211 `/en/support` shows the form; axe clean at 1280/375.
    3. Validation: "Other amount" with `4` → the min error is shown and focused, `aria-invalid`, and the mock received 0 requests. `10001` → the max error. `abc` → invalid.
    4. One-time $50: submit → the browser lands on `:3211/en/support/thank-you?session_id=cs_test_e2e_1`. The mock recorded `mode=payment`, `currency=usd`, `unit_amount=5000`, `submit_type=donate`, `payment_method_types[0]=card`, `metadata[app]=mission-site`, a success URL ending `/en/support/thank-you?session_id={CHECKOUT_SESSION_ID}`, and a cancel URL ending `/en/support/cancelled`.
    5. Monthly custom $12.34 on `/ne/support` → `mode=subscription`, `recurring[interval]=month`, `unit_amount=1234`, ne URLs.
    6. Tax wording: on :3211 the disclosure shows "not tax-deductible". The owner ticks "Donation tax status has been verified" on :3210. A reload on :3211 shows "may be tax-deductible; consult your tax advisor" and the receipt note. Untick it again.
    7. Webhooks: post signed fixtures to `:3211/api/stripe/webhook`. The payment completed → 200. The **same event again** → 200 duplicate. The subscription checkout, then `invoice.paid` (the mock answers invoice_payments), then a partial `charge.refunded`. One fixture's `customer_details.email` is `=HYPERLINK("x")@example.org`.
    8. Owner on :3210 `/admin/donations?period=all`: 2 rows (one-time $50, monthly $12.34), the totals show the gross, refunded and net values that match, the "Test" badges, filter Monthly → 1 row, and status "Secret key: Not set" (:3210 has no keys). The CSV download (`page.waitForEvent("download")`) has 2 data rows and the escaped `'=HYPERLINK` cell.
    9. A bad signature on :3211 → 400.
    10. `afterAll`: untick "Donations are enabled" again and stop the servers.
  - `e2e/phase8-screenshots.spec.ts` (**admin-mutations**, last; reuses `startStripeE2e`; saves under `c:\Users\rasaily\Downloads\mission app\.agents\screenshots\phase8\`, created with `mkdirSync`; full page; fonts ready; asserts `scrollWidth <= clientWidth` via the `scrollWidth` helper):
    - `support-not-configured-{en,ne}-{375,1280}.png` (:3210)
    - `support-open-{en,ne}-{375,1280}.png` (:3211, donations enabled)
    - `support-open-other-amount-error-en-375.png`
    - `support-open-monthly-en-1280.png`
    - `support-open-verified-wording-en-1280.png`
    - `support-thank-you-{en,ne}-{375,1280}.png`
    - `support-cancelled-{en,ne}-1280.png`
    - `admin-donations-{375,1280}.png` (with the rows from the checkout spec; if it runs alone, post the fixtures first)
    - `admin-donations-empty-status-1280.png` (filter `period=last-year`)
    - `admin-settings-donations-1280.png` (the Donations section, clipped to its locator)
    - `header-unchanged-en-1280.png`
    - Restore the settings afterwards.
  - `playwright.config.ts`: add `support.spec.ts` to `PUBLIC_SPECS`, `donation-access.spec.ts` to admin-readonly, and `donations-checkout.spec.ts` + `phase8-screenshots.spec.ts` to the end of admin-mutations (before `phase7-screenshots` is fine, but keep `phase8-screenshots` last).
  - Update existing specs whose Support expectations changed. `navigation.spec.ts` only checks for 200 + h1, so it should pass unchanged. List each spec you change.
  - **Verify:**
    - `npm run test:e2e` passes everything (≥ 252 + the new tests), with `[axe] … serious/critical=0` for every new page.
    - Afterwards nothing listens on 3211/3212 (`Get-NetTCPConnection -LocalPort 3211,3212 -ErrorAction SilentlyContinue` is empty), and `.local/e2e-stripe-server.pid` is gone.
    - **Open every screenshot and look at it:** on-brand navy/ivory/beige/gold, the preset pills are readable, error text is red with an icon as elsewhere, Devanagari renders, there is no horizontal overflow at 375, and the header is unchanged. Write one line per image in verification.md.

- [ ] 10. Full verification and evidence (`.agents/tasks/phase8/verification.md`)
  1. `npm run lint`, `npm run typecheck`, `npm run format:check` and `npm run build` all exit 0. Record the new routes from the build output.
  2. `npm test`: record the file/test counts versus 76 / 756, list the new test files, and list any rewritten tests with reasons.
  3. `npm run test:e2e`: record the count versus 252 and the axe lines for the new pages.
  4. Screenshots: the list, plus what you saw in each.
  5. Greps, using PowerShell `git grep` over tracked + untracked, excluding `.agents/`:
     - `S3|AWS|Amazon|Cognito|SES`: only the known binary/test noise.
     - `NEXT_PUBLIC_`: only `NEXT_PUBLIC_SITE_URL`.
     - `sk_live_|sk_test_[A-Za-z0-9]{20,}|whsec_[A-Za-z0-9]{20,}|rk_live_`: no real keys (only the `sk_test_e2e_dummy` / `whsec_e2e_dummy` / unit fakes).
     - `501\(c\)|registered charity`: none.
     - `tax[- ]deductible` only in `src/lib/donation-wording.ts`, its test, `support-view.test.ts` and E2E assertions.
     - `request\.json\(` not in the webhook route.
     - `git ls-files .env` is empty, and `.local/` is ignored.
  6. mission_dev (read-only): the pre/post-check output; `npx prisma migrate status` up to date; 1 OWNER; `ministryName` "Bible Distribution Ministry"; `logoUrl` `/brand/logo-mark.png`; `donationsEnabled`/`taxDeductibleVerified` unchanged; 0 donation rows.
  7. `npm audit --omit=dev`: the output compared with Phase 7 (the stripe package adds no dependencies).
  8. Decisions recorded: copy the Decisions list above in short form, especially **access = OWNER only (editors have no read access)** and why, no publishable key, card-only, presets/min/max, the UTC periods, and the loopback-only test override.
  9. Notes for the user:
     - Restart `npm run dev` (new dependency + Prisma client).
     - Create a Stripe account in test mode and set the keys + webhook (README).
     - Write "How gifts are used" in Settings.
     - Get the tax status confirmed before ticking the box.
     - Decide a refund policy.
  10. Known limitations: as in the README.

## Out of scope (left for Phase 9 or later)

- CSP/HSTS hardening, which must allow the redirect to `checkout.stripe.com` and `billing.stripe.com`. Phase 9 adds the CSP; note in verification.md that `form-action` must include `https://checkout.stripe.com` if the Phase 9 CSP sets `form-action`, because server-action redirects follow a 303.
- Admin sidebar Log out reachability (Phase 9 NIT).
- Donor-facing receipts from our own email. Stripe sends them.
