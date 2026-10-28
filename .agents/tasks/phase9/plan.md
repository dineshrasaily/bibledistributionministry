# Phase 9 implementation plan: branding polish, hardening, deployment readiness

Scope (from `.agents/tasks/remaining-phases-brief.md` › Phase 9, nothing more):
- App icons from the user's logo (`src/app/icon.png`, `src/app/apple-icon.png`, generated with sharp from `public/brand/logo-mark.png`; delete the placeholder `src/app/icon.svg`), the logo on the admin login page and in the footer (from `SiteSettings.logoUrl` with a fallback), and a default Open Graph image built from the logo.
- Review NIT: the admin sidebar's **Log out** must be reachable without scrolling at small laptop heights (1280×650).
- Security headers on **all** routes: Content-Security-Policy, HSTS, Referrer-Policy, Permissions-Policy, X-Content-Type-Options, frame-ancestors (plus X-Frame-Options).
- Authz re-audit (table), `npm audit` report (fix only with pinned safe upgrades), no `NEXT_PUBLIC_` secrets.
- Full a11y pass (axe on every public page in en + ne and every admin page) plus Lighthouse-style checks.
- README deployment guide for a non-technical owner, and `.env.example` documenting every variable with no real values.

Root: `c:\Users\rasaily\Downloads\mission app` (contains a space: quote every path; use `-LiteralPath` for paths with `[locale]`). Windows + PowerShell. Work on `master`, no worktree. **Do not commit.** The finalize step makes the one Phase 9 commit after review approval. Never push.

Baselines (from `.agents/tasks/phase8/verification.md`): `npm test` = 91 files / 945 tests, `npm run test:e2e` = 282 passed. Both stay green, plus the new tests below. Every existing test whose expectation changes because behaviour changed (the admin/public header assertions in `e2e/admin-access.spec.ts`, the giving-state cases) is listed in verification.md under "Rewritten tests" with the reason. Never delete a test silently.

## Ground rules (from the brief and the code I read)

- **mission_dev holds the user's real data.** Phase 9 needs **no schema change and no migration**. Never run `db:reset`, `db:seed`, `prisma migrate reset`, `prisma db push` or TRUNCATE against it. Vitest uses `mission_unit`, Playwright uses `mission_test`. Don't stop Postgres unless you started it; don't kill the user's `npm run dev` on :3000. Never run `npm test` and `npm run test:e2e` at the same time.
- **The public header is NOT changed**: `src/components/layout/Header.tsx`, `MobileMenu.tsx`, `DesktopNav.tsx`, `LanguageSwitcher.tsx` stay byte-identical (`git diff --stat` on them must be empty at the end).
- Admin mutations still go through `runAdminAction`; admin route handlers through `requireAdminRoute`. Pure modules (no `server-only`, no `@/lib/db`) are added to `PURE_MODULES` in `src/test/script-imports.test.ts`.
- `messages/en.json` / `ne.json` keep identical keys. Phase 9 should need no new public strings; if one is added, add it to both and extend the ne `_note` with "Phase 9 strings added; review with the rest."
- No AWS anywhere. No invented ministry facts. Pin every dependency exactly (`.npmrc` has `save-exact=true`).
- The search tool can't index this path (space in it). Use `git grep` / `Select-String` in PowerShell for searches.

## Decisions (made per the standing directive, with rationale)

1. **Icons: generated once by a committed script, outputs committed.** New `scripts/generate-brand-assets.ts` (npm script `brand:generate`) uses sharp. `public/brand/logo-mark.png` is 241×112 (wide: cross, Bible held by two hands, swoosh), so it is centred with `fit: "contain"` on a square:
   - `src/app/icon.png`: 512×512, ivory `#FBF8F3` background, mark scaled to 88% of the width (≈16 px padding per side at 512). Ivory rather than transparent so the dark Bible and navy stay visible on dark browser tabs.
   - `src/app/apple-icon.png`: 180×180, same ivory, **opaque** (`.flatten()`, no alpha: iOS fills transparency with black), mark at 84% width.
   - `public/brand/og-default.png`: 1200×630, ivory background, a 6 px gold `#B8924A` bar at the bottom, `public/brand/logo-full.png` (612×408, it carries the text "Bible Distribution Ministry / MINISTRY / Estd. 2025") centred at height 460 px. Using the full logo means no text has to be rendered by us (no font or Devanagari issues) and nothing is invented.
   - Output is deterministic (`png({ compressionLevel: 9, palette: false })`, no metadata). Committing the PNGs means `npm run build` and Vercel never need to run the script.
   - Delete `src/app/icon.svg`. Next's file convention at the app root then emits `<link rel="icon" href="/icon.png?…" type="image/png" sizes="512x512">` and `<link rel="apple-touch-icon" …>` on **every** route (public and admin layouts both sit under `src/app/`). No `favicon.ico` (sharp can't write ICO; every current browser uses the `<link rel=icon>`). Recorded as a known limitation.
   - `sharp` is currently only a transitive dependency of `next` (`npm ls sharp` → `sharp@0.35.5`). Add it as an **exact devDependency `"sharp": "0.35.5"`** (same version, so the lockfile dedupes) so the script never depends on Next's optional install. `public/logo.svg` and `src/components/brand/Logo.tsx` stay (the Logo SVG is still the header's fallback; the header must not change). Update the `Logo.tsx` comment ("…and the old favicon") only.
2. **One shared logo component for footer, admin login and admin shell.** New `src/components/brand/SiteLogo.tsx` (server-safe, no hooks): props `{ logoUrl: string | null | undefined; className?: string; fallbackClassName?: string }`. A blank/whitespace url → the existing `<Logo decorative>` SVG fallback (same fallback the header uses, so all places agree when no logo is set); otherwise `<img src alt="" decoding="async">` (decorative: the ministry name is always shown as text next to it). The url is already validated by `isSafeUrl` when saved; the component additionally refuses anything that isn't `/…` (not `//`) or `https://…` and falls back (defence in depth).
   - **Footer** (`src/components/layout/Footer.tsx`): it already renders `logoUrl`, but at `size-10` the 241×112 mark shrinks to ~40×19 px. Switch to `SiteLogo` with `h-12 w-auto max-w-[8rem] object-contain` (fallback `size-10`). The footer is not the header; its layout (logo + name row) stays the same.
   - **Admin login** (`src/app/admin/login/page.tsx`): it already calls `getSiteSettings()`; read `logoUrl` too and render `SiteLogo` at `h-14 w-auto max-w-[10rem]` (fallback `size-11`) where `<Logo>` is now.
   - **Admin shell** (`AdminShell.tsx` sidebar + mobile top bar): replace `<Logo>` with `SiteLogo` (sidebar `h-8 w-auto max-w-[4.5rem]`, top bar `h-7 …`); `src/app/admin/(dashboard)/layout.tsx` passes `logoUrl` from `getSiteSettings()`. Not required by the brief, but it's two lines and keeps the admin on-brand with the login page.
3. **Default Open Graph image injected in `buildPageMetadata`.** Next replaces (does not merge) a parent's `openGraph` when a page sets its own, and every public page sets one via `buildPageMetadata`, so a layout-level default would be lost. A file-based `opengraph-image.png` would instead override the per-post cover images of Phase 3. So: new pure `src/lib/og-image.ts` exports `DEFAULT_OG_IMAGE = { url: "/brand/og-default.png", width: 1200, height: 630 }`; `buildPageMetadata` uses `images` when given and non-empty, else `[{ ...DEFAULT_OG_IMAGE, alt: siteName }]`; the Twitter card becomes `summary_large_image` everywhere. URLs stay relative to `metadataBase`. Admin pages keep none (noindex).
4. **CSP: strict allow-list set in `next.config.ts` headers, not nonces.** Next's docs: nonces require *every* page to be dynamically rendered (no static generation/ISR/CDN caching). This site statically generates its public pages and relies on settings revalidation; going all-dynamic would add a Neon round-trip to every page view and change caching behaviour the owner relies on ("Redeploy after seeding"). The experimental SRI mode doesn't cover Next's inline flight scripts. So `script-src` keeps `'unsafe-inline'` (required by Next without nonces) but **no third-party script host except Turnstile**, and XSS is already contained by the server-side sanitizer (`src/lib/markdown.ts` is the only HTML source for `dangerouslySetInnerHTML`, plus the QR SVG generated server-side). Recorded as a known limitation with the nonce upgrade path in README › Security notes.
   - Pure builder `src/lib/security/headers.ts` (relative imports only, so `next.config.ts` can import it as `./src/lib/security/headers`; add to `PURE_MODULES`):
     - `buildCsp(area: "site" | "admin" | "uploads", { dev, httpsSite })` returns the header string.
     - `securityHeaderRules({ dev, httpsSite })` returns the array `next.config.ts` `headers()` returns. `dev = process.env.NODE_ENV === "development"`, `httpsSite = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://")` (evaluated at build).
   - **site** CSP (every route):
     - `default-src 'self'`
     - `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com` (+ `'unsafe-eval'` in dev only, required by React dev tooling)
     - `style-src 'self' 'unsafe-inline'` (next/image `fill` and React `style` props)
     - `img-src 'self' data: blob: https:`: owners may paste any `https://` image link (`isSafeUrl`), Markdown images are https, Vercel Blob is `https://*.public.blob.vercel-storage.com`. Images can't run script; a host allow-list would silently break existing pasted links.
     - `media-src 'self' blob: https:` (audio links and Blob audio, same reason)
     - `font-src 'self'` (next/font self-hosts)
     - `connect-src 'self' https://challenges.cloudflare.com` (+ `ws: wss:` in dev only for HMR)
     - `frame-src https://challenges.cloudflare.com https://www.youtube-nocookie.com`
     - `worker-src 'self' blob:`
     - `manifest-src 'self'`
     - `object-src 'none'`, `base-uri 'self'`
     - `form-action 'self' https://checkout.stripe.com https://billing.stripe.com` (no-JS checkout form posts follow a 303 to Stripe; Phase 8 note)
     - `frame-ancestors 'none'`
     - `upgrade-insecure-requests` **only when `httpsSite`** (on `http://localhost` it would upgrade the site's own requests and break local `next start` and E2E).
   - **admin** CSP (`/admin`, `/admin/:path*`, `/api/admin/:path*`, `/api/auth/:path*`): same as site, but `frame-src 'none'` (no YouTube/Turnstile in admin), `script-src` without Cloudflare, `connect-src 'self' https://vercel.com` (the `@vercel/blob` 2.8.2 browser client uploads via `https://vercel.com/api/blob`; the coder confirms the exact URL in `node_modules/@vercel/blob/dist` and records it; host-level so query strings/trailing slashes match), `form-action 'self'`.
   - **uploads** CSP (`/api/uploads/:path*`): `default-src 'none'; sandbox; frame-ancestors 'none'`, the same value the route already sets, so the config rule and the route agree whichever wins.
   - Other headers on **every** route (first rule, `source: "/:path*"`):
     - `Strict-Transport-Security: max-age=63072000; includeSubDomains` (no `preload`: that is a hard-to-undo commitment the owner should make knowingly; README explains). Browsers ignore it over http, so localhost is unaffected.
     - `Referrer-Policy: strict-origin-when-cross-origin` (admin keeps its stricter `same-origin`)
     - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()`. Autoplay, fullscreen, encrypted-media, picture-in-picture and clipboard-write are deliberately **not** listed, so the YouTube iframe's `allow` attribute and the copy-link button keep working.
     - `X-Content-Type-Options: nosniff`
     - `X-Frame-Options: DENY` (legacy twin of `frame-ancestors 'none'`; nothing embeds this site).
   - Rule order: site-wide first, then admin/auth, then `/api/stripe/:path*` (existing no-store/noindex), then uploads. Next applies the **last** matching rule for a duplicate key, so admin and uploads override the site CSP. Admin keeps `X-Robots-Tag` and `Cache-Control: no-store`.
   - No `report-uri` (there is no collector; adding one would mean a third-party endpoint). Documented.
   - Vercel's preview-deployment toolbar (`vercel.live`) is blocked by this CSP. Production is unaffected. Documented as a known limitation rather than widening the policy.
5. **Admin sidebar: pinned Log out.** The sidebar holds 16 links at `min-h-11` plus 4 section headings (~800 px), so it can't fit 650 px. The `<aside>` becomes three rows:
   - brand + session indicator (`shrink-0`)
   - the nav in a `flex-1 min-h-0 overflow-y-auto` region with `aria-label` kept on the `<nav>`
   - a `shrink-0 border-t border-white/10` footer holding Log out.

   Extract `src/components/admin/LogoutButton.tsx` (the existing `<form action={logoutAction}>` markup) and remove it from `AdminNav`. `AdminShell` renders it in the pinned footer. `AdminMobileNav`'s dialog gets the same three-row structure (header, scrolling nav, pinned Log out), so it's reachable at 375×650 too. The button keeps the accessible name "Log out", so `e2e/admin-logout.spec.ts` is unchanged.
6. **Phase 8 review carry-overs (small hardening, no new scope):**
   - (a) LOW #1: `resolveGivingState` opens giving only when **`webhookReady`** (secret key **and** `whsec_` secret), so gifts can't be charged while the webhook can't record them. The Support page and `runCheckoutStart` both use it. The admin Donations status shows "Online giving stays closed until the webhook signing secret is set" when the key is set and the secret isn't.
   - (b) LOW #4: give the `ListToolbar` search input `min-w-[14rem]` (flex-wrap already exists) so the donor-email box isn't squeezed.

   LOW #2 (test/live totals mixed) and #3 (early refund dropped) are listed as known limitations, not changed.
7. **npm audit**: `npm audit --omit=dev` reports 4 high, one root cause. `@vercel/blob@2.8.2` → `@vercel/oidc@3.8.10` → `@vercel/cli-config@0.3.1`, which pins `zod@4.1.11` exactly (GHSA-mrhx-c7xc-m3w5, fixed in zod ≥ 4.6.6). The latest `@vercel/cli-config@0.3.4` still pins 4.1.11, so no upstream upgrade exists, and `npm audit fix --force` would downgrade `@vercel/blob` to 2.4.0 (breaking). Fix with an exact npm override in `package.json`: `"overrides": { "@vercel/cli-config": { "zod": "4.6.7" } }` (same major; the version the app already uses). Accept it only if `npm audit --omit=dev` then shows 0 vulnerabilities and every test (including the Vercel Blob driver tests and upload E2E) passes. Otherwise revert and report it as accepted risk (server-only, zod is used there to parse a local CLI config file, not visitor input). Full `npm audit` (dev deps) is reported, not fixed, unless a same-major exact pin exists.
8. **Lighthouse-style checks without Lighthouse.** Adding `lighthouse` (a large dependency tree) for one phase isn't worth the audit surface. Instead the public sweep spec asserts the Lighthouse SEO/best-practice items per page:
   - exactly one `<h1>`
   - non-empty `<title>` and `meta[name=description]`
   - `html[lang]` equals the locale
   - `meta[name=viewport]`
   - a canonical link, plus `hreflang` alternates (not on noindex pages)
   - `og:image`
   - every `<img>` has an `alt` attribute
   - no console errors, no CSP violations
   - at 375: no horizontal overflow

   It also records (does not assert) navigation timing and transferred JS bytes for `/en` and `/ne` at 375 into `.agents/tasks/phase9/perf.json`. The coder may additionally run Chrome Lighthouse manually if it is already available (`npx --no-install lighthouse` fails → skip). Either way, record the result in verification.md.
9. **README / .env.example.** One new top-level section, "Going live: step-by-step deployment guide", that **absorbs** the current "Switching to Neon" and the four "Setting up …" subsections (kept as its numbered steps, so nothing is duplicated). The existing "Go-live checklist (so far)" becomes the final "Go-live checklist". Production owner: `admin:create-owner` against Neon creates a **new** authenticator entry. The TOTP issuer is `"<ministryName> Admin"` (`scripts/create-owner.ts:213`), so on a freshly seeded Neon DB it's "Demo Ministry Admin", the same label as the local one. The guide tells the owner to rename the new entry to "… (live site)" in the app and keep the local one. No code change.

## Plan

- [ ] 1. **Brand assets: sharp script, icons, default OG image** (decision 1)
  - `npm install --save-dev sharp@0.35.5` (check first with `npm view sharp@0.35.5 version`). Confirm `package.json` shows `"sharp": "0.35.5"` and `package-lock.json` changes only for the dev flag.
  - Create `scripts/generate-brand-assets.ts`. It exports `generateBrandAssets({ root, outDir? })` (testable) and runs it when executed directly. It reads `public/brand/logo-mark.png` and `logo-full.png` and writes the three files exactly as in decision 1. It imports only `node:*` and `sharp`.
  - Add `"brand:generate": "tsx scripts/generate-brand-assets.ts"` to `package.json` scripts. Run it, then `git rm src/app/icon.svg`.
  - **Open and look at** `src/app/icon.png`, `src/app/apple-icon.png` and `public/brand/og-default.png` with the image reader: centred, not cropped, colours intact, ivory background, no black corners on apple-icon.
  - Update the comment in `src/components/brand/Logo.tsx` only.
  - Test `scripts/generate-brand-assets.test.ts` (`// @vitest-environment node`, included by the unit project's `scripts/**/*.test.ts` glob):
    - the committed files exist with sizes 512×512, 180×180 and 1200×630, all `format: "png"`
    - apple-icon has no alpha channel (`hasAlpha === false`)
    - `src/app/icon.svg` does not exist
    - running `generateBrandAssets` into an `os.tmpdir()` folder produces byte-identical files to the committed ones (determinism; clean the folder up afterwards)
  - Add `scripts/generate-brand-assets.ts` to the script-import check if `script-imports.test.ts` scans `scripts/` (it imports nothing from `src/`).
  - **Files:** `package.json`, `package-lock.json`, `scripts/generate-brand-assets.ts`, `scripts/generate-brand-assets.test.ts`, `src/app/icon.png`, `src/app/apple-icon.png`, `src/app/icon.svg` (deleted), `public/brand/og-default.png`, `src/components/brand/Logo.tsx`.
  - **Verify:** `npx vitest run --project unit scripts` passes. `npm run build` exits 0 and its route list shows `/icon.png` and `/apple-icon.png`.

- [ ] 2. **Logo component, footer, admin login, admin shell, default OG metadata** (decisions 2, 3)
  - Create `src/components/brand/SiteLogo.tsx` as in decision 2.
  - Use it in `src/components/layout/Footer.tsx` (replace the inline `<img>`/`<Logo>` branch only, sizes from decision 2), `src/app/admin/login/page.tsx`, and `src/components/admin/AdminShell.tsx` (new `logoUrl` prop). `src/app/admin/(dashboard)/layout.tsx` passes `logoUrl` from `getSiteSettings()` (handle `""` as null).
  - Create pure `src/lib/og-image.ts` (`DEFAULT_OG_IMAGE`, add it to `PURE_MODULES`). In `src/lib/metadata.ts` `buildPageMetadata`, always set `openGraph.images` and `twitter.images`: the given `images` when non-empty, else `[{ url, width, height, alt: siteName }]`. Twitter card is always `summary_large_image`.
  - Tests:
    - `src/components/brand/SiteLogo.test.tsx`: url → `img` with `src` and `alt=""`; `null`, `""` and `"   "` → svg fallback with `aria-hidden`; `javascript:alert(1)`, `//evil.example/x.png` and `http://x` → fallback.
    - `src/lib/metadata.test.ts`: `vi.mock("./site-settings")` and `vi.mock("next-intl/server")` so the pure `buildPageMetadata` can be imported. Cases: no images → the default OG image with width/height/alt and `summary_large_image`; given cover → cover only, no default; canonical and hreflang unchanged for `/` and `/about` in en/ne.
  - **Files:** `src/components/brand/SiteLogo.tsx`, `SiteLogo.test.tsx`, `src/components/layout/Footer.tsx`, `src/app/admin/login/page.tsx`, `src/components/admin/AdminShell.tsx`, `src/app/admin/(dashboard)/layout.tsx`, `src/lib/og-image.ts`, `src/lib/metadata.ts`, `src/lib/metadata.test.ts`, `src/test/script-imports.test.ts`.
  - **Verify:** `npm run typecheck` and `npm run lint` exit 0. `npx vitest run --project unit src/components/brand src/lib/metadata.test.ts src/test` passes. `git diff --stat -- src/components/layout/Header.tsx src/components/layout/MobileMenu.tsx src/components/layout/DesktopNav.tsx src/components/layout/LanguageSwitcher.tsx` is empty.

- [ ] 3. **Admin sidebar: pinned Log out** (decision 5)
  - Create `src/components/admin/LogoutButton.tsx` (client-safe; the same form and button classes as today, plus a small "log out" icon with `aria-hidden`). Remove the form from `AdminNav.tsx`.
  - `AdminShell.tsx`: the `<aside>` becomes `fixed inset-y-0 left-0 hidden w-64 flex-col bg-navy-deep lg:flex` (no `overflow-y-auto` on the aside) with three children:
    - brand link + session block (`shrink-0`)
    - `<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-testid="admin-sidebar-scroll">` wrapping `<AdminNav>`
    - `<div className="shrink-0 border-t border-white/10 px-3 py-2">` with `<LogoutButton />`
  - `AdminMobileNav.tsx`: `Dialog.Content` gets the same structure (header `shrink-0`, nav `min-h-0 flex-1 overflow-y-auto`, pinned `LogoutButton`). The drop of `overflow-y-auto` moves from the content to the middle region.
  - Tighten nothing else (keep the 44 px targets).
  - **Files:** `src/components/admin/LogoutButton.tsx`, `AdminNav.tsx`, `AdminShell.tsx`, `AdminMobileNav.tsx`.
  - **Verify:** `npm run typecheck`, `npm run lint` exit 0. `npx vitest run --project unit src/app/admin src/server/actions/guard-coverage.test.ts` passes (structure tests). The E2E checks come in item 8.

- [ ] 4. **Security headers and CSP** (decision 4)
  - Create pure `src/lib/security/headers.ts` (`buildCsp`, `securityHeaderRules`, exported constants for the host lists; relative imports only; add to `PURE_MODULES`).
  - Rewrite `next.config.ts` `headers()` to `return securityHeaderRules({ dev, httpsSite })`. Delete the old inline `adminHeaders` array and its "full CSP is backlog" comment. Keep `poweredByHeader: false`, `images`, `reactStrictMode` and the next-intl plugin unchanged.
  - Check that `next.config.ts` loads the TS import (`npm run build` succeeds and `.next/routes-manifest.json` contains the new headers). If Next's config loader rejects the import, move the builder to `security-headers.mjs` at the repo root with a `.d.mts` (still pure and unit-tested). Record which path was used.
  - Unit test `src/lib/security/headers.test.ts`:
    - site CSP has each directive from decision 4.
    - No `'unsafe-eval'` unless `dev`. `ws:` only in dev.
    - `upgrade-insecure-requests` only when `httpsSite`.
    - `frame-ancestors 'none'` and `object-src 'none'` in all three areas.
    - `script-src` contains no `*`, `http:`, `https:` or `data:`. Its only third-party host is `https://challenges.cloudflare.com`, and only in the site CSP.
    - `frame-src` site = exactly Turnstile + `https://www.youtube-nocookie.com` (never `youtube.com`). Admin = `'none'`.
    - `form-action` site includes both Stripe hosts.
    - Admin `connect-src` includes `https://vercel.com`.
    - The uploads CSP equals the value hard-coded in `src/app/api/uploads/[...key]/route.ts`. Read the route file and compare strings, so they can't drift. (If you change the route to add `frame-ancestors 'none'`, keep them equal.)
    - Rules: the first rule matches `/:path*` and carries HSTS `max-age=63072000; includeSubDomains`, Referrer-Policy, Permissions-Policy (exact string), nosniff and XFO DENY. The admin rules come after the site rule. The uploads rule is last.
  - **Files:** `src/lib/security/headers.ts`, `headers.test.ts`, `next.config.ts`, `src/test/script-imports.test.ts`, possibly `src/app/api/uploads/[...key]/route.ts` (CSP string only).
  - **Verify:** `npm run typecheck`, `npm run lint` and `npm run build` exit 0. `npx vitest run --project unit src/lib/security` passes. Start `npm run start -- -p 3299` against the built app (in the background, after checking the port is free). Run `curl.exe -sI http://localhost:3299/en` and `curl.exe -sI http://localhost:3299/admin/login` and record the headers in verification.md. Then stop **only** that process.

- [ ] 5. **Phase 8 carry-overs** (decision 6)
  - `src/lib/donations/giving-state.ts`: the input becomes `{ webhookReady, donationsEnabled }`, so `"open"` needs both. Update the callers `src/app/[locale]/support/page.tsx` and `src/server/donations/checkout.ts`, plus `src/lib/donations/support-view.ts` if it passes the flag.
  - `src/app/admin/(dashboard)/donations/page.tsx`: add the warning line from decision 6a in the Stripe status list when `checkoutReady && !webhookReady`.
  - `src/components/admin/ListToolbar.tsx`: `min-w-[14rem]` on the search field wrapper.
  - Tests:
    - Update `src/lib/donations/giving-state.test.ts`: key without whsec → `not-configured` (rewritten case, listed).
    - Extend `src/server/donations/checkout.db.test.ts`: a secret key without a webhook secret → `NOT_AVAILABLE`, with no Stripe call.
  - The E2E second server (`e2e/helpers/stripe-server.ts`) already sets `STRIPE_WEBHOOK_SECRET=whsec_e2e_dummy`, so it should still be "open". Confirm it in item 8.
  - **Files:** the files above.
  - **Verify:** `npx vitest run --project unit src/lib/donations` and `npx vitest run --project db src/server/donations` pass.

- [ ] 6. **Authz re-audit, secrets check, npm audit** (decision 7)
  - Write `.agents/tasks/phase9/authz-audit.md`: **one table row per entry point**. Columns: file, export / HTTP method, public or admin, guard (`requireAdmin` / `requireOwner` / `runAdminAction` with role / `requireAdminRoute` role / none + why), origin/CSRF protection (server action built-in / `same-origin.ts` / Stripe signature / n/a), Zod schema, rate limit, audit log, and verdict.
    - Cover all 63 server-action exports in `src/server/actions/*.ts` (auth, account, categories, events, galleries, inbox, markdown, media, posts, public-donations, public-forms, settings, uploads, users, verses).
    - Cover the route handlers: `api/admin/donations/export` GET, `api/admin/media/library` GET, `api/admin/uploads/blob` POST, `api/admin/uploads/local` POST, `api/stripe/webhook` POST, `api/uploads/[...key]` GET/HEAD, and `api/auth/[...nextauth]` GET/POST.
    - Cover every `src/app/admin/(dashboard)/**/page.tsx` (`requireAdminPage` vs `requireOwnerPage`).
    - Build it by reading each function, not from the existing tests. `previewMarkdownAction`, `cancelLoginAction` and `logoutAction` need explicit notes.
  - Any gap found: fix it with the existing pattern, and add a failing-first test in the matching `*.db.test.ts`. Also extend `src/server/actions/guard-coverage.test.ts` / `src/app/api/route-guard-coverage.test.ts` if the gap shows they miss a category. If there is no gap, say so per row.
  - New unit test `src/test/env-and-secrets.test.ts` (`// @vitest-environment node`):
    - Scan the `git ls-files` output (via `execFileSync("git", ["ls-files"])`) for `src/**`, `scripts/**`, `prisma/**`, `next.config.ts` and `.env.example`.
    - Every `NEXT_PUBLIC_[A-Z_]+` match must be `NEXT_PUBLIC_SITE_URL`.
    - Every `process.env.X` and `env.X` name used under `src/`, `scripts/`, `prisma/` (non-test) must appear in `.env.example`, either as a variable or in a comment. Exempt only `NODE_ENV`.
    - `.env.example` assigns non-empty values only to `NEXT_PUBLIC_SITE_URL` (localhost) and `DATABASE_URL` (127.0.0.1 mission_dev).
    - No tracked file matches `sk_live_`, `rk_live_`, `whsec_[A-Za-z0-9]{20,}`, `sk_test_[A-Za-z0-9]{20,}`, `re_[A-Za-z0-9]{20,}` or `vercel_blob_rw_`. Exclude the binary PNGs and `package-lock.json`.
  - `npm audit --omit=dev` and `npm audit`: save the raw output to `.agents/tasks/phase9/npm-audit-before.txt`. Apply the override from decision 7 (`npm install` afterwards; confirm `npm ls zod` shows `4.6.7` under `@vercel/cli-config`). Save `.agents/tasks/phase9/npm-audit-after.txt`. Summarise both in `.agents/tasks/phase9/npm-audit.md`: advisory, path, action, result. If the override breaks anything in items 7–9, revert it and write the accepted-risk note instead.
  - **Files:** `.agents/tasks/phase9/authz-audit.md`, `npm-audit*.{md,txt}`, `src/test/env-and-secrets.test.ts`, `package.json`, `package-lock.json`, plus any fix + test.
  - **Verify:** `npx vitest run --project unit src/test` passes. `npm audit --omit=dev` exits 0 (or the accepted-risk note is written). `npm run build` exits 0.

- [ ] 7. **README deployment guide and `.env.example`** (decision 9)
  - `.env.example`: keep the existing grouping and wording, and document **every** variable with no real values:
    - core: `NEXT_PUBLIC_SITE_URL`, `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `TOTP_ENCRYPTION_KEY`
    - forms: `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CONTACT_TO_EMAIL`, `FORM_RATE_LIMIT_PER_HOUR`
    - uploads: `BLOB_READ_WRITE_TOKEN`, `LOCAL_UPLOAD_DIR`
    - donations: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CUSTOMER_PORTAL_URL`, `DONATION_RATE_LIMIT_PER_HOUR`, `STRIPE_API_BASE_URL_FOR_TESTS`
    - new "Set automatically / scripts only" block, comments only:
      - `OWNER_PASSWORD`: only in a one-off shell for `admin:create-owner`, never in `.env` or Vercel
      - `VERCEL`: set by Vercel; never set it yourself
      - "Do not set `AUTH_URL`: `trustHost` is on and Vercel provides the host."

    Each variable says where to get it, which Vercel environments need it (Production / Preview), and whether it is required. The test from item 6 enforces completeness.
  - `README.md`:
    - Add the "Going live: step-by-step deployment guide" section after "Setting up your authenticator app". It is written for a non-technical owner: numbered steps, what to click, what you should see, and nothing assumed:
      0. What you need: a domain, an email address, about 2 hours, and the code in a private GitHub repository (connect Vercel to it; this project never pushes for you).
      1. **Neon**: create the project in a US region close to Vercel's default. Copy the pooled `DATABASE_URL` and the direct `DIRECT_URL`. Create a `preview` branch for Preview deployments.
      2. **Vercel**: import the repo. The framework is detected; Vercel runs the `vercel-build` script (`prisma migrate deploy && next build`) automatically, so migrations apply on every deploy. Don't override the build command.
      3. **Environment variables in Vercel**: a table of every variable with Required/Optional, Production/Preview, and where the value comes from. Include the secret-generation command, the warning that `TOTP_ENCRYPTION_KEY` must never change, and "redeploy after changing variables".
      4. **Prepare the production database once**: the existing PowerShell block (`db:deploy` → `db:seed` → `admin:create-owner`). Add: this creates a **new authenticator entry** (scan the new QR code; it will also be called "… Admin", so rename it to "… (live site)" in your app and keep the one for your computer). Use a different password from your local one. Close the window afterwards so the URLs don't linger.
      5. First deploy and smoke test: `/en`, `/ne`, `/admin` sign-in, Settings (set the name and logo, untick nothing yet).
      6. **Vercel Blob** (existing steps).
      7. **Resend**: add the domain, the SPF/DKIM DNS records at the registrar, wait for "Verified", the API key, `RESEND_FROM_EMAIL` on that domain (existing steps, expanded).
      8. **Turnstile** (existing steps; add the production domain **and** the custom domain).
      9. **Stripe**: test mode first, the webhook endpoint with its 4 events and signing secret, the test card. Going live: live key + a **separate live webhook endpoint and its own signing secret**, Production env only. Note that giving stays closed until both the key and the signing secret are set (decision 6a).
      10. **Custom domain**: Vercel → Settings → Domains, the DNS records Vercel shows, wait for the certificate. Then update `NEXT_PUBLIC_SITE_URL` to `https://your-domain` and redeploy (this also switches on `upgrade-insecure-requests`). Update the Stripe webhook URL, the Turnstile domains and the Resend sender. Explain HSTS and that `preload` is deliberately off.
      11. **Backups**:
          - Neon keeps a point-in-time restore window; check your plan's window in the Neon console and how to restore to a new branch.
          - Monthly, export a copy with `pg_dump` using the direct URL (the coder checks whether `node_modules/@embedded-postgres/windows-x64/native/bin/pg_dump.exe` exists and documents that exact path, else says "install PostgreSQL client tools"). Keep the file somewhere private: it contains prayer requests.
          - Vercel Blob has no automatic backup, so keep the original photos.
          - Stripe keeps payment records; download the Donations CSV monthly.
          - Write down `TOTP_ENCRYPTION_KEY` / `AUTH_SECRET` in a password manager.
      12. **Go-live checklist** (the existing list, moved here and completed):
          - legal review of the Privacy Policy and Terms (they are templates)
          - tax status confirmed before ticking the box
          - refund policy in the Terms
          - replace all demo content and untick "Demo site"
          - native-speaker review of every Nepali string and the Nepali legal templates
          - real Turnstile/Resend/Stripe live keys, with the admin status pages showing them configured
          - the Blob store created and local uploads re-uploaded
          - test a real $5 gift in live mode and refund it
          - check `securityheaders.com`-style headers are present (`curl -I`)
          - delete or deactivate unused editor accounts
    - Remove the now-duplicated "Switching to Neon" section; its content lives in steps 1–4. Keep an anchor sentence "See Going live › step 4" where other sections link to it.
    - "Environment variables": make the tables cover every variable, including the scripts-only block.
    - "Security notes": replace the four "Phase 9's CSP must…" forward notes with the actual policy: a summary of each directive and why (`'unsafe-inline'` scripts and the nonce upgrade path, `img-src https:`, form-action Stripe), HSTS, Permissions-Policy, XFO and frame-ancestors on all routes, the admin and uploads overrides, and "no CSP report endpoint". Update "`/admin` … sends …" accordingly.
    - "Roadmap": 9 ✅ (drop "recovery codes" or move it to a "Later" bullet; it was never in this run's scope).
    - Add "Known limitations (Phase 9)":
      - CSP uses `'unsafe-inline'` for scripts (no nonces, to keep static pages)
      - no `favicon.ico`
      - the Vercel preview toolbar is blocked
      - no Lighthouse run in CI (Playwright checks instead)
      - Phase 8 LOW #2 (test and live totals mixed unless filtered) and #3 (a refund that arrives before its gift is not linked)
    - "Scripts" table: add `brand:generate`.
    - Phase status line: up to date.
  - **Files:** `README.md`, `.env.example`.
  - **Verify:** `npm run format:check` exits 0 (run `npx prettier --write README.md .env.example` if needed; Prettier doesn't format `.env.example`, so check it by eye). `npx vitest run --project unit src/test/env-and-secrets.test.ts` passes. Re-read the guide top to bottom as a non-technical owner: every step names the screen/button and the expected result.

- [ ] 8. **E2E: headers, CSP violations, icons, logo, sidebar, full axe sweep, screenshots** (depends on 1–5)
  - New helper `e2e/helpers/axe.ts`: `seriousViolations(page, label?)` with the same tags and log line as the existing specs (`[axe] <url> … serious/critical=N`). Plus `collectCspViolations(page)`: `page.addInitScript` registers `document.addEventListener("securitypolicyviolation", e => (window.__csp ??= []).push({ d: e.violatedDirective, u: e.blockedURI }))`, and a reader returns the list. Also `collectConsoleErrors(page)`. The existing specs stay as they are.
  - `e2e/security-headers.spec.ts` (**public** project; uses the `request` fixture plus one browser test per area):
    - For `/en`, `/ne/devotionals`, `/en/support`, `/en/does-not-exist` (404), `/robots.txt`, `/sitemap.xml`, `/icon.png`, `/brand/og-default.png`, `/api/stripe/webhook` (POST → 503) and `/api/auth/session`: CSP present with `frame-ancestors 'none'`, `default-src 'self'`, `object-src 'none'` and no `'unsafe-eval'`. Exact HSTS, Referrer-Policy (`strict-origin-when-cross-origin`), Permissions-Policy, `nosniff`, XFO `DENY`. No `upgrade-insecure-requests` (http E2E build).
    - `/admin/login` and the `/admin` 307: the admin CSP (`frame-src 'none'`, `connect-src` has `https://vercel.com`), Referrer `same-origin`, `no-store`, noindex, plus HSTS/Permissions/XFO.
    - `/api/uploads/does-not-exist/x.png` (404): the uploads CSP (`sandbox`, no `script-src`).
    - **No CSP violations and no console errors** while loading:
      - `/en`, `/ne`
      - `/en/devotionals/sample-devotional-here-i-am`
      - `/en/missions/sample-past-gathering`, with the lightbox opened
      - `/en/media`, after pressing play on "E2E fixture video", with YouTube routes stubbed as in `a11y.spec.ts`. The iframe must load: CSP is checked on the URL even for stubbed responses.
      - `/en/prayer` and `/ne/contact`, with `stubTurnstile`, waiting for the widget
      - `/en/support`, `/admin/login`
  - `e2e/branding.spec.ts` (**public** project, read-only):
    - `/en` and `/admin/login` `<head>` have `link[rel=icon][href^="/icon.png"]` and `link[rel=apple-touch-icon][href^="/apple-icon.png"]`.
    - GET `/icon.png`, `/apple-icon.png` and `/brand/og-default.png` → 200 `image/png`. GET `/icon.svg` → 404.
    - `/en`, `/ne/about` and `/en/support` have `meta[property="og:image"]` ending `/brand/og-default.png`, with `og:image:width` 1200 and `twitter:card` `summary_large_image`.
    - With the seeded (null) logo, the footer and the login page show the svg fallback (`svg[aria-hidden]` inside the brand row).
  - `e2e/admin-branding.spec.ts` (**admin-mutations**, before the screenshot spec): as the owner, set Settings › Logo to `/brand/logo-mark.png`, following the save pattern in `e2e/admin-settings.spec.ts`. Then:
    - the `/en` and `/ne` footer show `img[src="/brand/logo-mark.png"]`, visible, height ≥ 40 px
    - a fresh anonymous context on `/admin/login` shows it
    - the admin sidebar shows it

    `afterAll` restores the empty logo.
  - `e2e/admin-sidebar.spec.ts` (**admin-readonly**):
    - As the owner and as the editor at `1280×650` and `1280×600` on `/admin` and `/admin/settings` (owner only for settings): `getByRole("button", { name: "Log out" })` is `toBeInViewport()` with `window.scrollY === 0`.
    - The `admin-sidebar-scroll` region has `scrollHeight > clientHeight` for the owner. After scrolling it to the bottom, the last nav link ("Account") is in the viewport and Log out is still in the viewport.
    - Keyboard: tabbing from the "Account" link reaches Log out next.
    - At `375×650`, opening the admin menu shows Log out in the viewport without scrolling the dialog.
    - Do **not** click Log out here: logout revokes the shared storage state for all sessions (`admin-logout.spec.ts` runs last for that reason).
  - `e2e/phase9-public-sweep.spec.ts` (**public** project): pages:
    - `/`, `/about`, `/devotionals`, `/devotionals?q=sample`
    - `/devotionals/sample-devotional-here-i-am`
    - `/missions`, `/missions/sample-past-gathering`
    - `/media`, `/prayer`, `/contact`
    - `/support`, `/support/thank-you`, `/support/cancelled`
    - `/privacy`, `/terms`
    - `/does-not-exist` (404 page; assert status 404)

    Each in `en` and `ne`, at 1280 and 375 (forms with `stubTurnstile` + `waitForTurnstile`). For each: axe serious/critical = 0, CSP violations = 0, console errors = 0, plus the Lighthouse-style assertions from decision 8 (canonical/hreflang/og:image skipped on the 404 and the noindex result pages; those must have `robots` noindex instead). Record the perf numbers for `/en` and `/ne` at 375 into `.agents/tasks/phase9/perf.json`.
  - `e2e/phase9-admin-sweep.spec.ts` (**admin-mutations**, after `admin-inbox.spec.ts` so the inbox has rows; before the screenshots):
    - As the owner, axe = 0 serious/critical and no CSP violations on every admin page:
      - `/admin/login` (anonymous context)
      - `/admin`
      - `/admin/posts`, `/admin/posts/new`, `/admin/posts/<first id>`
      - `/admin/categories`, `/admin/categories/<first id>`
      - `/admin/verses`, `/admin/verses/new`, `/admin/verses/<first>`
      - `/admin/events`, `/admin/events/new`, `/admin/events/<first>`
      - `/admin/media`, `/admin/media/new`, `/admin/media/<first>`
      - `/admin/galleries`, `/admin/galleries/new`, `/admin/galleries/<first>` (create a gallery first if none exists, as `admin-uploads.spec.ts` does)
      - `/admin/inbox/prayer`, `/admin/inbox/prayer/<first>`
      - `/admin/inbox/messages`, `/admin/inbox/messages/<first>`
      - `/admin/inbox/settings`, `/admin/settings`, `/admin/donations`, `/admin/users`, `/admin/audit`, `/admin/account`
      - `/admin/does-not-exist`

      Get each `<first id>` from the first row link on the list page.
    - As the editor: `/admin`, `/admin/forbidden` (via `/admin/settings`) and `/admin/inbox/prayer`.
    - List pages and the dashboard at 1280 and 375; editors/detail pages at 1280.
    - Plus the open states: the media-picker dialog on `/admin/posts/new`, the ConfirmDialog of a delete button (cancel it), the mobile admin menu.
  - `e2e/phase9-screenshots.spec.ts` (**admin-mutations**, last before `admin-logout.spec.ts` if that must stay last; otherwise last). It saves to `c:\Users\rasaily\Downloads\mission app\.agents\screenshots\phase9\` (`mkdirSync` recursive), with fonts ready, `scrollWidth <= clientWidth` asserted via the `scrollWidth` helper, and a bounded `networkidle` wait plus a 120 s timeout as in Phase 8. It first sets the logo to `/brand/logo-mark.png` (restored in `afterAll`):
    - `home-{en,ne}-{1280,375}.png` (full page: the header unchanged, the new footer logo)
    - `footer-{en,ne}-{1280,375}.png` (element screenshot of `footer`)
    - `admin-login-{1280,375}.png`
    - `admin-dashboard-1280x650.png` (viewport only: Log out pinned and visible)
    - `admin-sidebar-scrolled-1280x650.png` (after scrolling the nav to the bottom)
    - `admin-mobile-menu-375x650.png` (dialog open, Log out pinned)
    - `brand-assets.png`: `page.setContent` with `/icon.png` at 512 and at 32, `/apple-icon.png` and `/brand/og-default.png`, on white and on a navy-deep strip (all loaded from the base URL)
    - `og-default.png`: navigate to `/brand/og-default.png` at 1200×630
    - `support-open-en-1280.png` is not needed again
    - `header-unchanged-en-1280.png` (viewport crop of the header, compare with Phase 8's)
  - `playwright.config.ts`:
    - `PUBLIC_SPECS` += `security-headers.spec.ts`, `branding.spec.ts`, `phase9-public-sweep.spec.ts`
    - admin-readonly += `admin-sidebar.spec.ts`
    - admin-mutations: `admin-branding.spec.ts` and `phase9-admin-sweep.spec.ts` after `admin-inbox.spec.ts`; `phase9-screenshots.spec.ts` at the end. Keep the relative order of the existing entries, and check where `admin-logout.spec.ts` must sit (it revokes sessions). If the new specs run after it, they must log in themselves with `loginAs`, so place them before it.
  - Update `e2e/admin-access.spec.ts`: `EXACT_HEADERS` gets the new admin values; "public pages get the site-wide headers only" now expects XFO `DENY` and the site CSP. List both as rewritten tests, because the behaviour changed on purpose.
  - **Files:** the new specs and helper above, `e2e/admin-access.spec.ts`, `playwright.config.ts`.
  - **Verify:** `npm run test:e2e`: all pass (282 + new). Then **open every screenshot** under `.agents/screenshots/phase9/` and check each one:
    - navy/ivory/beige/gold palette
    - the footer logo crisp and not squashed
    - the login logo centred above "<name> Admin"
    - Log out visible at the sidebar bottom at 650 px
    - Devanagari renders
    - no overflow at 375
    - the header identical to Phase 8's `header-unchanged-en-1280.png`
    - the icons recognisable at 32 px

    Write one line per image in verification.md.

- [ ] 9. **Full verification and evidence** (`.agents/tasks/phase9/verification.md`)
  1. Static checks: `npm run lint`, `npm run typecheck`, `npm run format:check` and `npm run build` all exit 0. Record the build's route list lines for `/icon.png` and `/apple-icon.png`.
  2. `npm test`: files/tests count vs 91/945, with the new test files listed and the rewritten tests named with reasons.
  3. `npm run test:e2e`: count vs 282, with the new specs listed and the `[axe] … serious/critical=0` lines summarised per page group (public en/ne × widths, admin owner/editor). Note any flaky rerun and its cause.
  4. Screenshots: the list, plus what you saw in each.
  5. Headers: the `curl.exe -sI` output for `/en`, `/admin/login` and `/api/uploads/x/y.png` from item 4.
  6. Authz audit: a link to `authz-audit.md` with a one-line result (rows, gaps found and fixed).
  7. npm audit before/after, and the override decision.
  8. Lighthouse-style: a summary of the checks and `perf.json` numbers, plus a manual Lighthouse run if one was possible.
  9. Greps (PowerShell `Select-String` over `git ls-files` plus untracked files, excluding `.agents/`, `.vscode/` and PNGs):
     - `S3|AWS|Amazon|Cognito|SES` (expected: only the legal test's negative assertion)
     - `NEXT_PUBLIC_` (only `NEXT_PUBLIC_SITE_URL`)
     - real-looking keys (none)
     - `tax[- ]deductible`, `501\(c\)` and `registered charity` (same allowed places as Phase 8)
     - `git ls-files .env` empty
     - `git check-ignore .env .local/x` both ignored
  10. Header untouched: `git diff --stat -- src/components/layout/Header.tsx src/components/layout/MobileMenu.tsx src/components/layout/DesktopNav.tsx src/components/layout/LanguageSwitcher.tsx` is empty.
  11. mission_dev read-only check (one-off `npx tsx -e` with `createPrismaClient`, asserting the URL contains `/mission_dev`):
      - OWNER count 1
      - `ministryName` "Bible Distribution Ministry"
      - `logoUrl` "/brand/logo-mark.png"
      - `donationsEnabled`, `taxDeductibleVerified`
      - row counts unchanged from Phase 8 (Post 6, Event 4, MediaItem 3, …)
      - `npx prisma migrate status`: up to date, with no new migration
  12. Notes for the user:
      - restart `npm run dev` (new headers and icons; hard-refresh to see the new favicon)
      - the deployment guide is in the README
      - the remaining owner actions: accounts, keys, legal/tax review, Nepali review, replace demo content
      - known limitations

## Risks and how the plan handles them

- **CSP breaks a feature silently.** Item 8's violation collector runs on every page type: the Turnstile stub, the YouTube iframe, the lightbox, uploads (admin sweep including `/admin/media` with the uploader), Stripe (the existing `donations-checkout.spec.ts` on the :3211 server builds from the same config). Any `securitypolicyviolation` fails the run.
- **The dev server on :3000.** The user's `npm run dev` gets `'unsafe-eval'` and `ws:`. Ask nothing; note "restart dev" in the user notes.
- **`next.config.ts` importing a TS module.** The fallback path is given in item 4.
- **The override changes runtime behaviour of `@vercel/blob` OIDC.** It's gated by the full unit + E2E run, with the revert path in item 6.
