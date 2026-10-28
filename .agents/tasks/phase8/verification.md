# Phase 8 verification (donations, Stripe, USD)

Not committed (the finalize step makes the one Phase 8 commit after approval).

## 1. Static checks (all exit 0, final run after every edit)

| Command | Result |
| --- | --- |
| `npm run lint` | 0 |
| `npm run typecheck` | 0 |
| `npm run format:check` | 0 |
| `npm run build` | 0. New routes: `ƒ /[locale]/support` (now dynamic), `ƒ /[locale]/support/thank-you`, `● /[locale]/support/cancelled` (en, ne), `ƒ /admin/donations`, `ƒ /api/admin/donations/export`, `ƒ /api/stripe/webhook`. |

## 2. `npm test`: 91 files / 945 tests passed (Phase 7: 76 / 756)

New test files (15):
- Pure: `src/lib/donations/amount.test.ts` (parse/limits/integer cents/formatUsd en+ne), `stripe-config.test.ts` (every key prefix, `whsec_` needed, portal only https billing.stripe.com, test override only loopback + test key), `giving-state.test.ts` (4 combinations), `period.test.ts` (UTC month/year edges, 1 Jan, 31 Dec, leap day, last-30-days, all), `csv.test.ts` (quotes, `= + - @ TAB CR` prefixed with `'`, BOM, CRLF), `checkout-params.test.ts` (payment vs subscription, usd, cents, `submit_type` only for payment, card only, metadata, locale URLs with literal `{CHECKOUT_SESSION_ID}`, no PII), `support-view.test.ts` (**wording by taxDeductibleVerified at view level**; not-configured/closed show no tax text), `src/lib/validation/donations.test.ts` (**server-side amount validation**: presets, custom required/invalid/too small/too large, tampered preset `1`, interval enum, list-query fallbacks).
- Component: `src/components/public/DonationForm.test.tsx` (fieldsets + legends, accessible radio names, "Other amount" reveals + focuses + hint wiring, value kept when hidden, monthly button text, field error shown/`aria-invalid`/focused, NOT_AVAILABLE / RATE_LIMITED / ERROR alerts, honeypot hidden).
- Static: `src/app/api/stripe/webhook/route-shape.test.ts` (raw body via `request.body.getReader()`, never `request.json()`, calls `verifyStripeEvent(`, exports only POST, no session/origin check).
- DB: `src/server/donations/checkout.db.test.ts` (not configured / closed / missing settings → NOT_AVAILABLE with no Stripe call; invalid amounts → VALIDATION, no call, no attempt row; honeypot → thank-you redirect, no call, no row; rate limit +1 → RATE_LIMITED, hashed IP only; one-time + monthly params equal `buildCheckoutParams`; non-Stripe URL → ERROR; loopback URL only with override; Stripe error logged without email/amount; live key never uses the override).
- DB: `src/server/donations/webhook.db.test.ts` — **signature** via `Stripe.webhooks.generateTestHeaderString` + `constructEvent` on fixtures (valid string and Buffer; wrong secret, tampered byte, trailing space, stale timestamp > 300 s, missing/empty/malformed header all rejected); **each handled event type** (payment session → ONE_TIME PAID row; subscription session → ACTIVE subscription, no donation; `invoice.paid` → MONTHLY donation linked, PI from mocked `invoicePayments.list`, or from the payload without an API call; either event order; partial → full refund; out-of-order refunds never lower the total; `subscription.deleted` → CANCELED, unknown ours → created CANCELED, foreign → ignored); ignored cases (unpaid, foreign app, EUR, unhandled type, unmatched refund, foreign invoice); **idempotency** (same event twice → duplicate; new event id same session → one donation; same invoice twice → one; 3 concurrent deliveries → 1 processed + 2 duplicate, 1 row); **rollback** (failing Stripe lookup and a failing write inside the transaction both leave no ledger row; the retry succeeds); **no card data** (after all fixtures, including one with `last4: "4242"`, no `4242`/card/last4/visa in any stored row; no card-like columns in the models).
- DB: `src/app/api/stripe/webhook/route.db.test.ts` (503 without keys / without signing secret; 400 for missing/bad/wrong-secret signature, body never logged; 413 declared and actual > 1 MiB; 200 processed then 200 duplicate; 200 ignored; 500 on failure then retry succeeds; `no-store` everywhere; only POST exported).
- DB: `src/server/services/donations.db.test.ts` (each filter alone and combined, case-insensitive email search, pagination, UTC this-month boundary with a faked clock, exact-cent totals, empty totals, active subscription count, last webhook, **CSV** filters + cap + truncation line + exact row encoding).
- DB: `src/app/api/admin/donations/export/route.db.test.ts` (`requireAdminRoute` role OWNER: anonymous 401, editor 403 FORBIDDEN, owner ok, existing callers unchanged; **CSV export**: 401 anonymous, 403 editor with `admin.route.denied` log and no audit row, 401 deactivated owner, 200 with CSV headers + BOM + header row + filters, `=HYPERLINK("x")@example.org` exported as `"'=HYPERLINK(""x"")@example.org"`, one `donation.export` audit row with no `@`, header-only empty export).

Extended tests: `donation-wording.test.ts` (no "may/consult/receipt" when unverified; never "is/are tax-deductible", charity or 501(c); `donationDisclosure` = Terms wording), `admin.test.ts` (givingInfo optional Markdown, 5000 limit), `prisma/seed.db.test.ts` (seed creates no donation rows), `guard-coverage.test.ts` (`PUBLIC_ACTIONS` is now a name → file/pipeline map; `public-donations.ts` exports only `startCheckoutAction`; `checkout.ts` server-only, no directive), `route-guard-coverage.test.ts` (export route listed; every donations route passes `role: "OWNER"`), `admin-structure.test.ts` (`donations` page owner-only), `script-imports.test.ts` (8 new pure modules in `PURE_MODULES`).

Rewritten tests: none. Removed: `src/components/PlaceholderPage.tsx` and the `Placeholder` message namespace (Support was the last user; no test referenced them).

## 3. `npm run test:e2e`: 282 passed (Phase 7: 252)

New specs:
- `e2e/support.spec.ts` (public): `/en|ne/support` 200 + h1, **not-configured state without keys** (no radios, no submit, no tax text, mailto contact email, Prayer/Contact links work), demo "how gifts are used" with badge, thank-you/cancelled 200 + `noindex, nofollow` and the session id is never echoed, webhook 503 `NOT_CONFIGURED` + `no-store` + `noindex` and GET 405, sitemap has `/support` but no result pages, header unchanged, axe on 3 pages × 2 locales × 2 widths.
- `e2e/donation-access.spec.ts` (admin-readonly): **unauthorized users rejected** — anonymous → login redirect `next=%2Fadmin%2Fdonations` and export 401 (`no-store`, `noindex`); editor → `/admin/forbidden`, export 403 `FORBIDDEN`, no nav link; owner → "Not set" key status, empty state, header-only CSV; axe at 1280/375.
- `e2e/donations-checkout.spec.ts` (admin-mutations): mock Stripe API + a second `next start` on :3211 with test keys. Form shown + axe clean at 1280/375; server validation ($4, $10,001, `abc`, no choice) with no Stripe request; **mocked checkout session creation** one-time $50 (payment mode, `submit_type=donate`, `allowed_payment_method_types[0]=card`, usd, 5000, metadata, success/cancel URLs) and monthly $12.34 in Nepali (subscription, `recurring[interval]=month`); tax wording switches with the owner's flag (Support + thank-you); signed webhooks recorded once (duplicate detected), `invoice_payments` lookup hits the mock, bad signature 400; owner sees 2 rows, totals $62.34 / $15.00 / $47.34, Test badges, Monthly filter; CSV download has 2 data rows and the escaped `'=hyperlink` cell.
- `e2e/phase8-screenshots.spec.ts` (admin-mutations, last).

Updated: `playwright.config.ts` (spec lists + empty Stripe env + `DONATION_RATE_LIMIT_PER_HOUR=100`), `e2e/global-teardown.ts` (kills a leftover :3211 server by pid file). No existing spec changed.

Run notes: run 1 had one timeout in the Phase 3 spec (`networkidle` on `/en/media`, unrelated, under load), which skipped dependent projects; run 2 had one timeout in my screenshot spec (`networkidle` + 30 s for many full-page shots). A diagnostic showed only link prefetches (the network does settle). Fix: bounded `networkidle` wait plus a 120 s timeout for that spec. Run 3: **282 passed, 0 failed**. Afterwards nothing listens on 3211/3212 and `.local/e2e-stripe-server.pid` is gone.

Axe (`[axe] … serious/critical=0` for all): `/en|ne/support`, `/en|ne/support/thank-you`, `/en|ne/support/cancelled` (1280 + 375), `:3211/en/support` open form (1280 + 375), `/admin/donations` (1280 + 375).

## 4. Screenshots (`.agents/screenshots/phase8/`, 22 files), opened and checked

- `support-not-configured-en-1280`: header unchanged (logo + name far left, nav centre, gold CTA right). Hero "Support the Mission", ivory "Our mission" quote, "How gifts are used" with dashed demo box + DEMO CONTENT badge, white card "Online giving is not set up yet", mailto email, navy "Send a prayer request" + outline "Contact us". No tax text.
- `support-not-configured-{en-375, ne-1280, ne-375}`: same, stacked at 375, Devanagari renders, no overflow.
- `support-open-en-1280`: two columns. "Online giving" card with navy/outline pill radios (One-time selected), $25/$50/$100/$250 + "Other amount", gold "Continue to secure payment", "You will finish on Stripe's…". Aside "About giving": Stripe, no card data, USD, "Gifts are not tax-deductible.", refund email, monthly-by-email line, Privacy link.
- `support-open-ne-375` (and `ne-1280`, `en-375`): Nepali labels, 2-column pills, aside under the form, the long email wraps inside the card, no overflow.
- `support-open-other-amount-error-en-375`: red alert "Please fix the highlighted fields.", "Other amount" selected (navy), red-bordered input "$ 4", hint, red "The smallest gift online is $5."
- `support-open-monthly-en-1280`: Monthly selected, hint "Charged once a month until you cancel.", button "Continue to set up monthly gift".
- `support-open-verified-wording-en-1280`: aside shows "Gifts may be tax-deductible; consult your tax advisor. Stripe emails a receipt for each gift."
- `support-thank-you-{en,ne}-{375,1280}`: "Thank you for your gift", receipt line, tax note card, monthly email line, Home + Prayer buttons. ne 375 Devanagari fine.
- `support-cancelled-{en,ne}-1280`: "No payment was made", body, "Back to the Support page" + "Contact us".
- `admin-donations-1280`: Donations active in the owner nav, Export CSV, private note, "Stripe connection" list (Not set, webhook URL, last webhook time, portal Not set, Public giving On + Settings link, tax not verified), filters, totals cards (2 / $62.34 / $15.00 / $47.34 / $50.00 / $12.34 / 1 active), rows with Paid / Partially refunded + Test badges, "Refunded $15.00", and the formula-like email shown as plain text. Cosmetic: with four filters the "Donor email" search box is narrow at 1280 (shared ListToolbar wrapping); usable.
- `admin-donations-375`: everything stacked, totals 2-up, the long email and webhook URL wrap, no overflow.
- `admin-donations-empty-status-1280`: "No gifts in this period" empty state for last year.
- `admin-settings-donations-1280`: Donations section with the new hint, the two "How gifts are used" editors (en + ne) and the reworded tax note.
- `header-unchanged-en-1280`: identical to Phase 7.

## 5. Greps (PowerShell `Select-String` over tracked + untracked files, excluding `.agents/`, `.vscode/`, PNGs)

- `S3|AWS|Amazon|Cognito|SES`: only `src/content/legal/legal.test.ts:53` (the test that asserts no AWS). The Stripe package's own d.ts mentions EventBridge but lives in `node_modules`.
- `NEXT_PUBLIC_`: only `NEXT_PUBLIC_SITE_URL` (the Phase 8 `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` placeholder was removed: no publishable key is used).
- Real-looking keys (`sk_live_…`, `rk_live_…`, long `sk_test_…`/`whsec_…`): none. Only short fakes (`sk_test_unit_fake`, `sk_test_e2e_dummy`, `whsec_e2e_dummy`, `whsec_unit_test_secret`).
- `501\(c\)|registered charity`: only negative assertions in `legal.test.ts`, `donation-wording.test.ts`, `messages.test.ts`.
- `tax[- ]deductible`: only `src/lib/donation-wording.ts`, its test, `support-view.test.ts` and the two E2E specs. The message files have none (enforced by `messages.test.ts`).
- `request.json(` in the webhook route: 0.
- `git ls-files .env`: empty; `git check-ignore` reports `.env` and `.local/x` as ignored.

## 6. mission_dev (read-only)

- Pre-check (before migrating) and post-check (now), identical apart from the new empty tables: `owners: 1`, `ministryName "Bible Distribution Ministry"`, `logoUrl "/brand/logo-mark.png"`, `donationsEnabled false`, `taxDeductibleVerified false`, Post 6, Event 4, MediaItem 3, PrayerRequest 0, ContactMessage 0, Gallery 0; Donation / DonationSubscription / StripeEvent 0.
- Migration `20261028134952_phase8_donations`: I used the Phase 7 non-interactive path directly (`migrate dev` hung on a prompt in Phase 7). The SQL was generated read-only with `prisma migrate diff --from-config-datasource --to-schema`. It is additive only: 3 CREATE TYPE, `ALTER TYPE "FormKind" ADD VALUE 'DONATION'`, 2 nullable `SiteSettings` columns, 3 CREATE TABLE, indexes and 1 FK. No DROP, TRUNCATE, DELETE or column type change. Applied with `scripts/assert-local-db.ts` + `prisma migrate deploy`. `prisma migrate status`: up to date. Nothing was reset, seeded or truncated.

## 7. Dependencies

- `stripe` pinned **23.0.1** (`npm view stripe dist-tags`: latest 23.0.1). It has zero dependencies; `package-lock.json` changed only for it.
- `npm audit --omit=dev`: 4 high. These are the same findings as Phase 7 (`@vercel/blob` → nested zod); nothing new from stripe. Not changed.
- Field paths checked against `node_modules/stripe/cjs/resources/*.d.ts` (API `2026-09-30.endive`): `Invoice.parent.subscription_details.{subscription,metadata}`, `Invoice.status_transitions.paid_at`, optional `Invoice.payments`, `InvoicePayment.payment.payment_intent`, `Charge.{payment_intent,amount_refunded}`, `Subscription.{canceled_at,ended_at,start_date,items}`, and the Checkout Session fields from the plan. **One difference from the plan:** `SessionCreateParams` has no `payment_method_types` in this version. The card-only restriction uses `allowed_payment_method_types: ["card"]`.

## 8. Decisions (standing directive)

- **Access: OWNER only.** Editors get no read access to `/admin/donations` or the export: donor emails and amounts are financial personal data, and editors don't need them for content work. This matches Settings/Users/Audit. The page uses `requireOwnerPage`; the export uses `requireAdminRoute({ role: "OWNER" })` → 403. Documented in the README admin guide.
- No Stripe.js and no publishable key. Checkout is a server-action redirect to Stripe's page only (`https://checkout.stripe.com/` checked before redirecting).
- Card only (Apple/Google Pay are card wallets), so a completed session always means paid.
- USD presets $25/$50/$100/$250. Custom amounts from $5 to $10,000, parsed with integer math on the server. No preset is pre-selected (no nudging).
- Periods use UTC (labelled on the page).
- `STRIPE_API_BASE_URL_FOR_TESTS` is honoured only for a loopback host + a test key.
- Webhook: the raw body is read as bytes with a 1 MiB cap that also covers chunked bodies (a bounded stream reader instead of `request.text()`), then passed as a Buffer to `constructEvent`. The ledger row is created first inside the transaction, so a concurrent duplicate fails with P2002 → duplicate. Stripe lookups happen outside the transaction; any failure rolls back → 500 → Stripe retries.
- The thank-you page never calls Stripe and ignores `session_id`. Both result pages are noindex and not in the sitemap.
- Settings gains `givingInfoEn/Ne` ("How gifts are used"). The demo text with a badge shows until it is filled.
- Small backward-compatible shared tweaks: `ListToolbar` got `searchLabel` and a per-filter `allLabel` (null = no "All" option, used for Period); `StatusBadge` got the donation statuses; `localizedPageMetadata` got `noindex`.
- Legal: `privacy.ts` / `terms.ts` already describe exactly what is stored (amount, currency, frequency, status, Stripe references, optional email, never card numbers) and the refund contact. No change; `legal.test.ts` is green.
- Phase 9 note: if the CSP sets `form-action`, it must include `https://checkout.stripe.com` (server-action redirect) and `https://billing.stripe.com`.

## Notes for the user

- Restart `npm run dev` (new dependency + Prisma client). Nothing was listening on :3000 during this step.
- Create a Stripe account in test mode, then set `STRIPE_SECRET_KEY`, the webhook and `STRIPE_WEBHOOK_SECRET` (README › Setting up Stripe). Turn on Stripe's receipt emails.
- Write "How gifts are used" in Settings, get the tax status confirmed before ticking the box, and decide a refund policy for the Terms.
- Known limitations: USD and cards only; UTC totals; refunds only in the Stripe Dashboard; the thank-you page doesn't confirm the specific payment; monthly gifts are managed via the portal link or by email.
