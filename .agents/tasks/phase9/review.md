# Branding polish, security headers and deployment guide (Phase 9)

Phase 9 makes the app icons and default Open Graph image from the user's logo, puts that logo in the footer, on the admin login and in the admin shell, and pins the admin Log out button so it stays on screen on short laptops. Every route now gets security headers from one pure builder (`src/lib/security/headers.ts`). The CSP is an allow-list without nonces, so the public pages can stay static. It also brings in the Phase 8 carry-over (giving opens only once the webhook secret is set), an exact npm override that clears the only audit advisory, an authz audit table, and a deployment guide in the README written for a non-technical owner. The evidence is complete: 1004 unit/db tests and 400 E2E tests pass, axe reports 193 runs with no serious or critical findings, the curl header captures are recorded, and I opened all 16 screenshots myself.

Watch for: two words in the README's "Known limitations (Phase 9)" are broken by PowerShell escape characters (confirmed). The admin CSP's Vercel Blob `connect-src` has only been checked against the library source, never against a real upload (likely fine, untested).

**Verdict**: APPROVED

## High-level view

The brand assets come from a committed, deterministic sharp script, and its PNG output is committed too. The screenshots show the real mark at 256, 32 and 180 px on ivory, with no black corners on the apple icon. The OG image is the full logo on ivory with a gold bar, so no text was invented. `SiteLogo` is shared by the footer, admin login and admin shell, and falls back to the built-in SVG for unsafe or empty URLs. The public header is byte-identical, and its screenshot matches the user's layout: logo and name at the far left, nav in the centre, gold CTA on the right.

The CSP has three areas. The site area allows Turnstile as the only third-party script, and only Turnstile and youtube-nocookie frames. The admin area has no third-party script, `frame-src 'none'`, and allows connections to `vercel.com` for Blob client uploads. Uploads get `default-src 'none'; sandbox`. In production, `'unsafe-eval'` is never sent. The E2E collector caught a real violation (Zod 4's JIT probe), which `jitless` now fixes. HSTS (no preload), Referrer-Policy, Permissions-Policy, nosniff and XFO DENY come from the `/:path*` rule, so API, admin and upload responses get them too. The curl output confirms this.

The authz table lists 55 server actions, 8 route methods and 30 admin pages. I recounted the exports per file and checked the page guards with grep, and the numbers match. The `[id]` detail pages call `requireAdminPage` as well as `notFound`. The README guide covers every service the brief names, including a separate live webhook secret, a renamed new authenticator entry for production, backups with an honest note about `pg_dump`, and the full go-live checklist. `.env.example` lists every variable and holds only local values.

<details>
<summary>Issues (2)</summary>

1. **README escape-character corruption** (LOW, confirmed): in "Known limitations (Phase 9)", `` `favicon.ico` `` became `<FF>avicon.ico` and `` `vercel.live` `` became `<VT>ercel.live`. PowerShell turned the backtick-f and backtick-v into control characters. Restore both words with their backticks.
2. **Blob upload CSP not exercised end to end** (LOW, likely fine): the admin `connect-src 'self' https://vercel.com` is based on reading `@vercel/blob/dist` (only `https://vercel.com/api/blob` appears there). No upload has gone through the Blob driver in a browser under this CSP. After step 6 of the guide, do one real upload and check the console, or add that to the go-live checklist.

</details>

<details>
<summary>Details</summary>

### CSP allow-list vs nonces

```
/:path*            site CSP + HSTS + Referrer + Permissions + nosniff + XFO
/admin, /admin/*,  admin CSP (no 3rd-party script, frame-src 'none',
/api/admin/*,       connect-src 'self' https://vercel.com, form-action 'self'),
/api/auth/*         Referrer same-origin, no-store, noindex
/api/stripe/*      no-store, noindex (site CSP stays)
/api/uploads/*     default-src 'none'; sandbox; frame-ancestors 'none'
```

Next applies the last matching rule for each key, and the curl captures confirm that each area gets its own CSP while keeping the site-wide headers. The uploads route sets the same string itself, and a unit test reads the route file so the two can't drift. `'unsafe-inline'` scripts are a deliberate trade-off that keeps pages static. The README explains it and gives the nonce upgrade path. `img-src https:` is wide because owners may paste any https image. Images can't run code, so this is acceptable.

Stripe Checkout works through a server-action redirect (a navigation, which CSP doesn't limit) and through the no-JS form post, which `form-action` allows. The `donations-checkout` E2E spec on the :3211 server runs under the same config. The Zod `jitless` fix is imported by `common`, `public-forms` and `donations`. Every other validation module that reaches the browser goes through `common`, so client bundles never run the probe.

The second issue sits here. On Vercel, the admin CSP only allows connections to `vercel.com` for uploads. That matches the library source, but no test uploads through the Blob driver under this CSP, because the user has no token yet.

### Log out pinned in the sidebar

The aside now has three rows: brand and session, a scrolling nav, and a pinned `LogoutButton`. The mobile dialog has the same structure. In the 1280×650 screenshots, Log out sits under a divider both before and after the nav is scrolled. The 375×650 menu also shows it pinned. Moving the button out of `<nav>` changed the logout spec's locator to `complementary`. The click and the assertions are the same.

### Giving now needs the webhook secret

`resolveGivingState` now depends on `webhookReady` in both the Support page and `runCheckoutStart`, so a direct post can't get past the closed form. The admin Donations page explains why giving is still closed. The user has no keys yet, so nothing they see changes today.

### Deployment guide and env documentation

Steps 0–12 say what to click and what should appear. Step 4 correctly warns that `admin:create-owner` against Neon creates a second entry with the same "Demo Ministry Admin" label (the issuer comes from the ministry name stored in the database), and says to rename it. The guide also notes that `TOTP_ENCRYPTION_KEY` must never change. The npm override is an exact pin within the same major, and both audit runs now report 0 vulnerabilities. The first issue is in this README: the two corrupted words.

### Test coverage

There are new unit tests for the header builder, the brand assets (byte-identical when regenerated), `SiteLogo` URL refusal, the default OG image, the env and secret rules, and Zod jitless mode. New E2E specs check headers and CSP violations on each kind of page (lightbox, YouTube iframe, Turnstile), and run axe with Lighthouse-style checks on 16 public pages × 2 locales × 2 widths and on every admin page and dialog. Not tested: a real Vercel Blob upload under the admin CSP, and a real (non-stubbed) Turnstile widget under the site CSP. Both need third-party keys.

</details>

<details>
<summary>File map</summary>

- `src/lib/security/headers.ts` (+test), `next.config.ts`: header and CSP builder; config uses it
- `src/app/api/uploads/[...key]/route.ts`: `frame-ancestors 'none'` added to its CSP
- `scripts/generate-brand-assets.ts` (+test), `src/app/icon.png`, `apple-icon.png`, `public/brand/og-default.png`; `src/app/icon.svg` deleted
- `src/components/brand/SiteLogo.tsx` (+test), `Logo.tsx` (comment), `layout/Footer.tsx`, `admin/login/page.tsx`, `admin/(dashboard)/layout.tsx`, `AdminShell.tsx`: logo with fallback
- `src/components/admin/LogoutButton.tsx`, `AdminNav.tsx`, `AdminMobileNav.tsx`: pinned Log out
- `src/lib/og-image.ts`, `src/lib/metadata.ts` (+test): default OG image, `summary_large_image`
- `src/lib/validation/zod-setup.ts` (+test), `common.ts`, `public-forms.ts`, `donations.ts`: jitless Zod
- `src/lib/donations/giving-state.ts` (+test), `support/page.tsx`, `server/donations/checkout.ts` (+db test), `admin/(dashboard)/donations/page.tsx`: webhookReady gating
- `src/components/admin/ListToolbar.tsx`: search field min-width
- `package.json`, `package-lock.json`: `sharp` devDependency, `brand:generate`, zod override
- `README.md`, `.env.example`, `scripts/assert-local-db.ts`: deployment guide, env documentation
- `src/test/env-and-secrets.test.ts`, `src/test/script-imports.test.ts`: secret and env checks, pure modules
- `e2e/*` (security-headers, branding, phase9 public/admin sweeps, admin-sidebar, admin-branding, screenshots, helpers), `playwright.config.ts`, `admin-access.spec.ts`, `admin-logout.spec.ts`

Full diff: `git -C "c:/Users/rasaily/Downloads/mission app" diff` plus the untracked files.

</details>
