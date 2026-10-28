# Stripe donations: Support giving form, signed webhook ledger, owner-only donations admin

Phase 8 turns the placeholder Support page into a giving page. The page has preset and custom USD amounts and a one-time/monthly choice. A server action validates the amount and redirects to Stripe Checkout, using `payment` mode for one-time gifts and `subscription` mode for monthly ones. A Stripe webhook verifies the signature over the raw body and records gifts in a new `Donation`/`DonationSubscription` ledger, with a `StripeEvent` table for idempotency. A new owner-only admin page shows the gifts with filters, totals for the period, a CSV export and the Stripe configuration status. The review covered the uncommitted working tree against the Phase 8 brief and plan, the evidence in `verification.md`, and the 22 screenshots, which I opened and checked. I ran one spot-check: `allowed_payment_method_types` does exist on `SessionCreateParams` in the installed `stripe@23.0.1`.

Watch for: online giving opens as soon as a secret key is set, even when no webhook signing secret is set, so gifts can be charged without being recorded (confirmed). The admin totals mix test-mode and live-mode gifts unless the Mode filter is used (confirmed). A refund that arrives before its gift is recorded is dropped for good (likely). None of these blocks the phase.

**Verdict**: APPROVED

## High-level view

The payment flow keeps card data entirely on Stripe's side. There is no Stripe.js and no publishable key. The server action runs the honeypot check, then Zod validation, then the giving-state check, then a rate limit on the hashed IP, then `checkout.sessions.create`. It redirects only to `https://checkout.stripe.com/`. The amount is computed on the server from a preset choice or a parsed custom string, using integer cents within $5 to $10,000. Session parameters are always USD and card-only. One-time gifts use `submit_type=donate`. Monthly gifts use `recurring.interval=month` and copy the metadata onto the subscription, which is how `invoice.paid` recognises its own invoices.

The webhook reads the body as bytes with a 1 MiB cap and passes it to `constructEvent` as a Buffer. It returns 503 when not configured, 400 on a bad signature, 413 when the body is too large, 500 on failure (so Stripe retries) and 200 otherwise. It is outside the locale proxy matcher (`/api` is skipped) and has no session or origin check, which is correct for this route. Inside one transaction the ledger row is created first, so a concurrent duplicate blocks on the primary key and is then reported as a duplicate. Every write is an upsert on a unique Stripe id, so an event re-sent under a new id cannot double-count. Status mapping: a paid payment-mode session becomes a `ONE_TIME` row with status `PAID`. A subscription-mode session becomes an `ACTIVE` subscription with no donation row, and each month's gift, including the first, comes from `invoice.paid`. `charge.refunded` raises the refunded total to the maximum seen so far and sets `PARTIALLY_REFUNDED` or `REFUNDED`. `customer.subscription.deleted` sets the subscription to `CANCELED`. Foreign objects (`metadata.app` not ours) and non-USD amounts are ignored.

Access is OWNER only, and that decision is recorded in `verification.md` and the README. The page uses `requireOwnerPage`. The export uses a new `role: "OWNER"` option on `requireAdminRoute` and returns 403 to editors, and guard-coverage tests check it. The CSV quotes every cell and puts `'` before cells that start with `= + - @ TAB CR`. The export is audit-logged with filters and a row count but no emails.

The tax wording comes only from `donation-wording.ts`. Unverified: "Gifts are not tax-deductible." Verified: "Gifts may be tax-deductible; consult your tax advisor. Stripe emails a receipt for each gift." The text is the same on the Support, thank-you and Terms pages. The not-configured and closed states show no tax text at all. No charitable or 501(c) claim appears, and "How gifts are used" is clearly marked demo text until the owner writes it. `donationsEnabled` and the key state are checked again in the action, so a hidden form cannot be bypassed by posting to it directly.

Evidence is complete. Lint, typecheck, format and build exit 0. 945 unit/db tests and 282 E2E tests pass. Signature tests use `generateTestHeaderString` on fixture events. There are tests for each handled event type, three concurrent deliveries, rollback, and the absence of card data. Checkout session creation is mocked in E2E. The only `NEXT_PUBLIC_` variable is `NEXT_PUBLIC_SITE_URL`. `stripe` is pinned exactly to `23.0.1`. The migration is additive only, and the `mission_dev` checks show the owner and settings unchanged.

<details>
<summary>Issues (4)</summary>

1. **Giving opens without a webhook secret** (LOW, confirmed): `resolveGivingState` uses `checkoutReady` (secret key only), not `webhookReady`. Gate the open state on `webhookReady`, or at least show a warning on the Donations page when the key is set but the signing secret is not.
2. **Test and live totals mixed by default** (LOW, confirmed): with Mode set to "All", gross, net and counts include test-mode gifts once the site is live. Default the Mode filter to `live` when a live key is set, or label the totals as "including test gifts".
3. **Early refund dropped permanently** (LOW, likely): an unmatched `charge.refunded` is stored as `ignored`, so Stripe never redelivers it. If the gift is recorded later, or its invoice payment intent lookup returned null, the refund never appears. Consider re-checking the charge's payment intent metadata and returning 500 for refunds of our own gifts that are not recorded yet.
4. **Narrow donor-email search box at 1280** (LOW, confirmed, cosmetic): with four filters, the shared `ListToolbar` squeezes the search input to about 80 px. Give the search field a minimum width.

</details>

<details><summary>Details</summary>

### Checkout gating vs webhook readiness

`resolveStripeConfig` defines `checkoutReady` as "a test or live secret key" and `webhookReady` as "checkoutReady plus a `whsec_` secret". The Support page and `runCheckoutStart` both use `checkoutReady`. If an owner follows the README only up to step 2 and turns on "Donations are enabled", donors can pay through Stripe, but the webhook returns 503 and nothing is recorded. If no endpoint is registered in Stripe at all, those events are never redelivered, so the gifts never reach the local ledger and the admin page shows "No gifts recorded yet" while Stripe holds the money. The admin page does show "Webhook signing secret: Not set", but nothing connects that status to the missing records. Gating on `webhookReady` would close the gap at almost no cost.

### Refund and subscription event ordering

`chargeRefunded` finds the gift by `stripePaymentIntentId`. When no row matches, it logs `refund_unmatched` and returns `ignored`, and that outcome is written to the ledger, so a redelivery is treated as a duplicate. The window is narrow, because a refund normally comes long after the checkout event. Two paths are realistic, though. One: the checkout or invoice event is still in Stripe's retry backoff after a 500 when the owner issues the refund. Two: for monthly gifts, `invoicePayments.list` returned no payment intent, so the row was stored with a null PI and can never match a refund.

There is a related race that fixes itself. A subscription's `checkout.session.completed` and the first `invoice.paid` usually arrive at almost the same moment, and both upsert `DonationSubscription` on `stripeSubscriptionId`. If Prisma does not run the upsert as a native `ON CONFLICT`, one of them can hit P2002. That event id has no ledger row, so it is rethrown as a 500 and the retry succeeds. That path is correct; the only effect is a noisy error log.

### Admin totals and live/test separation

`donationWhere` adds the `livemode` filter only when `mode` is set, and the Mode filter defaults to "All". The rows carry a Test badge, but the totals cards do not say which mode they include. After the switch to live mode, which the README describes as "Test-mode gifts stay marked Test", the default view will add test gifts to the real gross and net. Refunds are counted in the period of the gift's `paidAt`, not the refund date, which is a reasonable reading of "totals for the selected period". This is not documented.

### Screenshots

I opened `support-open-en-1280`, `support-not-configured-en-1280`, `support-open-ne-375`, `support-open-other-amount-error-en-375`, `support-open-verified-wording-en-1280`, `support-thank-you-ne-375`, `support-cancelled-ne-1280`, `admin-donations-1280`, `admin-donations-375` and `admin-settings-donations-1280`. The header is unchanged: logo and name at the far left, nav in the centre, the gold CTA on the right. The pages use the navy, ivory and gold palette, and Devanagari renders correctly. At 375 nothing overflows: long emails and the webhook URL wrap inside their cards. The error state shows the alert, the red-bordered input and an inline message. The unverified and verified tax lines match the brief word for word. The demo badge appears on "How gifts are used". On the admin page the formula-like email shows as plain text, totals are in exact cents, and "Partially refunded" sits next to "Refunded $15.00". The only visual issue is the narrow donor-email input at 1280.

</details>

<details>
<summary>File map</summary>

- `src/app/api/stripe/webhook/route.ts`: bounded raw-body reader, signature verification, status codes
- `src/server/donations/webhook.ts`: `verifyStripeEvent`, ledger-first transaction, four handlers, invoice PI lookup
- `src/server/donations/checkout.ts`, `src/server/actions/public-donations.ts`: checkout pipeline and public action
- `src/server/donations/stripe-client.ts`: memoized Stripe client, loopback override for tests only
- `src/lib/donations/*`: amount parsing/limits, checkout params, CSV encoding, giving state, periods, Stripe config, support view model
- `src/lib/validation/donations.ts`: checkout schema and admin list filters
- `src/lib/donation-wording.ts`: tax note and disclosure helper
- `src/app/[locale]/support/{page,thank-you/page,cancelled/page}.tsx`, `src/components/public/DonationForm.tsx`: public UI
- `src/app/admin/(dashboard)/donations/page.tsx`, `src/app/api/admin/donations/export/route.ts`, `src/server/services/donations.ts`: owner-only admin and CSV
- `src/server/auth/route-guard.ts`: `role: "OWNER"` option
- `prisma/schema.prisma`, `prisma/migrations/20261028134952_phase8_donations/`: Donation, DonationSubscription, StripeEvent, givingInfo columns, `FormKind.DONATION`
- Settings page/validation, admin nav, ListToolbar/StatusBadge/labels, metadata `noindex`, messages en/ne, README, `.env.example`, `next.config.ts` headers, `package.json` (`stripe` 23.0.1)
- Tests: 15 new files plus extended guard/structure/wording tests; E2E `support`, `donation-access`, `donations-checkout`, `phase8-screenshots` with a mock Stripe server
- Full diff: `git -C "c:/Users/rasaily/Downloads/mission app" diff` plus the untracked files

</details>
