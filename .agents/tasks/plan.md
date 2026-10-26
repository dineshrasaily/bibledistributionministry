# Implementation Plan: Demo Ministry, Phases 1 (design system) + 2 (layout + home)

Project root (work here directly, no subfolder, no worktree): `c:\Users\rasaily\Downloads\mission app`
The path contains a space. Quote it in every shell command, e.g. `cd "c:\Users\rasaily\Downloads\mission app"` or pass it as the `cwd`.
Environment: Windows + PowerShell, Node v24.22.1, npm 11.19.1, Git 2.51. No Docker, no database in these phases.
Do NOT commit. Run `git init` only and leave everything uncommitted for the user to review.
Never run `npm run dev` / `npm start` in the foreground. Playwright's `webServer` starts and stops the server.

## 0. Hard constraints (coder and reviewer must both enforce)

- NO Amazon/AWS services anywhere (user constraint, overrides the original spec's "S3" mention). Media storage later = Vercel Blob (Cloudinary noted as an acceptable alternative). Email later = Resend. Never mention S3, SES, Cognito, RDS, Amplify or "AWS" in README, `.env.example`, code or comments. Hosting = Vercel + Neon Postgres, payments = Stripe (USD), auth = Auth.js (OWNER + max 3 EDITOR accounts). All of that is future-phase; only README/roadmap and `.env.example` comments mention them now.
- Exact pinned versions in package.json (no `^`/`~`). Use `npm install --save-exact` and add `.npmrc` with `save-exact=true`.
- All sample content visibly marked as demo (DemoBadge on every demo card/verse/mission statement + site-wide banner). No invented real ministry details, testimonials, donation stats, or charitable/tax-deductible claims. The words "tax-deductible", "tax deductible", "501(c)", "registered charity" must not appear anywhere.
- Bible text: World English Bible (WEB) only, always shown with reference + translation, e.g. "Isaiah 6:8 (WEB)". On `/ne` show the English WEB text plus a localized note that a Nepali translation is pending. Never paste any Nepali Bible translation.
- Ministry name comes only from `src/config/site.ts` (`siteConfig.name`). No hard-coded "Demo Ministry" strings in components or message files (messages use the `{name}` ICU placeholder where needed).
- Only `NEXT_PUBLIC_` env vars may be read in client components. Only `NEXT_PUBLIC_SITE_URL` is used in this phase.

## 1. Decisions (with rationale)

1. Scaffolding: set up manually, no `create-next-app`. It rejects "mission app" as a package name, and a temp-folder-then-move dance is error-prone on Windows; a manual setup also lets us pin every version exactly. All config file contents are specified below.
2. Versions (verified with `npm view <pkg> version` / peer deps on this machine):
   - Latest `typescript` is 7.0.2 (native Go port), but `typescript-eslint@8.72.0` (pulled in by `eslint-config-next`) declares `typescript >=4.8.4 <6.1.0`. Pin **typescript 6.0.3**.
   - Latest `eslint` is 10.13.0, but `eslint-plugin-react@7.37.5` and `eslint-plugin-jsx-a11y@6.10.2` (deps of eslint-config-next) only support eslint ≤ 9. Pin **eslint 9.39.5** (the `maintenance` tag).
   - `@vitejs/plugin-react@6.1.2` peers `vite ^8`; vitest 5.0.5 accepts vite 8. Pin **vite 8.3.5** explicitly so the peer is satisfied deterministically.
   - `@types/node` pinned to **24.19.2** to match the Node 24 runtime (not 26.x).
3. Fonts (all via `next/font/google`, self-hosted at build time; build needs network once):
   - Headings + scripture: **Lora** (variable, subsets `latin`). Chosen over Cormorant Garamond because Lora has a larger x-height and stays readable at body-ish sizes in VerseBlock; Cormorant gets thin and low-contrast at small sizes.
   - Body/UI: **Inter** (variable, `latin`).
   - Nepali: **Noto Sans Devanagari** (body) + **Noto Serif Devanagari** (headings/scripture), subsets `['devanagari','latin']`, `preload: false`, `display: 'swap'`. The Noto pair matches the sans/serif split of Inter/Lora, and both are complete Devanagari families (conjuncts, matras render correctly; Mukta has no serif companion).
   - Applied by locale: the `<html>` element always gets the Lora/Inter variables; for `ne` it additionally gets the two Noto variables, and CSS `html:lang(ne)` puts the Noto family FIRST in `--font-sans` / `--font-serif` (Latin falls back fine since Noto Devanagari includes Latin). `ne` also gets `line-height: 1.75` for body text because Devanagari needs more vertical room.
4. i18n: next-intl 4.14.9 with prefix routing `localePrefix: 'always'`, `locales: ['en','ne']`, `defaultLocale: 'en'`, and **`localeDetection: false`** so `/` always redirects to `/en` regardless of the browser's Accept-Language (the spec requires `/` → `/en`, and E2E must be deterministic). Next 16 renames middleware to `proxy`, so the file is `src/proxy.ts`.
   - Locale resolution: use the stable `requestLocale` + `setRequestLocale(locale)` pattern (called in the locale layout and every page) rather than the newer `next/root-params` approach. Reason: `next/root-params` relies on generated `.next/types`, which makes `tsc --noEmit` fail on a clean checkout before a build; the `setRequestLocale` pattern is fully supported in next-intl 4 and keeps static rendering.
   - `src/app/[locale]/layout.tsx` is the root layout (it renders `<html lang={locale}>`). There is no `src/app/layout.tsx`. A minimal `src/app/not-found.tsx` (client, renders its own `<html lang="en">`) covers requests that never reach a locale; `src/app/[locale]/[...rest]/page.tsx` calls `notFound()` so unknown paths render the localized `src/app/[locale]/not-found.tsx`.
   - `timeZone: 'UTC'` in request config so server/client date formatting never mismatches.
   - Page/layout prop types are written by hand (`{ params: Promise<{ locale: string }> }`) instead of Next's generated `PageProps`/`LayoutProps` globals, so typecheck doesn't depend on typegen. Still add `"pretypecheck": "next typegen"` so `next-env.d.ts` exists on a clean checkout (if `next typegen` is not available in 16.4.3, replace it with nothing and note that `npm run build` must run first, then report it).
5. Language switcher: a link-based switcher (two links: "English" / "नेपाली", the current one with `aria-current="true"`, each with `hrefLang` and `lang` attributes). Two locales don't justify a dropdown, and links work without JS and are trivially keyboard accessible. The href is computed by a pure function `switchLocalePath(pathname, targetLocale)` in `src/lib/i18n-path.ts` (unit tested), using `usePathname()` from `next/navigation` (the full, prefixed path). Path-only: no query strings are used in this phase.
6. Radix: only `@radix-ui/react-dialog` is installed (mobile menu: focus trap, Escape, `aria-expanded` on trigger, focus return). No dropdown is used in Phases 1–2 so `@radix-ui/react-dropdown-menu` is NOT installed (avoid unused deps; add it when a dropdown appears). Button does not need `@radix-ui/react-slot`; it switches between `<button>` and `next/link` based on `href`.
7. Class merging: `clsx` + `tailwind-merge` via a `cn()` helper in `src/lib/cn.ts`.
8. Demo content shape: localized fields are `LocalizedText = { en: string; ne: string }`; `src/lib/content.ts` returns locale-resolved view models so pages never see raw records, and Phase 4 can swap the implementation for Prisma. Verses keep English WEB `text` only. Event `status` is stored (not computed from "now") so the build is deterministic; demo dates are in 2027.
9. Card links: demo cards link to the section index pages (`/devotionals`, `/missions`, `/media`), not detail pages, so there are no 404s in this phase.
10. Social placeholders in the footer are rendered as non-link text items ("Facebook · YouTube · Instagram", each with "(placeholder)" in a visually small label), so there are no fake URLs.
11. Animation: CSS-only `fade-up` keyframes exposed as a Tailwind utility `animate-fade-up` plus `motion-reduce:animate-none`, with a global `@media (prefers-reduced-motion: reduce)` guard. No IntersectionObserver/JS.
12. Header breakpoint: full desktop nav appears at `xl` (≥1280px); below that the hamburger menu is used. Eight nav items + switcher + CTA (longer in Nepali) do not fit cleanly at 1024px. The "Support the Mission" header CTA shows from `sm` up next to the hamburger and inside the mobile menu.
13. Open Graph: text metadata only (title, description, siteName, locale `en_US` / `ne_NP`, type website, url). No generated OG image in this phase (Devanagari in `ImageResponse` would need font bundling; defer).
14. Copyright year uses `new Date().getFullYear()` in the server footer; pages are statically rendered, so it reflects build time (acceptable; rebuilt on deploy).
15. Screenshots directory `.agents/screenshots/` is git-ignored (generated artifacts); ESLint/Prettier ignore `.agents/**`.
16. Playwright web server runs on port **3210** (`next build` then `next start -p 3210`) to avoid clashing with anything the user has on 3000. `reducedMotion: 'reduce'` is set globally so axe and screenshots don't catch mid-animation states.

## 2. Contrast check (computed; WCAG relative luminance)

| Foreground | Background | Ratio | Allowed use |
|---|---|---|---|
| navy `#1E2A44` | ivory `#FBF8F3` | ≈13.5:1 | all text |
| navy `#1E2A44` | beige `#EDE4D3` | ≈10.6:1 | all text |
| white `#FFFFFF` | navy `#1E2A44` | ≈14.3:1 | all text |
| gold `#B8924A` | navy `#1E2A44` | ≈4.9:1 | text OK (AA normal) |
| gold `#B8924A` | deep navy `#141C2F` | ≈5.6:1 | text OK |
| navy `#1E2A44` | gold `#B8924A` (gold button) | ≈4.9:1 | button text OK |
| dark gold `#8A6A2F` | ivory `#FBF8F3` | ≈4.7:1 | text OK (AA normal) |
| dark gold `#8A6A2F` | white | ≈5.0:1 | text OK |
| dark gold `#8A6A2F` | beige `#EDE4D3` | ≈4.0:1 | **large text only** (≥24px or ≥18.66px bold); use navy for small text on beige |
| gold `#B8924A` | ivory/white | ≈2.7:1 | **decorative only** (rules, borders, icons) |

Footer body text on deep navy: use `text-white/80` minimum (≈ 11:1); avoid lower opacities. Eyebrow text in SectionHeader uses `text-gold-dark` on ivory/white and `text-gold` on navy bands; on beige bands use `text-navy`.

## 3. Dependencies (exact versions, verified)

dependencies:
```
next 16.4.3
react 19.3.1
react-dom 19.3.1
next-intl 4.14.9
@radix-ui/react-dialog 1.3.1
clsx 2.1.1
tailwind-merge 3.7.0
```
devDependencies:
```
typescript 6.0.3
@types/node 24.19.2
@types/react 19.3.0
@types/react-dom 19.3.0
tailwindcss 4.3.3
@tailwindcss/postcss 4.3.3
postcss 8.5.31
eslint 9.39.5
eslint-config-next 16.4.3
eslint-config-prettier 10.1.8
prettier 3.9.10
prettier-plugin-tailwindcss 0.8.1
vitest 5.0.5
vite 8.3.5
@vitejs/plugin-react 6.1.2
jsdom 30.1.3
@testing-library/react 16.3.3
@testing-library/dom 10.4.2
@testing-library/jest-dom 7.0.1
@testing-library/user-event 14.6.8
@playwright/test 1.64.1
@axe-core/playwright 4.14.0
```
Zod is NOT installed in this phase (spec: installed later).

If `npm install` reports a peer conflict, do not use `--force`/`--legacy-peer-deps`; report the conflict, choose the nearest compatible pinned version via `npm view <pkg>@<range> version`, and record the change in the final report.

## 4. Target file tree

```
mission app/
├─ .agents/ (plan.md, screenshots/ — git-ignored screenshots)
├─ .env.example
├─ .gitignore
├─ .npmrc                      # save-exact=true
├─ .prettierrc.json
├─ .prettierignore
├─ eslint.config.mjs
├─ next.config.ts
├─ next-env.d.ts               # generated, git-ignored
├─ package.json                # "name": "mission-app", "private": true
├─ playwright.config.ts
├─ postcss.config.mjs
├─ README.md
├─ tsconfig.json
├─ vitest.config.mts
├─ messages/
│  ├─ en.json
│  └─ ne.json                  # top-level "_note"
├─ public/
│  └─ logo.svg
├─ e2e/
│  ├─ routing.spec.ts
│  ├─ navigation.spec.ts
│  ├─ mobile-menu.spec.ts
│  ├─ language-switcher.spec.ts
│  ├─ a11y.spec.ts
│  └─ screenshots.spec.ts
└─ src/
   ├─ proxy.ts
   ├─ app/
   │  ├─ globals.css
   │  ├─ icon.svg              # favicon (same motif as logo)
   │  ├─ not-found.tsx         # global fallback with own <html>
   │  ├─ robots.ts
   │  ├─ sitemap.ts
   │  └─ [locale]/
   │     ├─ layout.tsx
   │     ├─ page.tsx           # Home
   │     ├─ not-found.tsx      # localized 404
   │     ├─ [...rest]/page.tsx # notFound()
   │     ├─ about/page.tsx
   │     ├─ devotionals/page.tsx
   │     ├─ missions/page.tsx
   │     ├─ media/page.tsx
   │     ├─ prayer/page.tsx
   │     ├─ support/page.tsx
   │     ├─ contact/page.tsx
   │     ├─ privacy/page.tsx
   │     └─ terms/page.tsx
   ├─ config/
   │  ├─ site.ts               # siteConfig (name, email, social, siteUrl)
   │  └─ navigation.ts         # nav item list (key + href), footer links
   ├─ i18n/
   │  ├─ routing.ts
   │  ├─ navigation.ts         # createNavigation(routing)
   │  └─ request.ts
   ├─ lib/
   │  ├─ cn.ts
   │  ├─ content.ts
   │  ├─ content.test.ts
   │  ├─ i18n-path.ts
   │  ├─ i18n-path.test.ts
   │  ├─ messages.test.ts      # en/ne key parity
   │  └─ metadata.ts           # buildPageMetadata()
   ├─ content/demo/
   │  ├─ types.ts
   │  ├─ posts.ts
   │  ├─ events.ts
   │  ├─ verses.ts
   │  └─ media.ts
   ├─ components/
   │  ├─ ui/
   │  │  ├─ Button.tsx (+ Button.test.tsx)
   │  │  ├─ Card.tsx
   │  │  ├─ Badge.tsx          # Badge + DemoBadge
   │  │  ├─ SectionHeader.tsx
   │  │  ├─ VerseBlock.tsx (+ VerseBlock.test.tsx)
   │  │  ├─ Container.tsx
   │  │  ├─ Skeleton.tsx
   │  │  ├─ EmptyState.tsx (+ EmptyState.test.tsx)
   │  │  ├─ Input.tsx
   │  │  ├─ Textarea.tsx
   │  │  ├─ Label.tsx
   │  │  ├─ FieldError.tsx
   │  │  ├─ Checkbox.tsx
   │  │  ├─ FormField.test.tsx # label + aria-describedby wiring
   │  │  └─ index.ts
   │  ├─ brand/Logo.tsx
   │  ├─ layout/
   │  │  ├─ SkipLink.tsx
   │  │  ├─ DemoBanner.tsx
   │  │  ├─ Header.tsx
   │  │  ├─ DesktopNav.tsx     # client (active link via usePathname)
   │  │  ├─ MobileMenu.tsx     # client, Radix Dialog
   │  │  ├─ LanguageSwitcher.tsx # client
   │  │  └─ Footer.tsx
   │  ├─ home/
   │  │  ├─ Hero.tsx
   │  │  ├─ FeaturedVerse.tsx
   │  │  ├─ MinistryIntro.tsx
   │  │  ├─ RecentUpdates.tsx (+ RecentUpdates.test.tsx: empty state)
   │  │  ├─ FeaturedContent.tsx
   │  │  ├─ UpcomingEvents.tsx
   │  │  └─ CtaBand.tsx
   │  └─ PlaceholderPage.tsx
   ├─ test/setup.ts
   └─ types/next-intl.d.ts     # AppConfig { Locale; Messages }
```

## 5. Ordered work items

- [ ] 1. Initialize the repo and tooling skeleton.
      `git init` (do not commit). Create `package.json` (`"name": "mission-app"`, `"private": true`, `"type"` omitted) with scripts:
      `dev: next dev`, `build: next build`, `start: next start`, `lint: eslint .`, `pretypecheck: next typegen`, `typecheck: tsc --noEmit`, `test: vitest --run`, `test:watch: vitest`, `test:e2e: playwright test`, `format: prettier --write .`, `format:check: prettier --check .`.
      Create `.npmrc` (`save-exact=true`), `.gitignore` (`node_modules/`, `.next/`, `out/`, `next-env.d.ts`, `*.tsbuildinfo`, `.env*` + `!.env.example`, `playwright-report/`, `test-results/`, `blob-report/`, `playwright/.cache/`, `coverage/`, `.agents/screenshots/`, `.vercel`, `npm-debug.log*`, `.DS_Store`).
      Install the exact versions from section 3 with `npm install --save-exact <pkg>@<ver> ...` and `npm install --save-exact -D ...`. Confirm package.json has no `^`/`~`.
      Files: package.json, package-lock.json, .npmrc, .gitignore
      Verify: `npm ls --depth=0` exits 0 with no `UNMET`/`invalid` entries; `Select-String -Path package.json -Pattern '"[\^~]'` returns nothing.

- [ ] 2. Add TypeScript, Next, Tailwind/PostCSS, ESLint and Prettier config, plus the i18n wiring and a minimal locale layout/home so the app builds.
      - `tsconfig.json`: `target ES2022`, `lib [dom, dom.iterable, esnext]`, `strict: true`, `noUncheckedIndexedAccess: true`, `noEmit`, `module esnext`, `moduleResolution bundler`, `resolveJsonModule`, `isolatedModules`, `jsx: react-jsx` (Next may rewrite it; accept Next's rewrite), `incremental`, `allowJs: false`, `skipLibCheck: true`, `esModuleInterop: true`, `types: ["node"]`, `plugins: [{ name: "next" }]`, `paths: { "@/*": ["./src/*"] }` (no `baseUrl`; it is deprecated in TS 6), `include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]`, `exclude: ["node_modules"]`. If TS 6 complains about the side-effect `import "./globals.css"`, add `src/types/css.d.ts` with `declare module "*.css";`.
      - `next.config.ts`: `createNextIntlPlugin('./src/i18n/request.ts')` wrapping `{ reactStrictMode: true, poweredByHeader: false }`.
      - `postcss.config.mjs`: `export default { plugins: { "@tailwindcss/postcss": {} } }`.
      - `eslint.config.mjs` (flat): `defineConfig([...nextVitals, ...nextTs, prettierFlat, globalIgnores([".next/**","out/**","next-env.d.ts","playwright-report/**","test-results/**",".agents/**","coverage/**"])])` importing `eslint-config-next/core-web-vitals`, `eslint-config-next/typescript`, `eslint-config-prettier/flat`, and `defineConfig, globalIgnores` from `eslint/config`.
      - `.prettierrc.json`: `{ "plugins": ["prettier-plugin-tailwindcss"], "tailwindStylesheet": "./src/app/globals.css" }`; `.prettierignore`: `.next`, `node_modules`, `package-lock.json`, `playwright-report`, `test-results`, `.agents`, `next-env.d.ts`.
      - `src/i18n/routing.ts`: `defineRouting({ locales: ['en','ne'], defaultLocale: 'en', localePrefix: 'always', localeDetection: false })`; export `type AppLocale`.
      - `src/i18n/navigation.ts`: `export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)`.
      - `src/i18n/request.ts`: `getRequestConfig(async ({ requestLocale }) => { const requested = await requestLocale; const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale; return { locale, timeZone: 'UTC', messages: (await import(\`../../messages/${locale}.json\`)).default }; })`.
      - `src/proxy.ts`: `export default createMiddleware(routing); export const config = { matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)' };`
      - `src/types/next-intl.d.ts`: `declare module 'next-intl' { interface AppConfig { Locale: (typeof routing.locales)[number]; Messages: typeof import('../../messages/en.json'); } }`.
      - `messages/en.json` / `messages/ne.json` with a minimal `Metadata` namespace (full content in item 6). `ne.json` starts with `"_note": "Demo translations (machine-assisted). They must be reviewed by a native Nepali speaker before launch."`.
      - `src/app/globals.css`: `@import "tailwindcss";` (tokens added in item 3).
      - `src/app/[locale]/layout.tsx`: `generateStaticParams` → both locales; validate with `hasLocale` else `notFound()`; `setRequestLocale(locale)`; render `<html lang={locale}><body><NextIntlClientProvider>{children}</NextIntlClientProvider></body></html>`. `src/app/[locale]/page.tsx`: temporary heading via `getTranslations`. `src/app/not-found.tsx`: `'use client'`, own `<html lang="en"><body>` with a simple "Page not found" + link to `/en`.
      Files: tsconfig.json, next.config.ts, postcss.config.mjs, eslint.config.mjs, .prettierrc.json, .prettierignore, src/i18n/*, src/proxy.ts, src/types/next-intl.d.ts, messages/*.json, src/app/globals.css, src/app/[locale]/layout.tsx, src/app/[locale]/page.tsx, src/app/not-found.tsx
      Verify: `npm run lint`, `npm run typecheck`, `npm run build` all exit 0; build output lists `/en` and `/ne` as prerendered (●/SSG).

- [ ] 3. Design tokens, fonts and global styles.
      In `globals.css` add a Tailwind v4 `@theme` block: colors `--color-navy: #1E2A44; --color-navy-deep: #141C2F; --color-ivory: #FBF8F3; --color-beige: #EDE4D3; --color-gold: #B8924A; --color-gold-dark: #8A6A2F;` (white is built in); `--font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif; --font-serif: var(--font-lora), Georgia, "Times New Roman", serif;`; `--animate-fade-up: fade-up 600ms cubic-bezier(.2,.6,.2,1) both;` with `@keyframes fade-up { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }`.
      Base layer: `html { background: var(--color-ivory); color: var(--color-navy); }`, `body { font-family: var(--font-sans); font-size: 1.0625rem /* 17px */; line-height: 1.6; }` (18px from `md` up), headings `font-family: var(--font-serif)`, `html:lang(ne) { --font-sans: var(--font-noto-sans-deva), var(--font-inter), sans-serif; --font-serif: var(--font-noto-serif-deva), var(--font-lora), serif; } html:lang(ne) body { line-height: 1.75; }`, a global `:focus-visible { outline: 2px solid var(--color-gold-dark); outline-offset: 3px; }` (on navy surfaces components use `focus-visible:outline-gold`), `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; } }`, `.gold-rule` utility (`@utility gold-rule { height: 1px; width: 4rem; background: var(--color-gold); }`).
      In `[locale]/layout.tsx` load fonts with `next/font/google`: `Lora({ subsets:['latin'], variable:'--font-lora', display:'swap' })`, `Inter({ subsets:['latin'], variable:'--font-inter', display:'swap' })`, `Noto_Sans_Devanagari({ subsets:['devanagari','latin'], variable:'--font-noto-sans-deva', display:'swap', preload:false })`, `Noto_Serif_Devanagari({ subsets:['devanagari','latin'], variable:'--font-noto-serif-deva', display:'swap', preload:false })`. If next/font demands explicit weights for a family, use `weight: ['400','500','600','700']`. Apply `lora.variable inter.variable` always and the two Noto variables only when `locale === 'ne'` on `<html>`; body gets `bg-ivory text-navy antialiased`.
      Files: src/app/globals.css, src/app/[locale]/layout.tsx
      Verify: `npm run build` exits 0 (fonts download); `npm run lint` passes.

- [ ] 4. Site config, nav config, utilities and the UI component library, with unit tests and Vitest setup.
      - `src/config/site.ts`: `export const siteConfig = { name: 'Demo Ministry', email: 'hello@example.org', siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000', social: [{ key: 'facebook', label: 'Facebook' }, { key: 'youtube', label: 'YouTube' }, { key: 'instagram', label: 'Instagram' }], isDemo: true } as const;` with a comment that Phase 4 replaces it with a DB-backed settings table. Export `getSiteConfig()` returning it (the seam to swap later).
      - `src/config/navigation.ts`: `mainNav = [{ key: 'home', href: '/' }, about, devotionals, missions, media, prayer, support, contact]` and `legalNav = [privacy, terms]` (hrefs locale-less; rendered with next-intl `Link`).
      - `src/lib/cn.ts`: `cn(...inputs) => twMerge(clsx(inputs))`.
      - Components in `src/components/ui/` (all accept `className`, forward native props, use `cn`):
        - `Button`: props `variant: 'primary'|'secondary'|'ghost'|'gold'` (default primary), `size: 'sm'|'md'|'lg'` (default md), optional `href`. With `href` it renders a plain `next/link` `<Link>`; callers pass an already-localized href built with `localizedHref(locale, '/about')` from `src/lib/i18n-path.ts` (keeps Button free of next-intl so it is trivially unit-testable). Without `href` renders `<button type="button">` by default. Variants: primary = `bg-navy text-white hover:bg-navy-deep`; secondary = `border border-navy text-navy bg-transparent hover:bg-navy/5`; ghost = `text-navy hover:bg-beige/60`; gold = `bg-gold text-navy hover:bg-[#a9843f]`. Min height 44px for md/lg (touch target). Focus ring visible. Export `buttonVariants()` helper.
        - `Card` (white bg, `border border-beige`, rounded-lg, subtle shadow, optional `as` article), plus `CardBody`, `CardTitle` (serif), `CardMeta`.
        - `Badge` (neutral, gold-outline, navy variants) and `DemoBadge` (`label` prop, default text passed by caller from messages; small uppercase, `border border-gold-dark text-gold-dark bg-white`, with `aria-label` equal to visible text — not hidden).
        - `SectionHeader`: `eyebrow?`, `title`, `description?`, `align: 'left'|'center'`, `as: 'h1'|'h2'` (default h2), `tone: 'light'|'beige'|'dark'` (chooses eyebrow color per the contrast table), gold rule under the title.
        - `VerseBlock`: props `text`, `reference`, `translation` (e.g. "WEB"), `note?`, `badge?: ReactNode`; renders `<figure>` with `<blockquote>` (serif, large, decorative gold quote mark `aria-hidden`), `<figcaption>` "— {reference} ({translation})". When `note` present renders it below in small text.
        - `Container` (max-w-6xl, px-5 sm:px-8), `Skeleton` (`aria-hidden`, `motion-safe:animate-pulse`, beige), `EmptyState` (icon slot, `title`, `description`, optional action; `role="status"`).
        - Form primitives: `Label` (`htmlFor`, required marker with sr text), `Input` / `Textarea` (props `invalid?`, `errorId?`; set `aria-invalid` and `aria-describedby` = errorId when invalid; `focus-visible:ring-2 ring-gold-dark`), `FieldError` (`id`, `role="alert"` only when message present, renders null when empty), `Checkbox` (native `<input type="checkbox">` with associated label prop, 20px, visible focus ring). Not used on pages yet; exercised by tests.
        - `index.ts` barrel.
      - `src/components/brand/Logo.tsx`: inline SVG (32–40px): a slender navy cross with a small gold circle/rays behind it, `role="img"` + `aria-label` = site name when standalone, or `aria-hidden` when next to visible name text (prop `decorative`). Same motif in `public/logo.svg` and `src/app/icon.svg`.
      - Vitest: `vitest.config.mts` with `@vitejs/plugin-react`, `test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], include: ['src/**/*.test.{ts,tsx}'], css: false }`, `resolve.alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }`. `src/test/setup.ts`: `import '@testing-library/jest-dom/vitest'; import { afterEach } from 'vitest'; import { cleanup } from '@testing-library/react'; afterEach(() => cleanup());`. Tests import `describe/it/expect` from `vitest` explicitly (no globals).
      - Tests: `Button.test.tsx` (renders `<button>` by default; each variant applies its class; `href` renders an `<a>` with that href and no `<button>`; size classes), `VerseBlock.test.tsx` (text in blockquote; caption contains "John 3:16" and "(WEB)"; note rendered when given), `EmptyState.test.tsx`, `FormField.test.tsx` (Input with `invalid` + `errorId` has `aria-invalid="true"` and `aria-describedby` pointing to the FieldError; `getByLabelText` finds Input and Checkbox).
      Files: src/config/*, src/lib/cn.ts, src/components/ui/*, src/components/brand/Logo.tsx, public/logo.svg, src/app/icon.svg, vitest.config.mts, src/test/setup.ts
      Verify: `npm test` — all tests pass; `npm run lint` and `npm run typecheck` pass.

- [ ] 5. Demo content and the data-access module, with tests.
      - `src/content/demo/types.ts`: `LocalizedText = { en: string; ne: string }`; `PostType = 'DEVOTIONAL'|'ARTICLE'|'MINISTRY_UPDATE'|'BIBLE_STUDY'|'TESTIMONY'`; `DemoPost { id; type; title: LocalizedText; slug; excerpt: LocalizedText; scriptureRefs: string[]; publishedAt: string (ISO); featured?: boolean; isDemo: true }`; `EventKind = 'MISSION_TRIP'|'OUTREACH'|'SERVICE'|'ANNOUNCEMENT'`; `EventStatus = 'UPCOMING'|'COMPLETED'`; `DemoEvent { id; kind; title: LocalizedText; slug; startsAt: string; location: LocalizedText; status; isDemo: true }`; `DemoVerse { id; reference: string; translation: 'WEB'; text: string; isDemo: true }`; `MediaKind = 'SERMON'|'VIDEO'|'AUDIO'`; `DemoMedia { id; kind; title: LocalizedText; description: LocalizedText; durationMinutes: number; publishedAt; featured?: boolean; thumbnailUrl: null; isDemo: true }`. Comment: shapes mirror the planned Prisma models (Phase 4).
      - `posts.ts`: 6 posts (at least 3 `MINISTRY_UPDATE`, 2 `DEVOTIONAL` with one `featured`, 1 `BIBLE_STUDY`). Titles generic and explicitly demo, e.g. "Sample ministry update: preparing for a community outreach" / Nepali equivalent. No `TESTIMONY` records (avoid fake testimonials). Dates in 2026. No names of real people, churches, or places beyond generic ("a village community", "Kathmandu Valley (sample location)" is acceptable as generic).
      - `events.ts`: 4 events, 3 `UPCOMING` (2027 dates, kinds MISSION_TRIP, OUTREACH, SERVICE) and 1 `COMPLETED`.
      - `verses.ts`: exact WEB text, use verbatim:
        - `isaiah-6-8` (featured): reference "Isaiah 6:8", text: `I heard the Lord’s voice, saying, “Whom shall I send, and who will go for us?” Then I said, “Here I am. Send me!”`
        - `john-3-16`: reference "John 3:16", text: `For God so loved the world, that he gave his only born Son, that whoever believes in him should not perish, but have eternal life.`
        - `psalm-23-1`: reference "Psalm 23:1", text: `Yahweh is my shepherd: I shall lack nothing.`
      - `media.ts`: 3 items (2 SERMON, 1 VIDEO), `thumbnailUrl: null`, two `featured`.
      - `src/lib/content.ts` (server-only use, no `'use client'`): view-model types `PostSummary`, `EventSummary`, `VerseView`, `MediaSummary`, `FeaturedItem` (discriminated union `{ kind: 'post' } | { kind: 'media' }`), all with `isDemo`. Functions (all `async`, to match a future DB): `getRecentUpdates(locale, limit = 3)` (MINISTRY_UPDATE, newest first), `getFeaturedContent(locale, limit = 3)` (featured media + featured devotionals, newest first), `getUpcomingEvents(locale, limit = 3)` (status UPCOMING, soonest first), `getFeaturedVerse()` (isaiah-6-8), `getVerseById(id)`. Locale resolution picks `text[locale]`.
      - `src/lib/content.test.ts`: limits respected; updates sorted desc and only MINISTRY_UPDATE; events only UPCOMING sorted asc; `ne` returns Nepali titles; every returned item has `isDemo: true`; featured verse has `translation: 'WEB'`; a scan of all demo data (JSON.stringify) contains no "tax-deductible"/"tax deductible"/"501(c)".
      Files: src/content/demo/*, src/lib/content.ts, src/lib/content.test.ts
      Verify: `npm test` passes; `npm run typecheck` passes.

- [ ] 6. Messages (en + ne) and the locale-path helper, with tests.
      - Fill `messages/en.json` namespaces: `Metadata` (siteDescription, per-page `{ title, description }` for home, about, devotionals, missions, media, prayer, support, contact, privacy, terms, notFound), `Nav` (home, about, devotionals, missions, media, prayer, support, contact, privacy, terms), `Header` (supportCta "Support the Mission", openMenu, closeMenu, menuTitle, mainNavLabel), `LanguageSwitcher` (label "Language", en "English", ne "नेपाली"), `SkipLink` ("Skip to main content"), `DemoBanner` ("This site shows demonstration content."), `Common` (demoBadge "Demo content", comingSoon, viewAll, readMore, minutes "{count} min", videoPlaceholder "Video placeholder"), `Home` (hero eyebrow, hero title uses `{name}`, missionStatement — generic and clearly demo, ctaLearnMore "Learn More", ctaPrayer "Prayer Request", ctaSupport "Support the Mission"; verse eyebrow/title; verseNoteNe; intro title/body; updates title/description/empty title/empty description; featured title/description/empty…; events title/description/empty…; ctaBand title/body/primary/secondary), `PostTypes` / `EventKinds` / `MediaKinds` labels, `Placeholder` (body "This page is coming in a later phase.", backHome), `NotFound` (title, body, backHome), `Footer` (missionLine — demo, navHeading, contactHeading, socialHeading, placeholder "(placeholder)", legalHeading, copyright "© {year} {name}. Demonstration site.").
      - `messages/ne.json`: same keys plus top-level `"_note"` (see item 2). Provide reasonable Nepali, e.g. Home "गृहपृष्ठ", About "हाम्रो बारेमा", Devotionals "भक्ति चिन्तन", Missions "मिसनहरू", Media "मिडिया", Prayer "प्रार्थना", Support "सहयोग", Contact "सम्पर्क", Privacy "गोपनीयता", Terms "सर्तहरू", "Support the Mission" → "मिसनलाई सहयोग गर्नुहोस्", "Prayer Request" → "प्रार्थना अनुरोध", "Learn More" → "थप जान्नुहोस्", "Demo content" → "नमूना सामग्री", banner → "यो साइटमा नमूना (डेमो) सामग्री देखाइएको छ।", `verseNoteNe` → "नेपाली अनुवाद पछि थपिनेछ; हाल अंग्रेजी WEB पाठ देखाइएको छ।" No Bible verse text in Nepali.
      - Support page/ctaBand copy must be about "supporting the mission" generally, with no tax, charity status or statistics wording in either language.
      - `src/lib/i18n-path.ts`: `stripLocale(pathname): string` and `switchLocalePath(pathname: string, target: AppLocale): string` — handles `/en` → `/ne`, `/en/about` → `/ne/about`, `/ne/missions/` → `/en/missions` (trailing slash trimmed), `/` and `''` → `/ne`, a path without a locale prefix (`/about`) → `/ne/about`, and does not mangle segments that merely start with a locale string (`/english-page` → `/ne/english-page`). Also `localizedHref(locale, href)` used by Button callers (`'/'` → `/en`, `'/about'` → `/en/about`).
      - Tests: `i18n-path.test.ts` covering all of the above; `messages.test.ts` asserting en and ne have identical flattened key sets (ignoring `_note`), ne has `_note`, no value in either file is empty, and neither file contains "Demo Ministry" (name must come from config) or tax-deductible wording.
      Files: messages/en.json, messages/ne.json, src/lib/i18n-path.ts, src/lib/i18n-path.test.ts, src/lib/messages.test.ts
      Verify: `npm test` passes; `npm run typecheck` passes (typed messages via AppConfig).

- [ ] 7. Site layout: skip link, demo banner, header with desktop nav + mobile menu + language switcher, footer.
      - `SkipLink`: first focusable element, `sr-only focus:not-sr-only` styled pill, `href="#main-content"`.
      - `DemoBanner`: thin full-width bar above the header, `bg-beige text-navy text-sm`, centered, small info icon `aria-hidden`; `role="note"`.
      - `Header` (server): sticky `top-0`, white/ivory with bottom `border-gold/30` hairline; left: `Logo decorative` + `siteConfig.name` in serif linking to `/{locale}`; center/right at `xl`: `DesktopNav` (client; `aria-label` from messages; highlights active link with `aria-current="page"` and gold underline); `LanguageSwitcher`; `Button variant="gold"` "Support the Mission" (hidden below `sm`); `MobileMenu` trigger visible below `xl`.
      - `MobileMenu` (client): Radix `Dialog.Root` controlled; `Dialog.Trigger` is a 44×44 button with hamburger icon and visible-to-SR label "Open menu" (Radix sets `aria-expanded`/`aria-controls`; if not present on the trigger, set `aria-expanded={open}` explicitly); `Dialog.Portal` + `Dialog.Overlay` (navy/40) + `Dialog.Content` as a right-side panel (`w-[min(22rem,100%)]`, ivory bg) with `Dialog.Title` (sr-visible "Menu"), close button, the nav list (`<nav aria-label>`), `LanguageSwitcher`, and the Support CTA. Close the dialog on link click (`onClick={() => setOpen(false)}`) and on route change. Escape and focus trap come from Radix; focus returns to the trigger on close. Add `aria-describedby={undefined}` on Content to silence Radix's missing-description warning.
      - `LanguageSwitcher` (client): reads `usePathname()` from `next/navigation` and `useLocale()`; renders `<nav aria-label={t('label')}>` with two `next/link` anchors `href={switchLocalePath(pathname, l)}`, `hrefLang={l}`, `lang={l}`, `aria-current` on the current locale; separated by a thin gold divider. Accept a `tone` prop for light/dark surfaces.
      - `Footer` (server): `bg-navy-deep text-white/80`, top gold hairline; columns: brand + `missionLine` + DemoBadge; nav list (mainNav); contact (`mailto:` `siteConfig.email`) and social placeholders (non-link, see decision 10); bottom row: Privacy, Terms links and copyright with current year and `siteConfig.name`. Link focus rings use `outline-gold`.
      - Update `[locale]/layout.tsx`: `<body>` → `SkipLink`, `DemoBanner`, `Header`, `<main id="main-content" tabIndex={-1} className="focus:outline-none">{children}</main>`, `Footer`. Add `generateMetadata` in the layout setting `metadataBase: new URL(siteConfig.siteUrl)`, `title: { default: siteConfig.name, template: \`%s | ${siteConfig.name}\` }`, `description` from messages, `applicationName`, `icons`.
      Files: src/components/layout/*, src/app/[locale]/layout.tsx
      Verify: `npm run lint`, `npm run typecheck`, `npm run build` pass.

- [ ] 8. SEO helper, home page sections, placeholder pages, localized 404, sitemap and robots.
      - `src/lib/metadata.ts`: `buildPageMetadata({ locale, path, title, description }): Metadata` returning `title`, `description`, `alternates: { canonical: \`/${locale}${path === '/' ? '' : path}\`, languages: { en: '/en…', ne: '/ne…', 'x-default': '/en…' } }`, `openGraph: { type: 'website', siteName: siteConfig.name, title, description, url: canonical, locale: locale === 'ne' ? 'ne_NP' : 'en_US', alternateLocale: [other] }`, `twitter: { card: 'summary', title, description }`.
      - Every page exports `generateMetadata({ params })` that awaits params, calls `getTranslations({ locale, namespace: 'Metadata' })` and `buildPageMetadata`. Every page and the layout call `setRequestLocale(locale)` before translation calls.
      - Home `src/app/[locale]/page.tsx` (server) composes, in order, with alternating backgrounds (ivory / white / beige band) and generous vertical spacing (`py-20 md:py-28`):
        1. `Hero`: ivory background with a soft beige radial wash and a thin gold rule; eyebrow, `<h1>` with `siteConfig.name` (serif, `text-4xl sm:text-5xl lg:text-6xl`), mission statement paragraph followed by `DemoBadge`; three CTAs: Learn More (`primary`, → `/about`), Prayer Request (`secondary`, → `/prayer`), Support the Mission (`gold`, → `/support`). Buttons stack full-width on mobile, inline from `sm`. `animate-fade-up motion-reduce:animate-none`.
        2. `FeaturedVerse`: white band, centered `VerseBlock` with the featured verse, `translation="WEB"`, `badge={<DemoBadge/>}`, and on `ne` `note={t('verseNoteNe')}` (the blockquote element gets `lang="en"` on `ne` pages so screen readers pronounce it correctly).
        3. `MinistryIntro`: two-column on `md` (SectionHeader + paragraphs; decorative SVG/gold-framed beige panel on the side — no stock photos), DemoBadge.
        4. `RecentUpdates` (beige band): SectionHeader + 3 `Card`s (type badge, date via `getFormatter().dateTime(..., { dateStyle: 'medium' })`, title, excerpt, scripture refs, DemoBadge, "Read more" → `/devotionals`). Grid `sm:grid-cols-2 lg:grid-cols-3`. Accept `items` prop; when empty render `EmptyState`.
        5. `FeaturedContent` (ivory): cards; media cards show a 16:9 placeholder thumbnail (navy gradient + gold play icon `aria-hidden`, sr text "Video placeholder"), duration; devotional cards show scripture ref. Links → `/media` or `/devotionals`. EmptyState when empty. No iframes/external embeds.
        6. `UpcomingEvents` (white): cards with a date tile (month/day), kind badge, title, location with pin icon, DemoBadge; link → `/missions`. EmptyState when empty.
        7. `CtaBand`: navy band, white serif heading, `text-white/85` body, buttons `gold` (Support the Mission) + a white-outline secondary (Prayer Request) — add an `onDark` style for secondary via className (`border-white text-white hover:bg-white/10`).
        Section components take data + translated strings via props or `getTranslations` (server) — keep them server components.
      - `RecentUpdates.test.tsx`: render with `items={[]}` and labels props → EmptyState title visible; with 2 items → 2 articles. (Design `RecentUpdates` as a presentational component receiving `items` and `labels` props so it is testable without next-intl; the page does the data fetching/translation.)
      - `PlaceholderPage` component: `Container`, `SectionHeader as="h1"` with page title, a "coming in a later phase" paragraph, DemoBadge, and a link back home. Create pages `about, devotionals, missions, media, prayer, support, contact, privacy, terms` under `src/app/[locale]/<route>/page.tsx` each using it plus `generateMetadata`. The `prayer` and `contact` pages show `siteConfig.email` as plain text; no forms yet.
      - `src/app/[locale]/not-found.tsx`: localized (uses `useTranslations('NotFound')`), h1 + body + link home; `src/app/[locale]/[...rest]/page.tsx`: `notFound()`.
      - `src/app/sitemap.ts`: for each route `['', '/about', '/devotionals', '/missions', '/media', '/prayer', '/support', '/contact', '/privacy', '/terms']` and each locale, an entry `{ url: \`${siteUrl}/${locale}${route}\`, lastModified: new Date(), alternates: { languages: { en, ne } } }`. `src/app/robots.ts`: `{ rules: [{ userAgent: '*', allow: '/' }], sitemap: \`${siteUrl}/sitemap.xml\` }`.
      Files: src/lib/metadata.ts, src/components/home/*, src/components/PlaceholderPage.tsx, src/app/[locale]/**/page.tsx, src/app/[locale]/not-found.tsx, src/app/[locale]/[...rest]/page.tsx, src/app/sitemap.ts, src/app/robots.ts
      Verify: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` pass; build output shows all 10 routes × 2 locales prerendered plus `/sitemap.xml` and `/robots.txt`.

- [ ] 9. `.env.example` and README.
      - `.env.example`: `NEXT_PUBLIC_SITE_URL=http://localhost:3000` (documented: used for metadataBase, canonical/hreflang URLs, sitemap). Then commented-out, value-less placeholders grouped by future phase: `# DATABASE_URL=` (Neon Postgres, Phase 4), `# AUTH_SECRET=` (Auth.js, Phase 5), `# RESEND_API_KEY=` and `# CONTACT_TO_EMAIL=` (Resend email, Phase 6), `# NEXT_PUBLIC_TURNSTILE_SITE_KEY=` / `# TURNSTILE_SECRET_KEY=` (Cloudflare Turnstile spam protection, Phase 6), `# BLOB_READ_WRITE_TOKEN=` (Vercel Blob media storage, Phase 7; Cloudinary is an acceptable alternative), `# STRIPE_SECRET_KEY=` / `# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=` / `# STRIPE_WEBHOOK_SECRET=` (Stripe, USD, Phase 8). No real values. No AWS/S3 variables.
      - `README.md`: project summary (bilingual demo site, "Demo Ministry" placeholder, all content is demo), tech stack with pinned versions, prerequisites (Node 24, npm 11), setup (`npm install`, copy `.env.example` to `.env.local`, `npm run dev`), scripts table (dev, build, start, lint, typecheck, test, test:e2e, format, format:check; `npx playwright install chromium` once), project structure (from section 4), i18n notes (add strings to both message files; Nepali needs native review; Bible text policy WEB/KJV only), content notes (`src/content/demo` + `src/lib/content.ts` seam; site name in `src/config/site.ts`), design tokens + contrast rules (section 2), and phase roadmap: 1 design system ✅, 2 layout + home ✅, 3 core pages, 4 DB/content with Prisma + Neon Postgres, 5 auth/admin with Auth.js (OWNER + max 3 EDITORs), 6 prayer/contact forms (Resend email, Turnstile, Zod), 7 media uploads (Vercel Blob; Cloudinary alternative), 8 Stripe donations in USD, 9 hardening + deployment to Vercel. Include a note: no tax-deductible claims until legal status is verified. No mention of AWS/S3/SES/Cognito/RDS/Amplify.
      Files: .env.example, README.md
      Verify: `npm run format:check` passes (run `npm run format` first if needed); `Select-String -Path README.md,.env.example -Pattern 'S3|AWS|Amazon|SES|Cognito|RDS|Amplify|tax-deductible' ` returns nothing (supporting check, not a substitute for builds).

- [ ] 10. Playwright config and E2E + a11y + screenshot specs.
      - `playwright.config.ts`: `testDir: './e2e'`, `fullyParallel: true`, `retries: process.env.CI ? 2 : 0`, `reporter: [['list'], ['html', { open: 'never' }]]`, `use: { baseURL: 'http://localhost:3210', trace: 'on-first-retry', reducedMotion: 'reduce' }`, `projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]`, `webServer: { command: 'npm run build && npm run start -- -p 3210', url: 'http://localhost:3210/en', reuseExistingServer: !process.env.CI, timeout: 300_000, stdout: 'pipe' }`.
      - `routing.spec.ts`: `/` → final URL ends with `/en`; `/en` and `/ne` each: `html[lang]` equals the locale, the three hero CTAs are visible by accessible name (EN: "Learn More", "Prayer Request", "Support the Mission"; NE: the Nepali strings imported from `messages/ne.json`), the demo banner is visible; an unknown path `/en/does-not-exist` returns 404 status and shows the localized not-found heading; `/sitemap.xml` and `/robots.txt` return 200.
      - `navigation.spec.ts`: for both locales and every route in mainNav + legalNav, `page.goto` returns status 200 and an `h1` is visible; plus at 1280px click each desktop nav link from home and assert URL + `h1` (no 404 text).
      - `mobile-menu.spec.ts` at viewport 375×812: Tab from page start (skip link first) until the menu trigger is focused (or `trigger.focus()` after asserting it is reachable in tab order); press Enter → dialog visible, trigger `aria-expanded="true"`; Tab cycles within the dialog (focused element stays inside `[role=dialog]` after several Tabs); Escape → dialog hidden, `aria-expanded="false"`, focus back on trigger; re-open with Space and close via the close button with Enter; selecting a nav link via keyboard navigates and closes the menu. Also assert `document.documentElement.scrollWidth <= 375` (no horizontal overflow).
      - `language-switcher.spec.ts`: on `/en/about` click the "नेपाली" link → URL `/ne/about`, `html[lang=ne]`; on `/ne/missions` click "English" → `/en/missions`; on `/en` → `/ne`. Do it at 1280 (header switcher) and at 375 (switcher inside the mobile menu).
      - `a11y.spec.ts`: for `/en` and `/ne` at 1280 and 375, `new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()`; filter `impact === 'serious' || impact === 'critical'`; expect `[]` (print violation ids + targets on failure). Also scan with the mobile menu open at 375.
      - `screenshots.spec.ts`: for locales `en`, `ne` and widths `375, 768, 1280` (height 900): set viewport, `goto('/{locale}')`, `await page.evaluate(() => document.fonts.ready)`, wait for network idle, `page.screenshot({ path: path.join(process.cwd(), '.agents', 'screenshots', \`home-${locale}-${width}.png\`), fullPage: true })`; also assert no horizontal overflow (`scrollWidth <= width`). Additionally capture `home-ne-375-menu-open.png` with the mobile menu open. `process.cwd()` is the project root when run via `npm run test:e2e`, so files land in `c:\Users\rasaily\Downloads\mission app\.agents\screenshots\`.
      - Install the browser: `npx playwright install chromium`.
      Files: playwright.config.ts, e2e/*.spec.ts
      Verify: `npm run test:e2e` — all specs pass; 7 PNGs exist in `.agents\screenshots\`.

- [ ] 11. Visual review and polish loop (mandatory, by looking at the images).
      Open every PNG in `c:\Users\rasaily\Downloads\mission app\.agents\screenshots\` with the image-reading tool and check: no horizontal overflow or clipped text; header fits at 1280 in both locales (no wrapping nav items, CTA not squashed); the mobile menu panel is clean at 375; hero CTAs wrap cleanly; cards align with consistent heights; Devanagari renders as real glyphs (no tofu boxes, matras/conjuncts intact, adequate line-height); palette matches tokens (ivory page, beige bands, navy text/footer, thin gold rules, gold CTA with navy text); DemoBadges and the demo banner are visible; footer readable. Fix any issue, re-run `npm run test:e2e`, and re-inspect the regenerated images. Record what was seen per screenshot in the final report.
      Files: whichever components need polish
      Verify: `npm run test:e2e` passes after fixes and fresh screenshots look correct.

- [ ] 12. Final verification and hygiene report (no commit).
      Run, in order, and report each exit status: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run format:check`, `npm run test:e2e`.
      Secrets/env checks: `git status --porcelain` shows no `.env`/`.env.local` files (only `.env.example`); search the source for `process.env.` — only `NEXT_PUBLIC_SITE_URL` (in `src/config/site.ts`) and `process.env.CI` (in `playwright.config.ts`); confirm no `'use client'` file reads a non-`NEXT_PUBLIC_` variable; confirm no keys/tokens in any file. Confirm no `^`/`~` in package.json, no AWS/S3/SES/Cognito/RDS/Amplify mentions, no "tax-deductible"/"501(c)" wording, no non-WEB Bible text, and that "Demo Ministry" appears only in `src/config/site.ts` (plus README/docs). Delete any temp files created during verification. Leave all changes uncommitted (`git init` done, nothing committed).
      Files: none (report only)
      Verify: all commands exit 0; checks above produce no findings.

## 6. Verification checklist (for the reviewer)

1. `npm run lint`, `npm run typecheck`, `npm run build` exit 0.
2. `npm test` (vitest --run) passes: Button, VerseBlock, EmptyState, form fields, RecentUpdates empty state, i18n-path, messages parity, content module.
3. `npm run test:e2e` passes: `/` → `/en`; 3 CTAs + correct `<html lang>` on `/en` and `/ne`; every nav/legal link 200 with h1 in both locales; mobile menu keyboard open/trap/Escape/focus-return at 375; switcher preserves path; axe has no serious/critical violations for home in both locales (desktop + mobile + menu open).
4. Screenshots `home-{en,ne}-{375,768,1280}.png` + `home-ne-375-menu-open.png` exist in `.agents\screenshots\` and were actually viewed: polished, no overflow/overlap, Devanagari renders, palette matches.
5. No secrets; only `NEXT_PUBLIC_` vars client-side; `.env.example` has only `NEXT_PUBLIC_SITE_URL` set and commented placeholders.
6. Content policy: demo badges + banner present; WEB verses with reference + translation; `/ne` shows English WEB text with note; no tax-deductible/charity-status claims; `ne.json` has `_note`.
7. No AWS/Amazon services mentioned anywhere; Vercel Blob (Cloudinary alt) and Resend used in roadmap/env placeholders.
8. Exact versions pinned; repo initialized with git, nothing committed.

## 7. Known gaps and assumptions

- Nepali UI strings are machine-assisted and flagged with `_note`; a native speaker must review.
- "Learn More" CTA targets `/about` (a placeholder page in this phase).
- Card links go to section index pages until detail pages exist (Phase 3/4).
- Demo dates are fixed (2026 posts, 2027 events) and the stored `status` drives "upcoming"; Phase 4 should compute status from dates.
- If `next typegen` is unavailable or fails, drop the `pretypecheck` script and document that `next-env.d.ts` is created by `npm run build`/`npm run dev`.
- If any pinned version fails to install or build, pick the nearest compatible exact version (verified with `npm view`) and report the change; never use `--force`.
