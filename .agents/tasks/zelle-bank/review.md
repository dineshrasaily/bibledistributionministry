# Owner-editable Zelle and bank transfer giving on the Support page

This change lets the owner publish Zelle details (recipient name, email, phone, QR) and bank transfer details on the public Support page, all managed from a new "Zelle and bank transfer" section in Admin -> Settings. It adds 16 nullable or default-false columns to the `SiteSettings` singleton, reuses the existing OWNER-only `updateSiteSettingsAction` pipeline (guard -> Zod -> tx + audit -> revalidate), and renders the public section from a pure mapper. That mapper drops account, routing and SWIFT numbers unless the owner turns on `bankShowAccountDetails`. A small layout resolver decides how the new section sits next to Stripe giving.

Watch for: nothing blocking. Two cosmetic points (confirmed): at 1280 px the bank card stretches to the Zelle card's height and leaves empty space, and on ne 375 px the "Other ways" email link breaks mid-word. The ordering when both Stripe and Zelle/bank are on is only unit-tested, not E2E-tested. The plan explains why (likely acceptable).

**Verdict**: APPROVED

## High-level view

The data model change is one purely additive migration. It contains only `ALTER TABLE "SiteSettings" ADD COLUMN` statements: two `BOOLEAN NOT NULL DEFAULT false` and fourteen `TEXT`. verification.md shows `mission_dev` before and after with the same active owner and ministry name, and the migration went through `migrate dev` without a drift prompt. `defaultSiteSettings` keeps every new field null or false, so the seed has no demo Zelle or bank data.

Validation lives in `settingsSchema`. Blank values become null. The phone check allows only phone characters and needs at least 7 digits. Email goes through the shared email rule and is lower-cased. Routing numbers are stripped of spaces and hyphens, then checked for exactly 9 digits plus the ABA checksum. SWIFT is upper-cased and checked against the structural BIC regex for 8 or 11 characters. The recipient name is required whenever an email, phone or QR is set. A QR without a description gets "Zelle QR code for <name>" filled in. The details toggle is rejected when no number is filled in. Writes are OWNER-only because the action passes `role: "OWNER"` to `runAdminAction`, and both a DB test and an E2E replay of a real Save request under an EDITOR session prove this server-side. Audit metadata is still `changedFields()`, which records field names only. A DB test checks that the serialized audit row contains neither the account number nor the routing number.

On the public side, `toOfflineGiving` returns null unless the master toggle is on and there is a real Zelle card (name plus email, phone or a safe QR) or a bank card. Hidden numbers are never passed to the component, so they never reach the HTML; E2E checks this with `page.content()`. When details are hidden, the bank card shows "Contact us for bank transfer details" with a link to the localized contact page. `supportSections` puts Zelle/bank first and swaps in a softer "Other ways to take part" card when Stripe isn't open. Stripe stays first when it is open, and today's card is unchanged when neither is set up. Tax wording comes from a new `offlineTaxNote`, which follows `taxDeductibleVerified` and never makes a Stripe receipt claim.

<details>
<summary>Issues (3)</summary>

1. **Bank card height mismatch at desktop** (confirmed, cosmetic): in `support-en-1280.png` and `support-ne-1280.png` the bank card stretches to the taller Zelle card and leaves a large empty area. Consider `items-start` on the two-column grid. Not blocking.
2. **Email link breaks mid-word on ne mobile** (confirmed, cosmetic): in `support-ne-375.png` the "Other ways" card shows "hello@example.o / rg". Consider `break-words` instead of mid-word breaking for the mail link in that card. Not blocking.
3. **Stripe + offline ordering only unit-tested** (likely acceptable): `supportSections("open", true)` is covered by a unit test, but no E2E renders both. The plan records this deliberately (the main E2E server has no Stripe keys). An optional assertion in the Stripe donations spec would close it.

</details>

<details>
<summary>Details</summary>

### Account-number privacy across save, audit and render

The account number is protected in three places. On save, `updateSiteSettings` writes the parsed input, and the audit metadata only lists changed field names. The new comment above `changedFields(...)` keeps future edits from adding values to it. The DB test serializes the whole audit row and checks for `000123456789`, `0001` and `021000021`, which covers both the raw and normalized values. `runAdminAction` logs only action name, actor and error name/message, never the input. On render, `getSiteSettings()` loads the full row, but the server page passes only mapper output to `OfflineGivingSection`. Header and Footer go through `toLocalizedSiteSettings`, which doesn't spread the row, so the number doesn't end up in any client-component props.

```
Admin form --(OWNER guard)--> settingsSchema (strip/normalize/validate)
    --> tx: update SiteSettings + AuditLog{changed: [field names]}
    --> revalidatePath("/[locale]", "layout")
Support page: row --toOfflineGiving--> {zelle, bank{details|null}, note} --> OfflineGivingSection
```

### Admin warning and toggle wiring

The warning text matches the plan: "Anyone can see your full account and routing numbers when this is on, and they can be misused for check or ACH fraud. Leave it off and donors will see 'Contact us for bank transfer details' instead, or use Zelle." It appears in a `role="note"` box directly above the checkbox. The checkbox sets `aria-describedby="bank-details-warning f-bankShowAccountDetails-hint"`. That overrides the field's default hint-only value, so the hint ID is restated by hand. `Checkbox` merges the error ID through `describedBy(...)`, so the error link still works. If the field's hint is ever removed or renamed, the hard-coded hint ID will point at nothing.

### Screenshots

All seven images were opened. The palette is navy, ivory, beige and gold throughout. Small labels use dark gold on white or ivory, and the warning box uses a gold-dark border on beige. The header and demo banner are unchanged in both locales. Devanagari renders without tofu, and "Zelle", "SWIFT/BIC" and "ABA" stay in Latin script. Nothing overflows horizontally at 375 px (the spec also asserts `scrollWidth`). On ne 375 px the longer Copy label drops under the email value, which still looks clean. The two cosmetic issues are listed above.

### Test coverage

Unit and DB tests go from 1004 to 1045, and E2E from 401 to 407 (from verification.md). The new tests cover the Zod rules, ABA checksum, mapper visibility and number hiding, section order, offline tax wording, CopyButton, the audit privacy check, invalid routing numbers, and EDITOR denial. E2E covers the en/ne render, the details-on path with axe checks on both Support locales and on admin, toggling the section off back to today's card, the field-error path, and the EDITOR replay. Not tested: Stripe-open plus offline rendering end to end, and the verified tax wording rendered on the page (the latter is unit-tested only).

</details>

<details>
<summary>File map</summary>

- `prisma/schema.prisma`, `prisma/migrations/20261028233148_zelle_bank_offline_giving/`: 16 additive SiteSettings columns
- `src/config/site.ts`: null/false defaults
- `src/lib/validation/common.ts` (+test): `optionalEmail`, `isValidAbaRouting`
- `src/lib/validation/settings.ts`, `settings-offline.test.ts`: new fields, messages, cross-field rules, QR alt default
- `src/lib/offline-giving.ts` (+test): visibility mapper
- `src/lib/donations/support-view.ts` (+test): `supportSections`
- `src/lib/donation-wording.ts` (+test): `offlineTaxNote`
- `src/components/public/OfflineGivingSection.tsx`, `CopyButton.tsx` (+test), `SupportBullet.tsx`: public UI
- `src/app/[locale]/support/page.tsx`: section ordering, softened "Other ways" card
- `src/app/admin/(dashboard)/settings/page.tsx`: admin section with warning
- `src/server/services/settings.ts`: privacy comment only
- `src/server/actions/actions.db.test.ts`: save/audit/validation/EDITOR tests
- `messages/en.json`, `messages/ne.json`: SupportPage strings
- `e2e/offline-giving.spec.ts`, `e2e/zelle-bank-screenshots.spec.ts`, `e2e/helpers/offline-giving.ts`, `playwright.config.ts`: E2E
- `README.md`: owner guide

Full diff: `git -C "c:/Users/rasaily/Downloads/mission app" diff` plus the untracked files in `git status`.

</details>
