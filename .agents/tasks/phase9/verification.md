# Phase 9 verification (branding polish, hardening, deployment readiness)

Work done on `master`, **not committed** (the finalize step commits after approval). `src/app/icon.svg` was removed with `git rm` (staged deletion); everything else is unstaged.

## What changed
- **Brand assets**: `scripts/generate-brand-assets.ts` (`npm run brand:generate`, sharp `0.35.5` pinned as an exact devDependency, the same version Next already ships) generates `src/app/icon.png` (512, ivory), `src/app/apple-icon.png` (180, opaque) and `public/brand/og-default.png` (1200×630, full logo on ivory with a gold bar). The output is deterministic and committed. `src/app/icon.svg` deleted.
- **Logo**: a new `SiteLogo` component (Settings `logoUrl`, falls back to the built-in mark, refuses non-`/` and non-`https://` URLs) is used in the footer (`h-12`, previously squashed to `size-10`), on the admin login page and in the admin sidebar and mobile top bar. **The public header is untouched.**
- **Default OG image**: `buildPageMetadata` uses the page's own cover image, else `/brand/og-default.png` (1200×630, alt = site name). The Twitter card is always `summary_large_image`.
- **Admin sidebar NIT**: the `<aside>` now has 3 rows (brand + session / a scrolling nav with `data-testid="admin-sidebar-scroll"` / a pinned `LogoutButton`). The mobile admin dialog uses the same structure.
- **Security headers**: `src/lib/security/headers.ts` (pure, unit-tested) is used by `next.config.ts`. It sends CSP, HSTS (no preload), Referrer-Policy, Permissions-Policy, nosniff and XFO DENY plus `frame-ancestors 'none'` on every route. Admin, auth and admin-API routes get an admin CSP (no third-party script, `frame-src 'none'`, `connect-src https://vercel.com`). Uploads get `default-src 'none'; sandbox; frame-ancestors 'none'` (the route's own header was updated to the same value, and a test keeps them equal). The policy is a strict allow-list without nonces, to keep static pages (rationale and upgrade path are in README › Security notes).
- **Zod CSP fix** (found by the E2E CSP collector): Zod 4's `new Function("")` JIT probe was reported as a `script-src` "eval" violation on the form pages. The new `src/lib/validation/zod-setup.ts` sets `z.config({ jitless: true })` and is imported by `common`, `public-forms` and `donations`. Parse results are identical; it only skips the probe (Zod's own source comment describes exactly this case).
- **Phase 8 carry-overs**: `resolveGivingState` now requires `webhookReady` (secret key **and** `whsec_` secret), on both the Support page and `runCheckoutStart`. The admin Donations status says "Online giving stays closed until the webhook signing secret is set" when the key is set but the secret isn't. The ListToolbar search field has `md:min-w-[14rem]`. *User-visible effect:* with a secret key but no webhook secret, the Support page now shows "not set up yet" instead of a form that could charge gifts the site can't record. The user has no Stripe keys yet, so nothing they see today changes. This decision came from the approved plan (Phase 8 review LOW #1) and the standing directive.
- **npm audit**: an exact override `"@vercel/cli-config": { "zod": "4.6.7" }` takes it from 4 high to 0 (see `npm-audit.md`).
- **Authz audit**: `authz-audit.md`. 55 server actions, 8 route-handler methods and 30 admin pages were read one by one. **No gaps**, so no code change.
- **README**: new "Going live: step-by-step deployment guide" (steps 0–12: Neon, Vercel, env vars table, prepare the production DB with a **new authenticator entry**, smoke test, Vercel Blob, Resend with DNS verification, Turnstile, Stripe test→live with a separate live webhook secret, custom domain + HSTS, backups (no bundled `pg_dump.exe`, so it says to install the PG 17 client tools), go-live checklist). It replaces "Switching to Neon", the four "Setting up …" sections and the old checklist (anchors kept as step headings). Also updated: env-var tables (scripts-only block), Security notes (the actual policy), Roadmap 9 ✅, Phase status, Scripts (`brand:generate`), and new "Known limitations (Phase 9)". `.env.example` documents every variable (where to get it, which Vercel environments, required or not; no real values). `scripts/assert-local-db.ts` now points to "Going live (step 4)".

## 1. Static checks (all exit 0)
- `npm run lint`: 0
- `npm run typecheck`: 0
- `npm run format:check`: 0 ("All matched files use Prettier code style!")
- `npm run build`: 0. The route list includes `○ /apple-icon.png` and `○ /icon.png` (`build.log`).

## 2. `npm test`
**97 files / 1004 tests passed** (Phase 8 baseline 91 / 945). Log: `npm-test.log`.

New test files (6):
- `scripts/generate-brand-assets.test.ts`: sizes, PNG format, apple-icon has no alpha, icon.svg gone, regeneration byte-identical
- `src/components/brand/SiteLogo.test.tsx`: img vs fallback, unsafe URLs refused
- `src/lib/metadata.test.ts`: default OG image, cover image wins, canonical/hreflang unchanged
- `src/lib/security/headers.test.ts`: **security headers/CSP**. Every directive per area; dev-only eval/ws; upgrade only on https; script-src host allow-list; frame-src exactly Turnstile + youtube-nocookie; Stripe form-action; admin `connect-src https://vercel.com`; uploads CSP equals the route's string; rule order and exact header values
- `src/test/env-and-secrets.test.ts`: the only `NEXT_PUBLIC_` is the site URL; every env var the code reads is in `.env.example`; `.env.example` sets only the local URL and DB; no real-looking keys in tracked or new files; `.env` untracked
- `src/lib/validation/zod-setup.test.ts`: jitless after importing each client-side validation module

Extended:
- `src/server/donations/checkout.db.test.ts`: a key without a webhook secret gives NOT_AVAILABLE with no Stripe call
- `src/lib/donations/giving-state.test.ts`: webhookReady cases
- `script-imports.test.ts`: 4 new pure modules

**Rewritten tests (behaviour changed on purpose):**
- `giving-state.test.ts`: the table is now keyed on `webhookReady` instead of `checkoutReady` (LOW #1).
- `checkout.db.test.ts`: `TEST_ENV` and the live-key override case now include `STRIPE_WEBHOOK_SECRET`, because giving needs it.
- `e2e/admin-access.spec.ts`: `EXACT_HEADERS` now holds the full admin CSP, HSTS and the wider Permissions-Policy. "public pages get the site-wide headers only" now expects XFO `DENY` and the site CSP (it previously expected no XFO).
- `e2e/admin-logout.spec.ts`: the Log out button is looked up in the sidebar (`complementary`) instead of inside `navigation "Admin"`, because it moved out of the `<nav>` to be pinned. Same click, same assertions.

## 3. `npm run test:e2e`
**400 passed, 0 failed, 0 flaky** (Phase 8 baseline 282). Log: `e2e.log`, 7.7 min.

New specs:
- `security-headers.spec.ts` (public): headers on `/en`, `/ne/devotionals`, `/en/support`, the 404, `robots.txt`, `sitemap.xml`, `/icon.png`, `/brand/og-default.png`, webhook POST 503, `/admin/login`, the `/admin` 307, `/api/auth/session`, uploads 404. It also checks for **no CSP violations and no console errors** on home en/ne, a devotional detail, the mission detail with the lightbox open, media after the YouTube facade loads its iframe (nocookie URL, frame loaded), prayer/contact with Turnstile, support and admin login.
- `branding.spec.ts` (public): icon links in `<head>` on public + admin, PNG responses, `/icon.svg` 404, `og:image` / width / height / `twitter:card` / `twitter:image`, fallback mark with no logo.
- `phase9-public-sweep.spec.ts` (public): 16 pages × en/ne × 1280/375 = 64 tests. Each runs axe, CSP, console and the Lighthouse-style checks. Plus the perf snapshot.
- `admin-sidebar.spec.ts` (admin-readonly): Log out in the viewport with `scrollY 0` at 1280×650 and 1280×600 (owner `/admin` + `/admin/settings`, editor `/admin`); the nav region scrolls with Account and Log out in view; Tab from Account goes to Log out; the 375×650 mobile menu.
- `admin-branding.spec.ts` (admin-mutations): with the logo set in Settings, the `/en` and `/ne` footer image is ≥ 40 px tall with aspect > 1.8, the signed-out login logo is ≥ 48 px, and the sidebar logo shows. The logo is restored to empty afterwards.
- `phase9-admin-sweep.spec.ts` (admin-mutations): axe + CSP + console errors on login (signed out, 1280/375); 15 list pages at 1280 and 375; 5 `/new` pages; 8 detail pages (posts, categories, verses, events, media, galleries, prayer, messages); the admin 404; the media-picker dialog, delete ConfirmDialog and mobile menu; editor dashboard, forbidden and inbox at 1280/375.
- `phase9-screenshots.spec.ts` (admin-mutations): see section 4.

axe summary: **193 `[axe]` lines, every one with `serious/critical=0`**. By group: public `/en` 61, public `/ne` 58 (the Phase 9 sweep alone covers 64 = every public page × both locales × both widths), admin 72 (every admin page plus open dialogs, owner and editor), and 2 on the :3211 donation server.

Two problems found and fixed during the runs: (a) Zod's eval probe (the CSP fix above, a real issue found by the new collector); (b) bugs in my own specs: `browser.newContext()` inherits `test.use({ storageState })`, list rows stream in through Suspense, and `setContent` can't run on top of the image viewer. All fixed. The final run is fully green.

## 4. Screenshots (`.agents/screenshots/phase9/`, all opened and checked)
- `home-en-1280.png`: navy/ivory/beige/gold. The header is identical to before (logo + name far left, nav + switcher centre, gold CTA right). The footer now shows the real logo mark at a legible size; demo badges are present; no overflow.
- `home-en-375.png`, `home-ne-375.png`, `home-ne-1280.png`: Devanagari renders throughout; no horizontal overflow (asserted); the footer logo is crisp.
- `footer-en-1280.png`: logo (~100×48, aspect kept) + "Demo Ministry", the Explore/Contact/Follow columns, and the legal row. Polished.
- `footer-en-375.png`, `footer-ne-375.png`, `footer-ne-1280.png`: stacked layout; Nepali headings render correctly; the logo isn't squashed. The first capture had the sticky header stitched over the tall footer (a screenshot artifact), so I switched to a clip of a full-page capture and re-checked: clean.
- `header-unchanged-en-1280.png`: the same layout and spacing as Phase 8's header; `git diff` on Header/MobileMenu/DesktopNav/LanguageSwitcher is empty.
- `admin-login-1280.png`, `admin-login-375.png`: the logo is centred above "Demo Ministry Admin", then the gold rule and "Sign in". Fits at 375.
- `admin-dashboard-1280x650.png`: Log out is pinned at the bottom of the sidebar with an icon above a divider; the nav is cut off at "Prayer requests" and scrolls.
- `admin-sidebar-scrolled-1280x650.png`: the nav is scrolled to Owner / You › Account, and Log out stays pinned.
- `admin-mobile-menu-375x650.png`: the dialog nav scrolls and Log out is pinned at the bottom.
- `og-default.png`: the full logo (cross, Bible, hands, "Bible Distribution / MINISTRY / Estd. 2025") centred on ivory with a gold bottom bar. Nothing invented.
- `brand-assets.png`: icon.png at 256/32/16 and apple-icon at 180, on white and on navy-deep. The ivory square keeps the dark Bible visible on navy; recognisable at 32; at 16 it's a small blob (expected for a wide mark); no black corners on apple-icon. The first version showed broken images (it was rendered from about:blank); fixed and re-checked.

## 5. Headers (`headers-curl.txt`; `next start -p 3299`, only that process was stopped)
- `/en`: the site CSP (Turnstile script/frame/connect, youtube-nocookie frame, Stripe form-action, no eval, no upgrade on http), HSTS `max-age=63072000; includeSubDomains`, `strict-origin-when-cross-origin`, Permissions-Policy, nosniff, XFO DENY.
- `/admin/login`: the admin CSP (`connect-src 'self' https://vercel.com; frame-src 'none'; form-action 'self'`), `same-origin`, `noindex, nofollow`, `no-store`, plus HSTS, Permissions-Policy and XFO.
- `/api/uploads/x/y.png` (404): `default-src 'none'; sandbox; frame-ancestors 'none'` plus the site-wide headers.

## 6. Authz audit
See `authz-audit.md`: 55 actions, 8 route methods and 30 pages; **0 gaps**.

## 7. npm audit
Before: 4 high (one advisory, GHSA-mrhx-c7xc-m3w5, zod 4.1.11 under `@vercel/blob → @vercel/oidc → @vercel/cli-config`), with no upstream fix. After the exact override to zod 4.6.7: `npm audit --omit=dev` and the full `npm audit` both report **0 vulnerabilities**. All unit/db and E2E tests (including Blob driver and upload specs) pass. See `npm-audit.md`.

## 8. Lighthouse-style
Chrome Lighthouse is not installed and wasn't added (large dependency tree). The public sweep instead asserts the Lighthouse SEO and best-practice items on all 64 page/locale/width combinations: one h1, title, description, `html[lang]`, viewport, canonical + en/ne/x-default hreflang, `og:image` (noindex pages must carry `robots noindex` instead), every `<img>` has `alt`, zero console errors, zero CSP violations, and no overflow at 375. All pass.

`perf.json` (local `next start`, Desktop Chrome at 375, no throttling, informational):

| Page | TTFB | FCP | Load | Scripts | Script bytes |
|---|---|---|---|---|---|
| `/en` | ~8 ms | ~272 ms | ~161 ms | 10 | ~181 KB |
| `/ne` | ~109 ms | ~508 ms | ~746 ms | 10 | ~178 KB |

`/ne` loads the Devanagari font, so it transfers ~608 KB in total vs ~306 KB for `/en`. Values vary per run.

## 9. Greps (tracked + new files, excluding `.agents/`, `.vscode/`, binaries, lockfile)
- `S3|AWS|Amazon|Cognito|SES`: only `src/content/legal/legal.test.ts` (its negative assertion "no AWS service"). The README wording was changed so it no longer names it.
- `NEXT_PUBLIC_`: only `NEXT_PUBLIC_SITE_URL`.
- Real-looking keys (`sk_/rk_live|test` long, long `whsec_`, long `re_`, `vercel_blob_rw_` long, private keys): none.
- `tax-deductible | 501(c) | registered charity`: only the Phase 8 places (donation-wording + its tests, support-view test, legal test, messages test, Phase 8 E2E specs), plus one README checklist line ("until then the site says gifts are not tax-deductible").
- `git ls-files .env`: empty. `git check-ignore .env .local/x`: both ignored.

## 10. Header untouched
`git diff --stat -- src/components/layout/Header.tsx src/components/layout/MobileMenu.tsx src/components/layout/DesktopNav.tsx src/components/layout/LanguageSwitcher.tsx` is empty.

## 11. mission_dev (read-only; `dev-db-check.txt`)
- The URL was asserted to contain `/mission_dev`. Values: owners 1, ministryName "Bible Distribution Ministry", logoUrl "/brand/logo-mark.png", donationsEnabled false, taxDeductibleVerified false.
- Row counts: Post 6, Event 4, MediaItem 3, PrayerRequest 0, ContactMessage 0, Gallery 0, Donation 0, StripeEvent 0. Identical to Phase 8.
- `npx prisma migrate status`: 5 migrations, "Database schema is up to date!". Phase 9 added no migration.
- No reset or seed was run. Port 3000 was never touched; Postgres was left running.

## 12. Notes for the user
- Restart `npm run dev` to pick up the new headers and icons, and hard-refresh the browser to see the new favicon.
- The deployment guide is in README › "Going live". Still to do, all yours: create the Neon, Vercel, Blob, Resend, Turnstile and Stripe accounts and keys; legal review of the Privacy Policy and Terms; tax status; refund policy; replace the demo content; native-speaker review of the Nepali.
- Known limitations: `'unsafe-inline'` scripts (no nonces); no `favicon.ico`; the Vercel preview toolbar is blocked; no CI Lighthouse; donation totals mix test and live unless filtered; a refund that arrives before its gift isn't linked to it.
