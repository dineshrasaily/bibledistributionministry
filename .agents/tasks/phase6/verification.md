# Phase 6 verification (prayer request + contact forms)

Run on 2026-10-27, master, working tree uncommitted (the finalize step commits after approval). Windows + PowerShell, Node 24.22.1. Local Postgres was already running (not started by me, left running). The user's `npm run dev` on port 3000 (PID 31116) was not touched; **it must be restarted** to pick up the regenerated Prisma client and the new migration.

## Commands and results (final run, in order)

| # | Command | Exit | Result |
|---|---------|------|--------|
| 1 | `npm run lint` | 0 | clean |
| 2 | `npm run typecheck` | 0 | clean |
| 3 | `npm run format:check` (after `npm run format`) | 0 | "All matched files use Prettier code style!" |
| 4 | `npm run build` | 0 | `/[locale]/prayer` is now dynamic (ƒ), `/[locale]/contact` static, `/admin/inbox/settings` dynamic |
| 5 | `npm test` | 0 | **62 files, 591 tests passed** (Phase 3 total 474, +117) |
| 6 | `npm run test:e2e` | 0 | **232 passed, 0 failed, 0 flaky** (Phase 3 total 179, +53); 52 `[axe]` scans, all `serious/critical=0` |

`npm test` and `npm run test:e2e` were never run at the same time.

### New tests
- Unit: `sanitize-text.test.ts` (control/bidi/ZW chars, ZWJ/ZWNJ kept in Devanagari, NFC, CRLF, blank lines, HTML kept literally), `pii.test.ts` (email, phone incl. `+977 98-1234-5678` and Devanagari digits, whole-word name/email-local-part, verse refs pass), `retention.test.ts` (month-end clamp, leap year, 12/60 months), `turnstile-keys.test.ts` (live only with both keys), `public-share-mappers.test.ts`, `validation/public-forms.test.ts` (**anonymity strips name/email even with an invalid email**, key-style errors, limits after sanitizing, consent default false, contact consent forced false unless TESTIMONY, locale catch, token length, `formRateLimit`), `validation/inbox.test.ts` (publish needs a text + confirmation, 1500 limit, note, retention 1..60, purge literal).
- Unit (mocked fetch, no network): `server/forms/turnstile.test.ts` (test keys: only the dummy token, no fetch; live: urlencoded body with secret/response/idempotency_key and **no remoteip**, success+action passes, `success:false`/wrong action invalid, network error / non-JSON fail closed, dummy token rejected with live keys), `server/notify/email.test.ts` (**no key -> one redacted skip log, no fetch**; no sender -> skip; configured -> one POST to Resend with Bearer key, body keys exactly from/to/subject/text/html with the `/admin/inbox/prayer/<id>` link and none of body/name/email/subject; 500 logs status only, no key/recipient; fetch throw never throws).
- Components (jsdom): `PrayerForm.test.tsx` (labels, consent/anonymous unchecked, anonymous disables + clears and the FormData has no name/email, translated errors via aria-describedby + focus on first invalid field + values kept, rate-limit alert focused, success heading focused + "Send another", honeypot aria-hidden + tabindex -1, token into hidden field), `ContactForm.test.tsx` (consent only for Testimony and reset on change, volunteer link, required labels, error mapping + focus), `TurnstileWidget.test.tsx`.
- DB: `server/forms/public-submission.db.test.ts` — global `fetch` stubbed to throw on any call. Proves: normal prayer stored sanitized with consent off; **"anonymous: name and email are cleared server-side, even an invalid email"**; honeypot = success with 0 rows and 0 attempts; validation = no rows; **"rate limit: 5 per hour per hashed IP; the raw IP is never stored"** (6th = RATE_LIMITED, other form and other IP unaffected, 64-hex hashes, raw IP absent from rows and logs); window reset after 1h and >24h attempt rows deleted; `FORM_RATE_LIMIT_PER_HOUR`; wrong/missing Turnstile token stores nothing; live keys via mocked siteverify (success stored, network failure = TURNSTILE_UNAVAILABLE); **"logs never contain the body, name, email or raw IP"**; contact GENERAL consent forced false, TESTIMONY kept; **link-only Resend body** (mocked).
- DB: `server/services/inbox-publish.db.test.ts` — notes (audit has no note text); **consent gating**: "a prayer without consent cannot be published (no share, no audit)", "a GENERAL message with consent=true still cannot be published", "a TESTIMONY without consent cannot be published"; PII rejection (email, name token, ASCII + Devanagari phone, missing confirmation); publish -> `listPublicShares` keys exactly id/kind/lang/publishedAt/text and none of body/name/email, re-publish updates, audit metadata has no text, unpublish removes; testimony publish; ordering; delete cascades the share + redirect; NOT_FOUND; **EDITOR FORBIDDEN** on retention/purge with nothing changed; retention 0/61 rejected; purge deletes 7-month-old rows with retention 6, keeps 5-month-old, removes their share and >24h attempts, audit counts, last purge date. `inbox.db.test.ts`: every new service export throws UNAUTHENTICATED without a session.
- Static: `guard-coverage.test.ts` (public actions must call `runPublicSubmission(`, public-forms.ts exports only them, pipeline is server-only and not `"use server"`), `privacy-scan.test.ts` (inbox-submit.ts allowed but create-only with exactly two exports; relation keys `prayerRequest:`/`contactMessage:` forbidden outside the inbox modules), `admin-structure.test.ts` (inbox/settings owner-only), `script-imports.test.ts` (7 new pure modules).
- E2E: `prayer-form.spec.ts` (normal submit -> admin list/detail, no publish form, **not on /en or /ne prayer**; anonymous -> fields disabled+empty, admin shows "Anonymous"/"Hidden (anonymous)", typed name absent; consented -> prefilled text with email refused, edited text published, wall shows only edited text, ne falls back with lang=en, axe on the admin detail page, unpublish -> gone in en **and ne**; Nepali submit stored lang=ne; validation error focus/aria/kept values then resubmit; honeypot stores nothing; no Turnstile token -> nothing stored), `contact-form.spec.ts` (general message, no publish; consent box only for Testimony; consented testimony published + unpublished (en+ne checked); testimony without consent has no publish form; Nepali form), `admin-inbox.spec.ts` (note persists and is not public, status, delete via dialog -> "Deleted." toast and 404; owner inbox settings: 0 rejected, 6 saved, service status "test keys"/"not configured", purge toast, recent items kept, axe 1280 + 375; editor forbidden + no nav link), `a11y.spec.ts` (+11 scans: /prayer and /contact en/ne @1280/375, contact with Testimony selected, prayer error state en/ne), `admin-access.spec.ts` (empty-inbox text, `/admin/inbox/settings` in the editor-forbidden list, exact "Settings" link). All Turnstile traffic is answered by a Playwright route stub (`e2e/helpers/turnstile.ts`); no Cloudflare requests.

### Fixes made during verification
- Run 1: test locators (`getByLabel("Private note")` also matched the form's aria-label -> `exact`; public text marker shared a base36 timestamp word with the name marker, so the PII check correctly refused it -> digit-only marker).
- Run 1, real bug: the "Unpublish" InlineAction unmounts when the page refreshes after success, so its effect-based toast never appeared. `InlineAction` now shows the toast from the action wrapper (same messages, also fine for the existing post/verse/user row actions).
- Run 3, real privacy bug found in the screenshots: `prayer-error-ne-375.png` still showed a testimony that had been unpublished (only /en had been re-checked). A withdrawn consent must disappear everywhere immediately, so `/[locale]/prayer` is now `force-dynamic`, and both specs assert en **and** ne after unpublishing. Re-run green.

## Migration
`npx prisma migrate dev --create-only --name phase6_forms_inbox` -> `prisma/migrations/20261027025835_phase6_forms_inbox/migration.sql`, reviewed before applying: only `CREATE TYPE` (FormKind, PublicShareKind), `ALTER TABLE … ADD COLUMN` (adminNote ×2 nullable, `inboxRetentionMonths INTEGER NOT NULL DEFAULT 12`), `CREATE TABLE` (PublicShare, FormSubmissionAttempt), indexes, FKs (PublicShare -> PrayerRequest/ContactMessage `ON DELETE CASCADE`, -> AdminUser `SET NULL`). No DROP/UPDATE. Applied with `npm run db:migrate` (fence + migrate dev), no drift/reset prompt. `npx prisma migrate status`: "Database schema is up to date!".

## mission_dev read-only check (SELECT only, temp pg script outside the repo, deleted afterwards)
| | Before | After all runs |
|---|---|---|
| OWNER accounts | 1 (d***) | 1 (same) |
| ministryName | Bible Distribution Ministry | Bible Distribution Ministry |
| logoUrl | /brand/logo-mark.png | /brand/logo-mark.png |
| isDemo | true | true |
| inboxRetentionMonths | (column absent) | 12 |
| posts / events / media / admins / prayers / messages | 6/4/3/1/0/0 | 6/4/3/1/0/0 |
| migrations | init, phase3 | init, phase3, phase6_forms_inbox |

## Hygiene
- `git grep -i -E "\baws\b|amazon|\bs3\b|cognito|\bses\b"` (new files via `git add -N`, then `git reset`): only the guard assertion in `src/content/legal/legal.test.ts`.
- `NEXT_PUBLIC_`: only the existing `NEXT_PUBLIC_SITE_URL` and the Phase 8 Stripe placeholder; `NEXT_PUBLIC_TURNSTILE_SITE_KEY` removed (the site key is read server-side and passed as a prop).
- Secret patterns (`re_…`, `0x4AAAA`, `sk_live|sk_test`, private keys): only false positives in the migration (`PublicShare_prayerRequestId_key` contains "re_p…"). Tests use obvious placeholders (`re_test_key_never_logged`, `0xLIVE-SECRET`).
- `git ls-files .env` empty; `git check-ignore .env` -> `.env`. No dependency changes (package.json untouched; Resend + Turnstile via plain `fetch`).
- `git status`: only Phase 6 files, plus an untracked `.vscode/` that I did not create (left alone). Nothing committed.

## Screenshots (`.agents/screenshots/phase6/`, 28 files, every capture asserts `scrollWidth <= viewport`)
`prayer-{en,ne}-{375,1280}`, `prayer-anonymous-en-375`, `prayer-error-{en,ne}-375`, `prayer-success-{en,ne}-1280`, `prayer-wall-{en-1280,ne-375}`, `contact-{en,ne}-{375,1280}`, `contact-error-{en,ne}-375`, `contact-testimony-en-1280`, `contact-success-{en-1280,ne-375}`, `admin-prayer-detail-consent-{1280,375}`, `admin-prayer-detail-noconsent-1280`, `admin-message-detail-testimony-1280`, `admin-prayer-list-{1280,375}`, `admin-inbox-settings-{1280,375}`.

Opened and checked:
- `prayer-en-1280.png`: header unchanged (logo + name far left, nav + EN/ने centre, gold CTA right); beige hero; white form card (anonymous, name/email optional, request with counter hint, unticked consent, beige privacy note with link, stub spam box, navy pill button) next to the ivory "How we handle your request" aside with dark-gold bullets. Wall hidden (nothing published).
- `prayer-error-ne-375.png` (after fix): red-bordered form alert, invalid textarea with red border and "कृपया यो भर्नुहोस्।" below; Devanagari renders, no tofu, no overflow; no stale wall.
- `prayer-anonymous-en-375.png`: anonymous ticked; name/email disabled with dashed borders + beige fill (distinct beyond colour), empty.
- `prayer-wall-en-1280.png`: "Shared with permission" section with a gold-outlined "Testimony" card and a neutral "Prayer" card, dates, edited text only (no names, no "Pokhara", no age).
- `admin-prayer-detail-consent-1280.png`: Request / Status / Private note / Public version sections, dark-gold "Before publishing" guidance, prefilled English text, Nepali field, confirmation checkbox, gold publish button, red delete at the bottom; owner nav has "Inbox settings".
- `admin-inbox-settings-375.png`: retention field (6), "Delete old items" panel with cutoff, preview counts, last purge date, red button; form-services status "test keys – not configured" / "Resend not configured"; fits 375 with no overflow.

## Decisions (beyond plan.md)
- `/[locale]/prayer` is rendered per request (`force-dynamic`) so unpublishing takes effect immediately in both locales (found via screenshots).
- `InlineAction` shows its toast from the action wrapper so it survives the button unmounting.
- One shared `inboxNoteSchema` for prayers and messages; NO_CONSENT/NOT_TESTIMONY messages live in `src/lib/validation/inbox.ts` (inbox.ts may only export guarded async functions).
- `purgeOldInbox` also re-checks the OWNER role itself (defence in depth beyond the action role).
- Contact email empty -> "required" (not "invalid email"); errors are i18n keys, `tooLong:<max>` carries the limit.
- The admin note form is labelled "Edit private note" so it does not share an accessible name with its textarea.

## Known limitations
- No automatic purge (owner presses "Delete old items"; README says monthly).
- The prayer wall shows the 12 most recent items, no pagination.
- The PII check is heuristic: it can refuse legitimate words that equal a 3+-letter part of the sender's name (e.g. "grace" for someone named Grace), and it misses names with attached Nepali suffixes (सीताको). The admin confirmation remains the real control.
- With the test Turnstile keys (no keys configured) production forms have no bot challenge; honeypot + rate limit still apply, and a warning is logged.
- The rate-limit key trusts the first `x-forwarded-for` (fine on Vercel, see README).

## User follow-ups
- Restart `npm run dev` (new migration + regenerated Prisma client).
- Create a Cloudflare Turnstile widget and a Resend account (verify the domain), set `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (optionally `CONTACT_TO_EMAIL`) in Vercel, then check Inbox settings.
- Have a native speaker review the new Nepali strings (`_note` updated).
- Re-read the Privacy Policy against the implemented behaviour during the legal review (it currently matches: optional name/email, anonymous, private, consent + edited version, hashed IP for 24 h, Turnstile, link-only Resend, owner-set retention).
