# Verification report: Demo Ministry, Phases 1 + 2 (iteration 2)

This is iteration 2. `review.json` had verdict CHANGES_REQUESTED with 5 findings. Work is in the project root. Nothing is committed (`git log`: "your current branch 'master' does not have any commits yet").

## Findings addressed

| # | Finding | Status | Change |
|---|---|---|---|
| 1 | (blocking) Nepali demo titles contained machine-made scripture | fixed | `src/content/demo/posts.ts`: post-4 `title.ne` is now "नमूना भक्ति चिन्तन: यशैया ६:८ मा परमेश्वरको बोलावट" and post-5 `title.ne` is now "नमूना भक्ति चिन्तन: भजनसंग्रह २३ मा भरोसा". Both are descriptive (reference + topic) and have no quoted or verse-like text. New test in `src/lib/content.test.ts`: no Nepali post title/excerpt, event title or media title may contain `“ ” "` |
| 2 | Gold button hover dropped navy text to ~4.1:1 | fixed | New token `--color-gold-light: #c9a55f` in `globals.css` (comment: hover only). `Button.tsx` gold variant now uses `hover:bg-gold-light`. Computed contrast: navy `#1E2A44` (L≈0.0235) on `#C9A55F` (L≈0.401) ≈ **6.1:1**, up from the resting 4.9:1. No raw hex is left in `src/` (`a9843f` search: 0 hits) |
| 3 | README/.env.example name Amazon S3, but plan says Vercel Blob | fixed (user picked Option B: no AWS) | README roadmap 7 now reads "Media uploads to Vercel Blob". In `.env.example`, the Phase 7 `S3_*` block is replaced by a commented `BLOB_READ_WRITE_TOKEN=`. A repo-wide case-insensitive search (node_modules, .next and generated reports excluded) for `S3|AWS|Amazon|SES|Cognito` finds no hits outside the `.agents/tasks` workflow docs |
| 4 | Footer demo badge was hand-rolled, without `data-demo-badge` | fixed | `DemoBadge` in `src/components/ui/Badge.tsx` now takes `tone: "light" \| "dark"` (default `light`, so existing usages are unchanged). The dark tone uses a gold border/text/dot on transparent. `Footer.tsx` now uses `<DemoBadge tone="dark" …/>`, so it carries `data-demo-badge` |
| 5 | README roadmap step 6 has no email provider | fixed (Option B) | README roadmap 6 now ends "email notifications via Resend". `.env.example` Phase 6 adds commented `RESEND_API_KEY=` and `CONTACT_TO_EMAIL=` |

## Commands run (this iteration)

| # | Command | Result | Key output |
|---|---|---|---|
| 1 | `npm run format` | pass | All files written/unchanged |
| 2 | `npm run lint` | pass | `eslint .` exit 0 |
| 3 | `npm run typecheck` (`next typegen` + `tsc --noEmit`) | pass | exit 0 |
| 4 | `npm test` (`vitest --run`) | pass | **8 files, 55 tests passed** (54 before + the new Nepali-quote test) |
| 5 | `npm run build` | pass | Next 16.4.3. `/en`, `/ne` and 9 placeholder routes × 2 locales SSG; `/robots.txt`, `/sitemap.xml`, `/icon.svg` static; `/[locale]/[...rest]` dynamic; Proxy |
| 6 | `npx playwright install chromium` | pass | exit 0 (already installed) |
| 7 | `npx playwright test --reporter=list` (same as `npm run test:e2e`, with the list reporter) | pass | **36 passed (32.9s)**. webServer did build + start on port 3210 |
| 8 | `npm run format:check` | pass | "All matched files use Prettier code style!" |
| 9 | Secrets/env scan (grep `process.env.`, key patterns, `.env*` files) | pass | see below |
| 10 | After the docs-only S3 → Vercel Blob / Resend change: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build` | pass | exit 0 each. No code changed, so the unit and E2E results above still hold |

### Axe results (wcag2a/2aa/21a/21aa)
- `/en` 1280: 0 violations (22 passes); `/en` 375: 0 (23); `/en` menu open: 0 (24)
- `/ne` 1280: 0 (22); `/ne` 375: 0 (24); `/ne` menu open: 0 (24)
- No violations at any impact level, so none are serious or critical. Axe doesn't test hover states, so finding 2 was checked by computing the contrast (above).

### E2E coverage (unchanged from iteration 1, all passing)
`/` → `/en`. Home in `/en` and `/ne` shows 3 CTAs, the correct `html[lang]`, the demo banner and "Isaiah 6:8 (WEB)". Localized 404s. sitemap/robots. hreflang and OG. Every route × locale returns 200 with an h1. Desktop nav clicks and footer legal links work. At 375px the mobile menu passes keyboard checks: skip link first, Enter/Space open, focus trap, Escape closes and focus returns, aria-expanded. No horizontal overflow. The language switcher preserves the path at 1280 and 375. 7 screenshots.

## Screenshots (`c:\Users\rasaily\Downloads\mission app\.agents\screenshots\`), regenerated this run
- `home-en-375.png` (375×8220)
- `home-en-768.png` (768×6475)
- `home-en-1280.png` (1280×5144)
- `home-ne-375.png` (375×7911)
- `home-ne-768.png` (768×6294)
- `home-ne-1280.png` (1280×5158)
- `home-ne-375-menu-open.png` (375×812)

### What I saw when I opened each image
- **home-ne-1280**: Beige demo banner at the top. The header fits on one line (logo, "Demo Ministry", 8 Devanagari nav items with गृहपृष्ठ underlined in gold, English | नेपाली, gold CTA pill). Hero with eyebrow "विश्वास · आशा · सेवा", Lora h1, mission line, demo badge and 3 CTAs (navy, outline, gold). The verse band shows English WEB Isaiah 6:8 with "— Isaiah 6:8 (WEB)" and the Nepali note. The featured devotional card now reads **"नमूना भक्ति चिन्तन: यशैया ६:८ मा परमेश्वरको बोलावट"**, wrapping onto two lines inside the card with no quote marks. Updates, featured and events grids are 3 columns with equal heights. The navy CTA band is followed by the deep-navy footer. The footer demo badge (now `DemoBadge tone="dark"`) looks the same as before: gold outline pill with a gold dot under the mission line. Devanagari conjuncts and matras are intact (प्रार्थना, सम्पर्क, गर्नुहोस्), with no tofu. No overflow or overlap.
- **home-en-1280**: Same layout in English. The featured devotional keeps the WEB quote "Sample devotional: “Here I am. Send me!”". The footer DEMO CONTENT badge is a gold outline on navy, the same as before. The palette is ivory/beige/navy/gold as specified.
- **home-ne-768**: The header shows logo, the gold CTA pill and the hamburger. The hero CTAs sit on one row. Cards are 2 columns, so the third card wraps onto a second row (intended). The renamed devotional title wraps over two lines with no clipping. The footer is 2 columns. No overflow.
- **home-en-768**: Same structure as ne-768. Clean, no overflow.
- **home-ne-375**: Single column. The hero CTAs stack full-width. The new devotional title wraps cleanly in its card. Devanagari renders correctly throughout. The footer stacks, and the dark demo badge is visible. No horizontal overflow.
- **home-en-375**: Single column. Everything is stacked and readable, with no overflow.
- **home-ne-375-menu-open**: Right-side ivory panel over a dimmed page. Title "मेनु" with a close ×, 8 serif nav items (the active गृहपृष्ठ sits on a beige pill with a gold bar), then the English | नेपाली switcher and the full-width gold "मिसनलाई सहयोग गर्नुहोस्" button. Clean.

The palette matches the tokens in every image. The gold hover shade can't be seen in static screenshots and was verified by calculation.

## Secrets / env check
- `process.env.` in project files (node_modules and .next excluded): only `NEXT_PUBLIC_SITE_URL` (`src/config/site.ts`) and `process.env.CI` (`playwright.config.ts`, test tooling).
- `"use client"` files (`DesktopNav.tsx`, `LanguageSwitcher.tsx`, `MobileMenu.tsx`) don't read `process.env`.
- A key-pattern search (`sk_live|sk_test|pk_live|AKIA…|BEGIN … PRIVATE|ghp_…|password=`) over src, e2e, messages, README and .env.example found nothing.
- The only `.env*` file in the root is `.env.example`. It sets only `NEXT_PUBLIC_SITE_URL=http://localhost:3000`; future variables are commented-out and have no values.

## Open issues
- Findings 3 and 5 are resolved: the user chose no AWS (Vercel Blob for media, Resend for email). The task spec's "Media on Amazon S3" line is superseded by that decision.
- Nepali UI strings are machine-assisted and need native-speaker review (`_note` in `ne.json`).
- npm 11 `allowScripts` warnings from install (iteration 1). No functional impact.
- Generated artifacts (`.next/`, `test-results/`, `playwright-report/`, screenshots) are git-ignored. No temp files were created.
