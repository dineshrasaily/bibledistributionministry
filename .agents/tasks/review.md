# Bilingual Demo Ministry site: design system, layout and home page (Phases 1–2, pass 2)

This pass re-reviews the Phase 1–2 Next.js 16 site after the coder addressed the five findings from pass 1. The site is unchanged in shape. It has a token-based design system, a shared UI kit in `src/components/ui/`, next-intl routing on `/en` and `/ne` with `/` redirecting to `/en`, an accessible header with a Radix mobile menu and a path-preserving language switcher, a home page built from typed demo data read through `src/lib/content.ts`, placeholder pages for every nav route plus privacy/terms, a localized 404, and full SEO metadata. All five pass-1 findings are fixed and confirmed in the code. The coder's report shows every verification suite passing (lint, typecheck, format:check, build, 55 unit tests, 36 E2E tests including axe with zero violations). All seven screenshots were opened and look polished in both locales.

Watch for: nothing blocking. Nepali UI strings are machine-assisted and still need a native-speaker review before launch (confirmed, already flagged by `_note` in `messages/ne.json`). The gold hover shade is verified only by calculation, because axe doesn't test hover states (confirmed).

**Verdict**: APPROVED

## High-level view

The Nepali scripture problem is closed. Post-4 and post-5 `title.ne` are now descriptive titles (reference plus topic: "यशैया ६:८ मा परमेश्वरको बोलावट", "भजनसंग्रह २३ मा भरोसा"). A new test in `src/lib/content.test.ts` fails if any Nepali post, event or media text contains quotation marks, so a quoted verse can't come back silently.

The gold button hover now uses a `--color-gold-light: #c9a55f` token, so contrast goes up on hover (about 6.1:1 with navy text) instead of down, and there are no raw hex values left in `src/`. This adds a seventh colour token beyond the six specified, but it's documented as hover-only and doesn't change the visible palette.

Demo labelling now runs through a single component. `DemoBadge` has a `tone="dark"` variant for navy surfaces, and the footer uses it, so every badge carries `data-demo-badge`.

The AWS conflict is resolved by the user's choice of no AWS. README roadmap 6–7 now name Resend and Vercel Blob, and `.env.example` has commented, empty `RESEND_API_KEY`, `CONTACT_TO_EMAIL` and `BLOB_READ_WRITE_TOKEN` placeholders. The only matches for tax, charity or AWS wording in `src/` and `messages/` are the guard tests themselves.

<details>
<summary>Issues (2)</summary>

1. **Nepali translation review (non-blocking, Phase 3 follow-up)**: all `messages/ne.json` strings and `ne` demo text are machine-assisted. Have a native speaker review them before launch, then update the `_note`.
2. **Hover contrast not covered by tests (non-blocking)**: axe can't check `hover:bg-gold-light`. A unit test that asserts the gold variant's hover class uses the `gold-light` token, or a small contrast-ratio test over the token values in `globals.css`, would stop a regression.

</details>

<details>
<summary>Details</summary>

### Screenshot check

All seven PNGs in `.agents/screenshots/` were opened: `home-en-375.png`, `home-en-768.png`, `home-en-1280.png`, `home-ne-375.png`, `home-ne-768.png`, `home-ne-1280.png` and `home-ne-375-menu-open.png`. There's no horizontal overflow or overlap at any width. At 1280 the header fits on one line in both locales. The beige demo banner sits on top, and the hero has three CTAs (navy, outline, gold). The verse band shows English WEB Isaiah 6:8 with the "Isaiah 6:8 (WEB)" caption, and on `/ne` it adds the Nepali "translation coming later" note. Cards are three columns at 1280, two at 768 (the third wraps, which is intended) and one at 375, where the hero CTAs stack full width. Devanagari renders with intact conjuncts and matras and no tofu. The footer demo badge looks the same as before. The menu-open capture shows the ivory side panel, the active item on a beige pill with a gold bar, the switcher and the full-width gold CTA. The palette matches the tokens throughout.

### Verification evidence

The coder's `verification.md` (iteration 2) records passing runs of `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` (8 files, 55 tests), `npm run build`, and `npx playwright test` (36 passed). The E2E run covers the `/` → `/en` redirect, nav, footer legal links, mobile menu keyboard behaviour (focus trap, Escape and focus return, `aria-expanded`), switcher path preservation at 1280 and 375, hreflang/OG, sitemap/robots, localized 404s, and axe at 1280, at 375 and with the menu open in both locales (zero violations). The README/`.env.example` docs-only change was followed by another format/lint/typecheck/build run. `package.json` pins every version exactly and names the package "mission-app". `.gitignore` excludes `.env*` except `.env.example`. The only client-readable env var is `NEXT_PUBLIC_SITE_URL`. There are no commits on `master`.

</details>

<details>
<summary>File map</summary>

- `src/content/demo/posts.ts`: Nepali titles for post-4 and post-5 rewritten as descriptive titles
- `src/lib/content.test.ts`: new guard that blocks quotation marks in Nepali demo text
- `src/app/globals.css`: added `--color-gold-light` hover token
- `src/components/ui/Button.tsx`: gold variant hover uses `bg-gold-light`
- `src/components/ui/Badge.tsx`: `DemoBadge` gains `tone: "light" | "dark"`
- `src/components/layout/Footer.tsx`: uses `<DemoBadge tone="dark">`
- `README.md`: roadmap 6 (Resend) and 7 (Vercel Blob)
- `.env.example`: Resend and Blob placeholders replace S3
- Everything else is unchanged from pass 1 (tooling, i18n, layout, pages, SEO, tests)

Full change: the untracked working tree in `c:\Users\rasaily\Downloads\mission app` (`git status`; no commits).

</details>
