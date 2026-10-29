# Implementation Plan: Zelle and bank transfer giving (Support page + Admin -> Settings)

Root: `c:/Users/rasaily/Downloads/mission app` (contains a space: quote it in every shell command; pass it as `cwd`).
Branch: `master`, no worktree. HEAD `5b76d6c`. Windows + PowerShell.

Pre-existing tree state (checked): `.vscode/settings.json` untracked (leave it untracked, never stage it) and
`.agents/tasks/phase9/perf.json` modified (an informational timing file that `npm run test:e2e` rewrites on every run
via the phase9 sweep). Commit the regenerated `perf.json` together with this feature so the final `git status` shows
only `.vscode/settings.json`.

Hard safety rules (repeat of the brief):

- NEVER reset, wipe or reseed `mission_dev` (real owner data). No `db:reset`, no `prisma migrate reset`, no `db:seed`
  against it. If `prisma migrate dev` reports drift or offers a reset, answer NO / abort and fall back to
  `npx prisma migrate deploy` (applies pending migrations only, never resets); record that in verification.md.
- Do not kill the user's dev server on :3000 and do not stop Postgres (`npm run db:status` only to check it).
  `next build` writes `.next/` while Next 16 dev writes `.next/dev`, so a build is safe while dev runs.
- No demo Zelle/bank data in the seed or defaults; do not pre-fill the user's real data anywhere.
- The account number is never logged or put in audit metadata.

## Decisions (one-line rationale each)

1. Columns live on the `SiteSettings` singleton (one additive migration). Same pattern as `donationsEnabled`/`givingInfo*`; the settings action, cache and revalidation already cover it.
2. All new admin fields go into the existing single Settings form and `settingsSchema` (no separate action). Reuses the OWNER-only `updateSiteSettingsAction` -> `runAdminAction` (guard -> Zod -> tx + AuditLog -> `revalidatePath("/[locale]","layout")`), so EDITORs are blocked server-side and the Support page updates immediately.
3. Audit metadata: keep `changedFields()` (it lists field NAMES only, never values; `src/server/services/shared.ts`). No values of any new field are added to metadata. A DB test proves the account number never appears in the audit row.
4. Normalization in Zod: routing, account number and SWIFT have spaces/hyphens stripped before validation and are stored normalized (digits only / upper-case), so the copy buttons copy clean values.
5. ABA checksum: `3*(d1+d4+d7) + 7*(d2+d5+d8) + (d3+d6+d9) ≡ 0 (mod 10)`, exactly 9 digits.
6. Account number: 4-17 digits after stripping (US account number range). The owner banks in the US (Zelle is US-only); international donors use routing/SWIFT.
7. SWIFT/BIC: upper-cased, structural regex `^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$` (8 or 11 chars). Stricter than "8/11 alphanumeric" but matches the real BIC format, which catches typos.
8. Phone: `^[0-9 ()+\-.]{7,20}$` AND at least 7 digits. "Loose" per brief; the digit count stops values like `(((---)))`.
9. Zelle recipient name becomes required (field error) whenever a Zelle email, phone or QR is set. Donors are told to check the exact name; without it the scam-safety step is meaningless.
10. QR alt: when `zelleQrUrl` is set and `zelleQrAltEn` is blank, Zod fills `"Zelle QR code for <recipient name>"`; if the recipient is also blank the recipient field already errors. This satisfies "alt required" while giving the sensible default. `zelleQrAltNe` stays optional (ne falls back to en).
11. `bankShowAccountDetails` on with account number, routing and SWIFT all blank is a field error on `bankAccountNumber` ("Add the account or routing number, or turn this off."). Avoids a toggle that silently shows nothing.
12. `offlineGivingEnabled` on with no details is allowed (the section just stays hidden); the admin hint says so. This matches the brief's rendering rule.
13. The note (`offlineGivingNote*`) is plain text (`optionalText(500)`), rendered with `whitespace-pre-line`. A memo instruction doesn't need Markdown, and plain text is safer.
14. Tax wording for offline gifts comes from a NEW function `offlineTaxNote(locale, verified)` in `src/lib/donation-wording.ts`. `src/lib/messages.test.ts` forbids `tax-deductible` in message files ("All tax wording lives here"), and the existing verified string mentions Stripe receipts, which is wrong for Zelle/bank.
15. Pure mapper `toOfflineGiving(row, locale)` in a new `src/lib/offline-giving.ts` returns `null` when hidden and only includes account/routing/SWIFT when `bankShowAccountDetails` is true. The server page renders only what the mapper returns, so hidden numbers never reach the HTML.
16. Pure layout resolver `supportSections(kind, hasOffline)` in `src/lib/donations/support-view.ts` decides section order. Unit-testable; the page stays declarative.
17. When Stripe isn't open (`not-configured` or `closed`) and offline giving is shown: the Zelle/bank section comes first, and the "not set up yet / not open" card is replaced by a softer "Other ways to take part" card (email + pray/contact buttons; reuses existing strings, no "not set up" heading). When Stripe is open: the existing Stripe block stays as is, then the Zelle/bank section. When neither: the current state is unchanged (existing E2E `support.spec.ts` keeps passing).
18. `CopyButton` is a small client component that takes its translated strings as props (`labels`) from the server page, so it doesn't depend on client-side messages and is trivial to unit test. Uses `navigator.clipboard.writeText` with an `execCommand("copy")` fallback; a polite live region announces "Copied" / failure.
19. The `Bullet` helper moves out of `support/page.tsx` into `src/components/public/SupportBullet.tsx` so the new section reuses the exact disclosure styling.
20. E2E EDITOR check: the owner's real Save request is intercepted with `page.route` and aborted (so nothing is saved), then replayed byte-for-byte from an EDITOR `APIRequestContext`. This proves the server action itself refuses EDITORs, not just the page redirect. The DB test covers the same case at action level.
21. New E2E specs go into the `admin-mutations` Playwright project (serial, 1 worker) because they change settings; each test restores the settings in `finally`.
22. README gets a short "Zelle and bank transfer (optional)" subsection under the Step 9 donations area plus an Admin guide bullet. Owners need to know where it is and what the account-details warning means.

## Data model

`prisma/schema.prisma`, model `SiteSettings`, add after `givingInfoNe` (keep the aligned-column style, add comments):

```prisma
  offlineGivingEnabled   Boolean @default(false) // master switch: Zelle + bank section on the Support page
  zelleRecipientName     String? // exact name donors see in their bank app; required with email/phone/QR (Zod)
  zelleEmail             String?
  zellePhone             String?
  zelleQrUrl             String? // https URL or site path; filled by the media picker
  zelleQrAltEn           String? // plain text; defaulted by Zod when a QR is set
  zelleQrAltNe           String?
  bankName               String?
  bankAccountName        String? // account holder
  bankAccountNumber      String? // digits only; NEVER logged or put in audit metadata
  bankRoutingNumber      String? // ABA, 9 digits + checksum (Zod)
  bankSwiftCode          String? // BIC, 8 or 11 chars, upper-case
  bankAddress            String?
  bankShowAccountDetails Boolean @default(false) // off: donors see "Contact us for bank transfer details"
  offlineGivingNoteEn    String? // plain text, e.g. memo instructions
  offlineGivingNoteNe    String?
```

Migration name: `zelle_bank_offline_giving`. Expected SQL: only
`ALTER TABLE "SiteSettings" ADD COLUMN ...` statements (two `BOOLEAN NOT NULL DEFAULT false`, the rest `TEXT`).
Any `DROP`, `ALTER COLUMN`, `RENAME` or `CREATE TABLE` means stop and investigate.

## Zod rules (`src/lib/validation/settings.ts` + `common.ts`)

New helpers in `src/lib/validation/common.ts`:

- `optionalEmail()`: blank -> `null`, else `emailSchema` (trim + lower-case + email + max 254).
- `isValidAbaRouting(digits: string): boolean`: `/^\d{9}$/` and checksum from decision 5. Exported for tests.

New messages exported from `settings.ts` (tests and E2E import them):

```ts
export const ZELLE_NAME_REQUIRED_MSG = "Add the recipient name exactly as your bank app shows it.";
export const PHONE_MSG = "Enter a phone number, for example (555) 123-4567.";
export const ROUTING_MSG = "Enter a valid 9-digit US routing number (ABA). Check it for typos.";
export const ACCOUNT_NUMBER_MSG = "Enter the account number using 4 to 17 digits.";
export const SWIFT_MSG = "Enter an 8 or 11 character SWIFT/BIC code, for example BOFAUS3N.";
export const BANK_DETAILS_MISSING_MSG = "Add the account or routing number, or turn this off.";
export const zelleQrDefaultAlt = (name: string) => `Zelle QR code for ${name}`;
```

Fields added to the `z.object({...})`:

| Field | Rule |
|---|---|
| `offlineGivingEnabled` | `checkbox()` |
| `zelleRecipientName` | `optionalText(100)` |
| `zelleEmail` | `optionalEmail()` |
| `zellePhone` | `optionalText(20)` then refine: `/^[0-9 ()+\-.]{7,20}$/` and `(v.match(/\d/g) ?? []).length >= 7`, msg `PHONE_MSG` (null passes) |
| `zelleQrUrl` | `optionalSafeUrl()` |
| `zelleQrAltEn` / `zelleQrAltNe` | `optionalText(300)` |
| `bankName`, `bankAccountName` | `optionalText(100)` |
| `bankAccountNumber` | blank -> null; else strip `[\s-]`, must match `/^\d{4,17}$/`, msg `ACCOUNT_NUMBER_MSG` |
| `bankRoutingNumber` | blank -> null; else strip `[\s-]`, must pass `isValidAbaRouting`, msg `ROUTING_MSG` |
| `bankSwiftCode` | blank -> null; else strip spaces, upper-case, BIC regex (decision 7), msg `SWIFT_MSG` |
| `bankAddress` | `optionalText(300)` |
| `bankShowAccountDetails` | `checkbox()` |
| `offlineGivingNoteEn` / `offlineGivingNoteNe` | `optionalText(500)` |

Build the stripped fields with one local helper, e.g.
`normalizedOptional(strip: (s: string) => string, check: (s: string) => boolean, msg: string)` =
`optionalText(40).transform(v => v == null ? null : strip(v)).refine(v => v == null || check(v), msg)`. The
issue path stays the field name, so `fieldErrorsOf` maps it to the input.

`superRefine` additions (next to the existing About-image rule):

- `(zelleEmail || zellePhone || zelleQrUrl) && !zelleRecipientName` -> issue on `zelleRecipientName`, `ZELLE_NAME_REQUIRED_MSG`.
- `bankShowAccountDetails && !bankAccountNumber && !bankRoutingNumber && !bankSwiftCode` -> issue on `bankAccountNumber`, `BANK_DETAILS_MISSING_MSG`.

`.transform` addition (inside the existing transform, before returning): if `zelleQrUrl && !zelleQrAltEn && zelleRecipientName`
set `zelleQrAltEn = zelleQrDefaultAlt(zelleRecipientName)`. `SettingsInput` type follows automatically.

## Mapper / visibility (`src/lib/offline-giving.ts`, pure, no server-only)

```ts
import type { SiteSettings } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/routing";

export const OFFLINE_GIVING_FIELDS = [
  "offlineGivingEnabled", "zelleRecipientName", "zelleEmail", "zellePhone", "zelleQrUrl",
  "zelleQrAltEn", "zelleQrAltNe", "bankName", "bankAccountName", "bankAccountNumber",
  "bankRoutingNumber", "bankSwiftCode", "bankAddress", "bankShowAccountDetails",
  "offlineGivingNoteEn", "offlineGivingNoteNe",
] as const satisfies readonly (keyof SiteSettings)[];
export type OfflineGivingRow = Pick<SiteSettings, (typeof OFFLINE_GIVING_FIELDS)[number]>;

export type ZelleCard = {
  recipientName: string;
  email: string | null;
  phone: string | null;
  qr: { url: string; alt: string } | null;
};
export type BankDetails = {
  accountNumber: string | null;
  routingNumber: string | null;
  swiftCode: string | null;
};
export type BankCard = {
  bankName: string | null;
  accountName: string | null;
  address: string | null;
  /** null = hidden: show "Contact us for bank transfer details". */
  details: BankDetails | null;
};
export type OfflineGiving = {
  zelle: ZelleCard | null;
  bank: BankCard | null;
  /** textLang "en" when a Nepali page shows the English note. */
  note: { text: string; textLang: "en" | undefined } | null;
};

/** null when the section must not render at all. */
export function toOfflineGiving(row: OfflineGivingRow, locale: AppLocale): OfflineGiving | null;
```

Rules (trim every string; blank = absent):

- `!offlineGivingEnabled` -> `null`.
- `zelle` = card when `recipientName` AND at least one of email / phone / valid QR; else `null`.
  QR is included only when `isSafeUrl(url)` (from `validation/common`), alt = ne alt on `ne` when present, else en alt, else `zelleQrDefaultAlt(recipientName)`.
- `bank` = card when any of bankName / accountName / accountNumber / routing / swift is present; else `null`.
  `details` = `{...}` only when `bankShowAccountDetails` AND at least one of number/routing/swift; otherwise `null`.
  `address` is always included when present (public bank branch address, not sensitive).
- `zelle === null && bank === null` -> return `null` (the note alone never shows the section).
- `note`: same ne -> en fallback as `about-mappers.ts` `section()` (ne when non-blank, else en with `textLang: "en"` on ne pages, else null).

Layout resolver, added to `src/lib/donations/support-view.ts`:

```ts
export type SupportSection = "stripe" | "offline" | "other-ways" | "unavailable";
/** Order of the giving blocks on the Support page. */
export function supportSections(kind: SupportView["kind"], hasOffline: boolean): SupportSection[];
// open + offline       -> ["stripe", "offline"]
// open + none          -> ["stripe"]
// not-configured|closed + offline -> ["offline", "other-ways"]
// not-configured|closed + none    -> ["unavailable"]   (today's card, unchanged)
```

Tax wording, added to `src/lib/donation-wording.ts`:

```ts
/** Tax line for Zelle/bank gifts: same rule, no Stripe receipt claim. */
export function offlineTaxNote(locale: AppLocale, taxDeductibleVerified: boolean): string;
// en unverified: "Gifts are not tax-deductible."   (identical to donationTaxNote)
// en verified:   "Gifts may be tax-deductible; consult your tax advisor."
// ne: the existing ne strings, verified one WITHOUT the Stripe receipt sentence.
```

## Admin section layout (`src/app/admin/(dashboard)/settings/page.tsx`)

A new `<EditorSection title="Zelle and bank transfer">` placed directly after the "Donations" section, before the sticky Save bar. English only. Fields in order:

1. Intro `<p className="text-sm text-navy/80">`: "Let donors give straight from their bank. The section shows on the Support page only when it's turned on and at least one Zelle or bank detail is filled in."
2. `CheckboxField name="offlineGivingEnabled"` label "Show Zelle and bank transfer on the Support page", hint "Turn this off to hide the whole section. Your details stay saved."
3. `<h3 className="font-serif text-lg font-semibold text-navy">Zelle</h3>`
4. `TextField zelleRecipientName` label "Zelle recipient name", maxLength 100, hint "Exactly as your bank app shows it to people who send you money. Donors are asked to check this name before sending."
5. `<div className="grid gap-5 md:grid-cols-2">` with `TextField zelleEmail` (type email, label "Zelle email (optional)", maxLength 254) and `TextField zellePhone` (type tel, inputMode tel, label "Zelle phone (optional)", maxLength 20, hint "US number, for example (555) 123-4567.").
6. `MediaPickerField name="zelleQrUrl"` label "Zelle QR code picture (optional)", `mode={mode}`, `altFields={{ en: "zelleQrAltEn", ne: "zelleQrAltNe" }}`, hint `${IMAGE_FIELD_HINT} In your bank app, open Zelle, find "My QR code", save it as a picture and upload it here.` (the picker already lists/uploads images only: `kind: "image"`, `accept="image"`).
7. `BilingualField name="zelleQrAlt"` label "QR code description", maxLength 300, hint 'Leave empty to use "Zelle QR code for <recipient name>".'
8. `<h3>Bank transfer</h3>`
9. Grid (md 2 cols): `TextField bankName` "Bank name" (100), `TextField bankAccountName` "Account holder name" (100).
10. Grid (md 2 cols): `TextField bankAccountNumber` "Account number" (inputMode numeric, autoComplete "off", maxLength 40), `TextField bankRoutingNumber` "Routing number (ABA, 9 digits)" (inputMode numeric, autoComplete "off", maxLength 40).
11. `TextField bankSwiftCode` "SWIFT/BIC code (optional, for gifts from outside the US)", maxLength 20, `className`/style upper-case not required (Zod upper-cases).
12. `TextAreaField bankAddress` "Bank address (optional)", rows 3, maxLength 300, hint "Usually only needed for international transfers."
13. Warning box (rendered BEFORE the checkbox so it is read first), same classes as the existing tax note but stronger: `role="note" id="bank-details-warning" className="rounded-lg border-2 border-gold-dark bg-beige/60 px-4 py-3 text-sm text-navy"`, content: `<span className="font-semibold">Warning: </span>` + "Anyone can see your full account and routing numbers when this is on, and they can be misused for check or ACH fraud. Leave it off and donors will see 'Contact us for bank transfer details' instead, or use Zelle."
14. `CheckboxField bankShowAccountDetails` label "Show the account, routing and SWIFT numbers on the Support page", hint "Off is safer. Read the warning above before turning this on."
15. `BilingualField name="offlineGivingNote"` label "Note for donors (optional)", multiline, rows 3, maxLength 500, hint "For example: Please write 'Bibles' in the memo."

Field errors use the existing `useFieldError` / `aria-invalid` / `aria-describedby` wiring that `TextField`, `CheckboxField`, `BilingualField` and `MediaPickerField` already have; nothing new needed.

## Public Support page layout (`src/app/[locale]/support/page.tsx`)

Page logic:

```ts
const offline = toOfflineGiving(row, locale);
const sections = supportSections(view.kind, offline !== null);
const offlineTax = offlineTaxNote(locale, row.taxDeductibleVerified);
```

Render the "How gifts are used" section unchanged, then map `sections` in order:

- `"stripe"`: the existing `view.kind === "open"` section JSX, unchanged (`data-testid="support-open"`).
- `"unavailable"`: the existing not-configured/closed section JSX, unchanged (`data-testid="support-${view.kind}"`).
- `"offline"`: `<OfflineGivingSection giving={offline} locale={locale} email={email} taxNote={offlineTax} />`.
- `"other-ways"`: new softened card, section `aria-labelledby="support-other-ways-title" data-testid="support-other-ways" className="border-t border-beige bg-ivory py-14 md:py-20"`, `Container max-w-3xl` > `Card` > `CardBody`: gold rule, h2 `t("otherWaysTitle")`, `t.rich("emailUs")`, Pray + Contact buttons (same as today). No "not set up yet" heading or body.

Extract the page's local `Bullet` into `src/components/public/SupportBullet.tsx` (`export function SupportBullet`) and use it in both places; keep `Heading`/`linkClass` local or move `linkClass` too (export from the same file as `supportLinkClass`).

New `src/components/public/OfflineGivingSection.tsx` (async server component, `getTranslations({ locale, namespace: "SupportPage" })`):

```
<section aria-labelledby="support-offline-title" data-testid="support-offline"
         className="border-t border-beige bg-white py-14 md:py-20">
  <Container className="flex max-w-5xl flex-col gap-8">
    header: h2#support-offline-title (font-serif text-3xl sm:text-4xl text-navy) t("offlineTitle"),
            gold-rule, p text-lg text-navy/85 t("offlineIntro")
    <div className={cn("grid gap-6", zelle && bank && "md:grid-cols-2")}>
      Zelle card  (Card, data-testid="support-zelle")
        h3 font-serif text-2xl "Zelle"
        <dl> rows (CopyRow): recipientName, email (break-all), phone — each value + CopyButton
        QR (when set): figure, white box border-beige p-3, `relative mx-auto size-48 sm:size-56`,
             SiteImage fill sizes="224px" className="object-contain" alt={qr.alt}; figcaption t("zelleQrCaption")
        h4 t("zelleStepsTitle") + <ol class="list-decimal ps-5"> zelleStep1, zelleStep2, zelleStep3({name})
        scam note: role="note" border-l-4 border-gold-dark bg-ivory px-4 py-3 text-sm, bold t("zelleSafetyTitle") + t("zelleSafetyBody")
      Bank card   (Card, data-testid="support-bank")
        h3 t("bankTitle")
        <dl> bankName, accountName, address (whitespace-pre-line) — no copy buttons
        details ? CopyRows: account number, routing number, SWIFT (font-mono tracking-wide break-all)
                : <p data-testid="bank-contact-for-details"> t.rich("bankContactForDetails", { link → localizedHref(locale, "/contact") })
    </div>
    note (when set): border-l-4 border-gold bg-ivory rounded-lg px-6 py-5, small uppercase label t("offlineNoteTitle")
         in text-gold-dark, <p lang={note.textLang} className="whitespace-pre-line text-lg text-navy">; when textLang
         render t("englishOnly") under it (existing key)
    <aside aria-labelledby="support-offline-about" data-testid="support-offline-disclosure"
           className="rounded-lg border border-beige bg-ivory p-6 sm:p-8">
      h3#support-offline-about t("offlineAboutTitle"), gold-rule, <ul> SupportBullet:
        t("offlineDirectNote"), t("offlineNotProcessedNote"),
        t.rich("offlineReceiptNote", { email, link: mailto }),
        <span data-testid="support-offline-tax-note">{taxNote}</span>
    </aside>
  </Container>
</section>
```

`CopyRow` is a tiny local component in the same file: `<div className="flex flex-col gap-1 border-b border-beige/70 py-3 last:border-0">`, `<dt className="text-sm font-semibold tracking-wide text-gold-dark">`, `<dd className="flex flex-wrap items-center justify-between gap-3">` with `<span className="min-w-0 break-all text-lg text-navy">` + `<CopyButton>`. Mobile (375 px): values wrap, the button drops under the value; no horizontal overflow.

New `src/components/public/CopyButton.tsx` (`"use client"`):

```ts
type Props = {
  value: string;
  /** Accessible name, e.g. "Copy Zelle email". */
  label: string;
  labels: { copy: string; copied: string; failed: string };
};
```

- `<Button type="button" variant="secondary" size="sm" aria-label={label}>` showing `labels.copy` (or `labels.copied` for 2 s after success), plus a sibling `<span role="status" aria-live="polite" className="text-sm text-gold-dark">` that receives `labels.copied` or `labels.failed`, then clears after 2 s (timer cleared on unmount).
- Copy: `navigator.clipboard?.writeText(value)`; when missing or rejected, fallback: temporary off-screen `<textarea readonly>`, `select()`, `document.execCommand("copy")`; if that returns false -> failed state.
- Page passes `labels={{ copy: t("copy"), copied: t("copied"), failed: t("copyFailed") }}` and `label={t("copyLabel", { field: t("zelleEmailLabel") })}`.

## Messages (`messages/en.json` + `messages/ne.json`, namespace `SupportPage`)

Add these keys to both files (identical key sets; `messages.test.ts` enforces parity, no empty values, and NO "tax-deductible" text):

| Key | en |
|---|---|
| `offlineTitle` | Give by Zelle or bank transfer |
| `offlineIntro` | You can also give straight from your bank account. These gifts go directly to the ministry. |
| `zelleTitle` | Zelle |
| `zelleRecipientLabel` | Recipient name |
| `zelleEmailLabel` | Zelle email |
| `zellePhoneLabel` | Zelle phone |
| `zelleQrCaption` | Scan this code with your bank app. |
| `zelleStepsTitle` | How to give with Zelle |
| `zelleStep1` | Open your bank app and choose Zelle. |
| `zelleStep2` | Scan the QR code, or enter the email or phone number above. |
| `zelleStep3` | Check that the name shows exactly "{name}" before you send. |
| `zelleSafetyTitle` | Stay safe: |
| `zelleSafetyBody` | We will never ask you to send money to a different name, email or phone number. If anything looks different, don't send it and contact us first. |
| `bankTitle` | Bank transfer |
| `bankNameLabel` | Bank |
| `bankAccountNameLabel` | Account holder |
| `bankAccountNumberLabel` | Account number |
| `bankRoutingLabel` | Routing number (ABA) |
| `bankSwiftLabel` | SWIFT/BIC (international) |
| `bankAddressLabel` | Bank address |
| `bankContactForDetails` | <link>Contact us</link> for bank transfer details. |
| `offlineNoteTitle` | Please note |
| `offlineAboutTitle` | About Zelle and bank transfers |
| `offlineDirectNote` | Zelle and bank transfers are sent directly between banks and can't be reversed. |
| `offlineNotProcessedNote` | They aren't processed by this website. |
| `offlineReceiptNote` | No receipt is sent automatically. Email <link>{email}</link> if you would like one. |
| `copy` | Copy |
| `copied` | Copied |
| `copyFailed` | Couldn't copy. Please select the text instead. |
| `copyLabel` | Copy {field} |

ne: reasonable Nepali for each (e.g. `offlineTitle` "Zelle वा बैंक ट्रान्सफरमार्फत दान गर्नुहोस्", `copy` "कपी गर्नुहोस्", `copied` "कपी भयो", `bankContactForDetails` "बैंक ट्रान्सफरको विवरणका लागि <link>हामीलाई सम्पर्क गर्नुहोस्</link>।"). Keep "Zelle", "SWIFT/BIC", "ABA" in Latin script; keep `{name}`, `{email}`, `{field}` and `<link>` tags exactly. Append to the top-level `_note`: " Zelle/bank transfer strings added; review with the rest." (must still match `/native/i`).

Tax strings go ONLY in `src/lib/donation-wording.ts` (decision 14).

## Ordered work items

- [ ] 1. Record the dev-DB baseline (read-only) before touching anything.
      Run `npm run db:status` (Postgres must already be up; if not, `npm run db:start`). Then a read-only check, using a temp script `.agents/tasks/zelle-bank/check-dev.mjs` that uses `pg` with `process.env.DATABASE_URL` and prints: the database name (`select current_database()`, must be `mission_dev`), `select count(*) from "AdminUser" where role='OWNER' and "isActive"`, and `select "ministryName" from "SiteSettings" where id='singleton'`. Run it with `node --env-file=.env ".agents/tasks/zelle-bank/check-dev.mjs"`. Don't print emails or secrets. Keep the script until item 11, then delete it.
      Files: `.agents/tasks/zelle-bank/check-dev.mjs` (temp), `.agents/tasks/zelle-bank/verification.md` (start it).
      Verify: output shows `mission_dev`, owner count >= 1, ministryName "Bible Distribution Ministry"; paste into verification.md.

- [ ] 2. Schema + additive migration + defaults.
      Add the 16 columns (Data model above) to `prisma/schema.prisma`. Add the same keys to `defaultSiteSettings` in `src/config/site.ts` (`offlineGivingEnabled: false`, `bankShowAccountDetails: false`, every string `null`); the `satisfies` clause enforces completeness. `prisma/seed-lib.ts` needs no change (it spreads the defaults; `update: {}` never touches existing rows).
      Commands (cwd = root): `npm run db:migrate -- --create-only --name zelle_bank_offline_giving` -> open `prisma/migrations/<ts>_zelle_bank_offline_giving/migration.sql`, confirm it's only `ALTER TABLE "SiteSettings" ADD COLUMN` lines -> `npm run db:migrate` (applies it to mission_dev, regenerates the client). If drift/reset is offered: abort and use `npx prisma migrate deploy` (decision in the safety rules). Then `npx prisma generate`.
      Files: `prisma/schema.prisma`, `prisma/migrations/<timestamp>_zelle_bank_offline_giving/migration.sql`, `src/config/site.ts`.
      Verify: `npm run typecheck` exits 0; re-run the item 1 check script (owner + ministry name unchanged); paste the migration SQL into verification.md.

- [ ] 3. Zod rules + helpers + unit tests.
      Implement `optionalEmail`, `isValidAbaRouting` in `common.ts` and the new fields, messages, `superRefine` and transform in `settings.ts` exactly as in "Zod rules".
      Tests (extend existing files, same style as `admin.test.ts`/`common.test.ts`):
      - `src/lib/validation/common.test.ts`: `isValidAbaRouting` true for `011000015`, `021000021`, `121000358`; false for `011000016`, `123456789`, `12345678`, `0210000210`, `02100002a`.
      - New `src/lib/validation/settings-offline.test.ts` (parse with `{ ministryName: "X", contactEmail: "a@b.org", ... }`):
        blanks (`""`, `" "`, missing) -> every new string field `null`, both toggles `false`; `offlineGivingEnabled: "on"` -> true;
        phone accepts `(555) 010-0199`, `+1 555.010.0199`; rejects `12345` (too short), `555-CALL-NOW`, `(((---)))`, 21+ chars -> `PHONE_MSG` on `zellePhone`;
        `zelleEmail` lower-cases `Give@Example.org`, rejects `not-an-email`;
        routing ` 021-000-021 ` -> stored `021000021`; `123456789` -> `ROUTING_MSG` on `bankRoutingNumber`;
        account `0001 2345 6789` -> `000123456789`; `123` and `12ab34` -> `ACCOUNT_NUMBER_MSG`;
        SWIFT `bofaus3n` -> `BOFAUS3N`, `CHASUS33XXX` ok; `BOFAUS` (6), `1234US33`, `BOFAUS3NX` (9) -> `SWIFT_MSG`;
        QR set + alt blank + recipient "Grace Church" -> `zelleQrAltEn === "Zelle QR code for Grace Church"`; QR set + alt "My QR" keeps it;
        email/phone/QR set without recipient -> `ZELLE_NAME_REQUIRED_MSG` on `zelleRecipientName`;
        `bankShowAccountDetails: "on"` with no number/routing/SWIFT -> `BANK_DETAILS_MISSING_MSG` on `bankAccountNumber`; with routing only -> ok;
        `zelleQrUrl: "javascript:alert(1)"` -> `URL_MSG`.
      Files: `src/lib/validation/common.ts`, `src/lib/validation/settings.ts`, `src/lib/validation/common.test.ts`, `src/lib/validation/settings-offline.test.ts`.
      Verify: `npx vitest run --project unit src/lib/validation` passes; `npm run typecheck` exits 0.

- [ ] 4. Pure logic: mapper, layout resolver, tax wording + unit tests.
      Create `src/lib/offline-giving.ts` (signatures and rules above), add `supportSections` to `src/lib/donations/support-view.ts`, add `offlineTaxNote` to `src/lib/donation-wording.ts`.
      Tests:
      - New `src/lib/offline-giving.test.ts` (row built from `defaultSiteSettings` + overrides): null when the toggle is off even with everything filled; null when on but all fields empty; null when on with only the note; null when on with only `zelleRecipientName`; zelle card with email only; QR dropped when the URL is unsafe; QR alt ne -> en -> default fallback; bank card with only `bankName`; `details === null` (and no account number anywhere in `JSON.stringify(result)`) when `bankShowAccountDetails` is false; details present when true; details null when true but number/routing/SWIFT empty; note ne -> en fallback with `textLang: "en"` on ne, `undefined` on en; whitespace-only values treated as empty.
      - `src/lib/donations/support-view.test.ts`: the four `supportSections` cases (open/none, open/offline, not-configured/offline, closed/offline, not-configured/none).
      - `src/lib/donation-wording.test.ts`: `offlineTaxNote` en/ne unverified equals `donationTaxNote` unverified; verified contains "may be" (en) and does NOT contain "Stripe" in en or ne.
      Files: `src/lib/offline-giving.ts`, `src/lib/offline-giving.test.ts`, `src/lib/donations/support-view.ts`, `src/lib/donations/support-view.test.ts`, `src/lib/donation-wording.ts`, `src/lib/donation-wording.test.ts`.
      Verify: `npx vitest run --project unit src/lib` passes.

- [ ] 5. DB/action tests for save, audit privacy and EDITOR denial.
      Extend `src/server/actions/actions.db.test.ts` (same `form()`, `makeOwner`, `makeEditor`, `setTestSession` helpers):
      - OWNER saves Zelle + bank (account `000123456789`, routing `021000021`, SWIFT `CHASUS33`, `offlineGivingEnabled: "on"`) -> `ok: true`; row has normalized values; exactly one audit row; `changed` contains `bankAccountNumber`, `bankRoutingNumber`, `offlineGivingEnabled`; `JSON.stringify(audit.metadata)` does NOT contain `000123456789` (and not `0001`).
      - OWNER invalid routing `123456789` -> `VALIDATION`, `fieldErrors.bankRoutingNumber === ROUTING_MSG`, no audit row, row unchanged.
      - EDITOR posting `offlineGivingEnabled: "on"` + Zelle fields -> `FORBIDDEN`; row still `offlineGivingEnabled === false`, `zelleEmail === null`; audit count 0.
      No change is needed in `src/server/services/settings.ts` (it spreads the input and logs only field names); add a one-line comment above `changedFields(...)` saying metadata must hold field names only (bank account privacy).
      Files: `src/server/actions/actions.db.test.ts`, `src/server/services/settings.ts` (comment only).
      Verify: `npx vitest run --project db src/server/actions/actions.db.test.ts` passes (needs Postgres up; it uses `mission_unit`, never `mission_dev`).

- [ ] 6. Admin section.
      Add the "Zelle and bank transfer" `EditorSection` exactly as in "Admin section layout". Import `TextAreaField` from `@/components/admin/fields`.
      Files: `src/app/admin/(dashboard)/settings/page.tsx`.
      Verify: `npm run typecheck` and `npm run lint` exit 0; existing `src/components/admin/*.test.tsx` still pass (`npx vitest run --project unit src/components`).

- [ ] 7. Messages (en + ne).
      Add the keys from the Messages table to `SupportPage` in both files and update `_note`. Save as UTF-8 (no BOM); check the Devanagari renders in the editor.
      Files: `messages/en.json`, `messages/ne.json`.
      Verify: `npx vitest run --project unit src/lib/messages.test.ts` passes (parity, non-empty, no tax claims).

- [ ] 8. Public components + Support page wiring.
      Create `src/components/public/SupportBullet.tsx` (moved `Bullet` + `supportLinkClass`), `src/components/public/CopyButton.tsx`, `src/components/public/OfflineGivingSection.tsx`; update `src/app/[locale]/support/page.tsx` to compute `offline`, `sections`, `offlineTax` and render the sections in order (existing Stripe and unavailable JSX unchanged; new "other-ways" card). Add `src/components/public/CopyButton.test.tsx` (Testing Library + userEvent): renders the accessible name from `label`; click calls `navigator.clipboard.writeText` with the value (stub via `Object.defineProperty(navigator, "clipboard", ...)`) and the status region shows "Copied"; rejected writeText with `document.execCommand` returning false shows the failure text; status clears after the timeout (`vi.useFakeTimers`).
      Files: the four component files above, `src/app/[locale]/support/page.tsx`.
      Verify: `npm run typecheck`, `npm run lint`, `npx vitest run --project unit src/components/public` pass; with the user's dev server (port 3000, don't restart it; if it doesn't pick up the new Prisma client, use the E2E server instead) open `/en/support`: with the toggle off it looks exactly as before.

- [ ] 9. E2E functional + a11y spec.
      Create `e2e/offline-giving.spec.ts` (`test.use({ storageState: OWNER_STATE })`, `test.describe.configure({ mode: "serial" })`), imports `en`/`ne` messages and `seriousViolations` from `e2e/helpers/axe.ts`. Helpers in the spec: `fillOfflineGiving(page, values)` (goto `/admin/settings`, fill by label with `{ exact: true }`, set checkboxes, Save, expect toast "Settings saved.") and `resetOfflineGiving(page)` (all new fields `""`, both toggles off, Save). Test values (example data, tests only): recipient "E2E Ministry Zelle", email "give@example.org", phone "(555) 010-0199", QR `/brand/logo-mark.png` + alt "E2E Zelle QR", bank "E2E Community Bank", holder "E2E Ministry", account "000123456789", routing "021000021", SWIFT "CHASUS33", note en "Please write 'Bibles' in the memo".
      Tests (each with `try { ... } finally { await resetOfflineGiving(page) }`):
      1. Owner fills + enables -> for `en` and `ne`: `support-offline` visible with heading `messages.SupportPage.offlineTitle`; it comes before `support-other-ways` (compare `boundingBox().y`); `support-not-configured` count 0; Zelle card shows the recipient, email, phone; Copy buttons by name `Copy <label>` (from messages `copyLabel` with the field label); QR `getByRole("img", { name: "E2E Zelle QR" })` visible; steps text contains the recipient name; `support-offline-tax-note` equals the unverified offline note; note shown (on `ne` inside `[lang="en"]`). In `en`: `context.grantPermissions(["clipboard-read","clipboard-write"])`, click "Copy Zelle email", expect the status "Copied" and `navigator.clipboard.readText()` === "give@example.org". Account number NOT in `page.content()` and `bank-contact-for-details` visible with a link to `/<locale>/contact`.
      2. Then enable "Show the account, routing and SWIFT numbers on the Support page" -> `/en/support` and `/ne/support` show `000123456789`, `021000021`, `CHASUS33` with Copy buttons; `bank-contact-for-details` count 0. Axe on `/en/support` and `/ne/support` (section with details shown) and on `/admin/settings`: `expect(await seriousViolations(page)).toEqual([])`.
      3. Fill + enable, then uncheck "Show Zelle and bank transfer on the Support page" -> `/en/support` has `support-offline` count 0 and `support-not-configured` visible again (existing state).
      4. Invalid routing `123456789` -> `form-error-summary` visible, `getByLabel("Routing number (ABA, 9 digits)")` has `aria-invalid="true"` and the error text `ROUTING_MSG` is visible; Support page unchanged.
      5. EDITOR: (a) a fresh EDITOR context (`browser.newContext({ storageState: EDITOR_STATE })`) `goto("/admin/settings")` ends at `/admin/forbidden`. (b) As owner, `page.route("**/admin/settings", ...)` captures the POST of a filled + enabled form (headers + `postDataBuffer()`) and `route.abort()`s it; then `playwright.request.newContext({ baseURL, storageState: EDITOR_STATE })` posts the same body with the captured `next-action`, `next-router-state-tree`, `content-type` and `accept` headers plus `origin: baseURL`; expect the response text to contain "You don't have permission to do that."; then `/en/support` has `support-offline` count 0 and an owner reload of `/admin/settings` shows `zelleEmail` empty.
      Register the spec in `playwright.config.ts` `admin-mutations.testMatch` right after `"admin-settings.spec.ts"`.
      Files: `e2e/offline-giving.spec.ts`, `playwright.config.ts`.
      Verify: `npx playwright test e2e/offline-giving.spec.ts --project=admin-mutations` passes (Playwright runs `e2e:prepare` + build + start on :3210 against `mission_test`; the setup project runs first as a dependency).

- [ ] 10. Screenshot spec.
      Create `e2e/zelle-bank-screenshots.spec.ts` modelled on `e2e/phase8-screenshots.spec.ts` (`DIR = .agents/screenshots/zelle-bank`, `mkdirSync`, fonts ready, bounded networkidle, serial, timeout 120 s). In `try/finally` with the same fill/reset helpers (import them: move `fillOfflineGiving`/`resetOfflineGiving`/the test values into `e2e/helpers/offline-giving.ts` and use them from both specs): fill + enable with details ON, then shoot full-page `support-en-1280.png`, `support-en-375.png`, `support-ne-1280.png`, `support-ne-375.png`, plus `support-en-375-details-off.png` (details off); and the admin section: scroll the "Zelle and bank transfer" EditorSection into view and shoot it at 1280 and 375 (`admin-zelle-bank-1280.png`, `admin-zelle-bank-375.png`, element screenshot of the section). Assert `scrollWidth(page) <= viewport width` on each page.
      Register after `"phase9-screenshots.spec.ts"` in `admin-mutations.testMatch`.
      Files: `e2e/zelle-bank-screenshots.spec.ts`, `e2e/helpers/offline-giving.ts`, `e2e/offline-giving.spec.ts` (use helper), `playwright.config.ts`.
      Verify: `npx playwright test e2e/zelle-bank-screenshots.spec.ts --project=admin-mutations` passes and the 7 PNGs exist; OPEN each image (read_file) and confirm: navy/ivory/beige/gold palette, small labels in dark gold `#8A6A2F` (`text-gold-dark`) on light backgrounds, no overflow or clipped text at 375, Devanagari renders (no tofu boxes), header unchanged, QR crisp and contained. Fix and re-shoot if anything looks off.

- [ ] 11. README.
      Under "Step 9: Setting up Stripe (donations)" add a short "Zelle and bank transfer (optional, no keys needed)" subsection: where it is (Admin -> Settings -> Zelle and bank transfer), recipient name must match the bank app, how to save the Zelle QR from the bank app, the account-details warning, that Stripe is optional and both can run together. Add one bullet to the "Admin guide" section pointing to it.
      Files: `README.md`.
      Verify: `npm run format:check` exits 0 (run `npx prettier --write README.md` if needed).

- [ ] 12. Full verification + evidence + commit.
      Run in order (cwd = root) and paste the exit code and the summary line of each into `.agents/tasks/zelle-bank/verification.md`:
      1. `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` -> all exit 0.
      2. `npm test` -> passes; total > 1004 (record before/after counts and the new test files).
      3. `npm run test:e2e` -> passes; total > 401 (record counts; list the new spec titles).
      4. Screenshot list with a one-line review note per image (item 10).
      5. `git grep -n -i -E "aws|amazonaws|AKIA" -- . ":!package-lock.json"` -> no new hits from this change (note any pre-existing ones); `git grep -n -E "sk_live|sk_test_[A-Za-z0-9]{10}|whsec_[A-Za-z0-9]{10}"` -> none; `git ls-files .env` -> empty; `git diff --cached` contains no real Zelle/bank data (only the e2e/test example values).
      6. Re-run the item 1 read-only check -> `mission_dev` still has the active owner and "Bible Distribution Ministry"; also `select "offlineGivingEnabled" from "SiteSettings"` -> false (the migration default). Then delete `.agents/tasks/zelle-bank/check-dev.mjs`.
      Commit: stage files by name (schema, migration folder, src files, messages, e2e files, playwright config, README, `.agents/tasks/phase9/perf.json` regenerated by E2E, and the `.agents/tasks/zelle-bank/` plan + verification). Never stage `.vscode/settings.json` or `.env`. Message: `Support: Zelle and bank transfer giving, editable in Admin -> Settings`. Do not push.
      Files: `.agents/tasks/zelle-bank/verification.md`.
      Verify: `git status --short` shows only `?? .vscode/settings.json`; `git log --oneline -1` shows the new commit.

## Gaps / assumptions

- Brief says "Support namespace"; the actual namespace is `SupportPage`, so keys go there.
- The "both Stripe and offline" ordering is covered by the `supportSections` unit test, not E2E: the main E2E server has no Stripe keys, and the Stripe second server (`e2e/helpers/stripe-server.ts`) is owned by the donations specs. Optional extra (only if cheap): one assertion in `donations-checkout.spec.ts` that `support-open` comes before `support-offline` when both are on, restoring settings in `finally`.
- If the replayed server-action request in E2E test 5(b) can't be made to reach the action (for example Next rejects the replay for a reason other than auth), keep 5(a) plus the DB test from item 5, and record the reason in verification.md. Do not weaken the server-side guard.
- If `prisma migrate dev` can't regenerate the client while the user's dev server holds files, run `npx prisma generate` again after the migration; never stop the dev server.
