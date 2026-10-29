# Verification: Zelle and bank transfer giving

Iteration 1 (no review.json yet). Branch `master`, HEAD `5b76d6c`, no commit made in this step.
All commands ran with cwd = `c:/Users/rasaily/Downloads/mission app` (Windows, PowerShell).

## Dev database safety (`mission_dev`)

Read-only check script (`pg`, `node --env-file=.env`, printing no emails or secrets), deleted after use:

| When | Output |
|---|---|
| Before any change | `{"database":"mission_dev","activeOwners":1,"ministryName":"Bible Distribution Ministry","offlineGivingEnabled":"column not present"}` |
| After `prisma migrate dev` | `{"database":"mission_dev","activeOwners":1,"ministryName":"Bible Distribution Ministry","offlineGivingEnabled":"false"}` |
| After the full test + E2E runs | `{"database":"mission_dev","activeOwners":1,"ministryName":"Bible Distribution Ministry","offlineGivingEnabled":"false"}` |

No reset, wipe or seed was run against `mission_dev`. The user's dev server on :3000 and Postgres (127.0.0.1:54329) were left running.
`npm run e2e:prepare` ran with `DATABASE_URL`/`DIRECT_URL` set to `mission_test` (the script refuses any other URL) and reported
`e2e:prepare seeded mission_test: 6 posts, 4 events, 3 verses, 9 media.` Unit/DB tests use `mission_unit`.

## Migration

1. `npm run db:migrate -- --create-only --name zelle_bank_offline_giving` -> exit 0, created `prisma/migrations/20261028233148_zelle_bank_offline_giving/migration.sql`.
2. Reviewed SQL: purely additive, no DROP / ALTER COLUMN / RENAME / CREATE TABLE:

```sql
-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankAddress" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "bankRoutingNumber" TEXT,
ADD COLUMN     "bankShowAccountDetails" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bankSwiftCode" TEXT,
ADD COLUMN     "offlineGivingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "offlineGivingNoteEn" TEXT,
ADD COLUMN     "offlineGivingNoteNe" TEXT,
ADD COLUMN     "zelleEmail" TEXT,
ADD COLUMN     "zellePhone" TEXT,
ADD COLUMN     "zelleQrAltEn" TEXT,
ADD COLUMN     "zelleQrAltNe" TEXT,
ADD COLUMN     "zelleQrUrl" TEXT,
ADD COLUMN     "zelleRecipientName" TEXT;
```

3. `npm run db:migrate` -> exit 0: "Applying migration `20261028233148_zelle_bank_offline_giving`" ... "Your database is now in sync with your schema." No drift, no reset prompt. Then `npx prisma generate` -> exit 0.

## 1. Static checks and build (final run, after all changes)

| Command | Exit | Key output |
|---|---|---|
| `npm run lint` | 0 | no findings |
| `npm run typecheck` | 0 | `prisma generate && next typegen`, then `tsc --noEmit` clean |
| `npm run format:check` | 0 | "All matched files use Prettier code style!" |
| `npm run build` | 0 | "Compiled successfully"; `/[locale]/support` stays dynamic (ƒ) |

## 2. Unit + DB tests: `npm test`

Exit 0. **Test Files 100 passed (100), Tests 1045 passed (1045)** (baseline 1004, +41).

New or extended test files:

- `src/lib/validation/settings-offline.test.ts` (new): blank / whitespace / missing -> null for all 14 string fields, toggles default false, `"on"` -> true; phone accepts `(555) 010-0199`, `+1 555.010.0199`, rejects `12345`, `555-CALL-NOW`, `(((---)))`, 21 chars; email lower-cased, invalid rejected; routing ` 021-000-021 ` -> `021000021`, `123456789` and 8 digits -> `ROUTING_MSG`; account `0001 2345 6789` -> `000123456789`, `123` / `12ab34` / 18 digits -> `ACCOUNT_NUMBER_MSG`; SWIFT `bofaus3n` -> `BOFAUS3N`, `CHASUS33XXX` ok, `BOFAUS` / `1234US33` / `BOFAUS3NX` -> `SWIFT_MSG`; QR alt defaulted to "Zelle QR code for Grace Church" and kept when given; recipient name required with email/phone/QR; details toggle without numbers -> `BANK_DETAILS_MISSING_MSG`; `javascript:` QR -> `URL_MSG`.
- `src/lib/validation/common.test.ts`: `isValidAbaRouting` (valid `011000015`, `021000021`, `121000358`; invalid checksum / length / letters / empty) and `optionalEmail`.
- `src/lib/offline-giving.test.ts` (new): hidden when toggle off (even if full), when all empty, with only a note, with only a recipient name, with whitespace-only values; Zelle card from name + email; unsafe QR dropped; QR alt ne -> en -> default; bank card with only the bank name; account/routing/SWIFT absent from `JSON.stringify(result)` unless `bankShowAccountDetails`; details present when on; details null when on but numbers empty; note ne -> en fallback with `textLang: "en"`.
- `src/lib/donations/support-view.test.ts`: `supportSections` for open/none, open/offline, not-configured/offline, closed/offline, not-configured/none, closed/none.
- `src/lib/donation-wording.test.ts`: `offlineTaxNote` unverified equals `donationTaxNote`; verified says "may be" / "consult" and never mentions Stripe or a receipt (en + ne).
- `src/components/public/CopyButton.test.tsx` (new): accessible name; clipboard write + "Copied" status; `execCommand` fallback; failure text; status clears after 2 s (fake timers).
- `src/server/actions/actions.db.test.ts`: OWNER save stores normalized values, writes exactly one audit row whose `changed` lists `offlineGivingEnabled`, `bankAccountNumber`, `bankRoutingNumber`, and `JSON.stringify(auditRow)` contains neither `000123456789`, `0001` nor `021000021`; revalidates `/[locale]` layout. Invalid routing -> `VALIDATION` with `fieldErrors.bankRoutingNumber === ROUTING_MSG`, nothing saved, no audit. EDITOR -> `FORBIDDEN`, row untouched, no audit.

## 3. E2E: `npm run e2e:prepare` then `npm run test:e2e`

- `npm run e2e:prepare` -> exit 0 (mission_test only, see above).
- `npm run test:e2e` -> exit 0, **407 passed (8.6m)** (baseline 401, +6), 0 failed, 0 flaky.

New specs (`admin-mutations` project, serial, every test resets the settings in `finally`):

- `e2e/offline-giving.spec.ts`
  - owner fills Zelle + bank: Support (en + ne) shows the cards, numbers hidden — section heading per locale, Zelle/bank before the softened "Other ways" card, `support-not-configured` gone, recipient/email/phone, Copy buttons by accessible name (`copyLabel`), QR image by alt "E2E Zelle QR", steps contain the name, unverified offline tax note, note (ne inside `[lang="en"]`), account/routing/SWIFT absent from `page.content()`, "Contact us" link to `/<locale>/contact`; clipboard copy of the Zelle email shows "Copied" and `readText()` returns `give@example.org`.
  - account details show only after the owner turns them on; axe clean — numbers + Copy buttons on en + ne, contact-for-details gone; axe: `/en/support` 0 violations, `/ne/support` 0, `/admin/settings` 0 (serious/critical 0 each).
  - turning the section off hides it and restores today's card (details stay saved).
  - an invalid routing number is a field error and saves nothing — error summary, `aria-invalid="true"`, message visible, `aria-describedby` contains `f-bankRoutingNumber-error`; Support unchanged.
  - EDITORs can't open Settings or save Zelle/bank details (server-side) — (a) editor redirected to `/admin/forbidden`; (b) owner's real Save request captured and aborted, replayed with the EDITOR session: response contains "You don't have permission to do that."; Support still hidden and the email field still empty.
- `e2e/zelle-bank-screenshots.spec.ts` — 7 screenshots + `scrollWidth <= viewport` on every page.
- Registered in `playwright.config.ts` (`offline-giving.spec.ts` after `admin-settings.spec.ts`, screenshots after `phase9-screenshots.spec.ts`). Shared helpers in `e2e/helpers/offline-giving.ts`.
- `.agents/tasks/phase9/perf.json` was regenerated by the phase9 sweep during the E2E run (expected).

## 4. Screenshots (`.agents/screenshots/zelle-bank/`)

Each image was opened and reviewed. `/brand/logo-mark.png` stands in for the QR.

| File | What I saw |
|---|---|
| `support-en-1280.png` | Header and demo banner unchanged. "Give by Zelle or bank transfer" on white with gold rule; Zelle and Bank cards side by side; small labels in dark gold on white; Copy pills on email, phone, account, routing, SWIFT; numbers in mono; QR in a beige-bordered white box with caption; numbered steps with gold-dark markers; "Stay safe" note with gold-dark left border on ivory. Ivory note box, then the ivory "About Zelle and bank transfers" disclosure ending "Gifts are not tax-deductible.", then the softened "Other ways to take part" card (no "not set up yet"). Navy footer. No overflow. |
| `support-en-375.png` | Cards stack; values and Copy buttons sit on one row and wrap cleanly; QR centred; long text wraps; no horizontal scroll. |
| `support-en-375-details-off.png` | Same with details off: bank card shows bank, holder, address, then the ivory box "Contact us for bank transfer details." with an underlined link; no numbers. |
| `support-ne-1280.png` | Devanagari renders correctly (no tofu) in headings, labels, Copy pills ("कपी गर्नुहोस्"), steps, safety note and disclosure; "Zelle", "SWIFT/BIC", "ABA" stay Latin; English note shown with "नेपाली संस्करण नथपिएसम्म…" line; header shows नेपाली active, otherwise unchanged. |
| `support-ne-375.png` | Stacked layout in Nepali; longer Copy label makes the button wrap below the email value, which is clean; no overflow or clipping. |
| `admin-zelle-bank-1280.png` | Section card "Zelle and bank transfer": intro, master toggle, Zelle h3, recipient, email/phone in two columns, QR picker with preview, bilingual QR description, Bank transfer h3, two-column bank fields, SWIFT, address textarea, bordered gold-dark warning box with bold "Warning:" directly above the details checkbox, then the bilingual note. Sticky Save bar/header made static for this element shot only (first pass showed them stitched over the middle). |
| `admin-zelle-bank-375.png` | Single column, all labels readable and wrapped, warning box fits, no overflow; re-shot after the sticky fix, clean. |

## 5. Secrets and repo hygiene

- `git grep -n -i -E "aws|amazonaws|AKIA" -- . ":!package-lock.json"`: only pre-existing hits (older `.agents/tasks/*` docs, `README.md`, `e2e/helpers/turnstile.ts`, `src/content/legal/legal.test.ts`, `src/lib/validation/media.ts`, a binary match in `public/brand/logo-full.png`). Added lines in `git diff` matching: **0**; matches in the new untracked files: **0**.
- `git grep -n -E "sk_live_…|sk_test_…|whsec_…"` (10+ chars after the prefix): **0** hits.
- `git ls-files .env`: empty (`.env` untracked).
- No real Zelle/bank data anywhere: the seed and `defaultSiteSettings` keep every new field null/false; test data uses example values only (`example.org`, `(555) 010-0199`, the public Chase routing number `021000021` used as a checksum example, `000123456789`).

## Decisions

No review findings yet (first iteration). Implementation choices beyond the plan, with their user-visible effect:

- Copy button text stays "Copy" (it doesn't switch to "Copied"). The status next to it shows and announces "Copied" for 2 s. Effect: the button's accessible name always matches its visible text (WCAG 2.5.3), and sighted users still see "Copied".
- Admin label "Note for donors" (not "Note for donors (optional)"), with the hint starting "Optional." Effect: the bilingual inputs read "Note for donors (English)" instead of a doubled "(optional) (English)".
- The details checkbox's `aria-describedby` points at both the warning box and its hint, so screen readers read the fraud warning when focusing the toggle.
