# Public prayer and contact forms with consent-gated publishing, spam pipeline and retention purge

Phase 6 adds the public prayer and contact forms. Both go through one server pipeline, `runPublicSubmission`, which runs the honeypot, then Zod with sanitization, then a per-hashed-IP rate limit, then a server-side Turnstile check, then a create-only insert, then a link-only Resend notice. The admin inbox gains notes, delete, an "edited public version" publish flow that only works with consent, and an OWNER-only retention setting with a manual purge. The public prayer wall reads only a separate `PublicShare` table, so public code can never reach the private rows. The privacy requirements in the brief are enforced on the server and backed by DB tests: anonymity, consent gating, no raw IP, and no body in logs or emails. The evidence in verification.md is complete, and the screenshots look right.

Watch for: only low-severity items remain. Turnstile `hostname` is not checked (likely). The notice email falls back to the demo `contactEmail` (confirmed). The Turnstile field error is not linked to any control (confirmed).

**Verdict**: APPROVED

## High-level view

Public writes have one entry point. `public-forms.ts` exposes only the two actions. Each delegates to the server-only pipeline, which calls `inbox-submit.ts`. That module can only `.create` and returns `{ id }` only. The privacy scan enforces this, and it also blocks relation keys that could join `PublicShare` back to a private row. Invalid or honeypot traffic never touches the DB. Only plausible submissions use up rate budget, and they do so before the Turnstile network call.

Anonymity is enforced in three places: the client clears and disables the fields, the schema strips name and email before validation, and the service writes nulls again. Consent starts unchecked on both forms. On contact, the server forces it to false unless the kind is TESTIMONY. Publishing is refused in the service, inside the transaction, unless consent is true (and, for messages, the kind is TESTIMONY). It also needs admin-written text, a confirmation tick, and a PII heuristic pass. A refused publish writes neither a share row nor an audit row.

Every admin mutation goes through `runAdminAction`, so each one gets a guard, Zod, a transaction and an AuditLog row. Audit metadata carries only ids, counts and booleans. Notes, delete and publish are ADMIN. Retention and purge are OWNER, and `purgeOldInbox` re-checks the role itself. The purge uses UTC calendar-month cutoffs, cascades public shares, and clears attempt rows older than 24 hours.

The remaining gaps are small. Turnstile siteverify checks `success` and `action` but not `hostname`. The notice email can go to the seeded demo address. The Turnstile error text is not linked to any control.

<details>
<summary>Issues (4)</summary>

1. **Turnstile hostname not verified** (LOW, likely). `verifyTurnstile` accepts any `success && action` match. Also compare `data.hostname` with the site host when live keys are set, so a token solved on another site that uses the same widget is rejected.
2. **Notice email falls back to demo contactEmail** (LOW, confirmed). Without `CONTACT_TO_EMAIL`, notices go to `SiteSettings.contactEmail`, which is `hello@example.org` in demo data. Either skip and log when the recipient is empty or an example.org address, or list `CONTACT_TO_EMAIL` as required in the go-live checklist.
3. **Turnstile error not associated with a control** (LOW, confirmed). `prayer-turnstile-error` and `contact-turnstile-error` are rendered but no element references them. The form alert does receive focus, so screen-reader users still hear the problem. Point the widget group's `aria-describedby` at the error id.
4. **Unpublish of nothing still audits** (NIT, confirmed). `unpublishPrayer`/`unpublishTestimony` on a missing or unshared id succeed and write `{ removed: 0 }`. Consider returning NOT_FOUND when the source row doesn't exist.

</details>

<details>
<summary>Details</summary>

### Pipeline order and where rate budget is spent

```
form -> submit*Action ("use server")
          -> runPublicSubmission (server-only)
               honeypot? -> fake success, log {form}
               Zod (sanitize, limits, anonymity strip) -> fieldErrors keys
               reserveFormSubmission(sha256(AUTH_SECRET+ip))  insert-then-count
               verifyTurnstile (test keys: offline dummy token; live: siteverify, fail closed)
               inbox-submit.create*  -> { id }
               notifyNewSubmission({kind,id})  link only, never throws
```

The rate-limit row is inserted before counting, outside a transaction. Concurrent requests therefore see each other's rows, which errs toward limiting. Rejected attempts also insert rows, so a client that keeps hammering stays limited for a full hour after it stops. That fits the abuse goal. The IP is taken from the existing `clientIp` (first `x-forwarded-for`). The README documents this, and it is outside this diff. Logs carry only a 12-char hash prefix, and the DB test asserts that the raw IP appears in no row and no log line.

With live keys, `verifyTurnstile` checks `success === true` and `action`. Network and parse errors fail closed as `TURNSTILE_UNAVAILABLE`. No `remoteip` is sent. Cloudflare also recommends validating `hostname`. Without that check, a token minted on a different site that uses the same site key would pass. That risk is small because the site key is per-domain in the Cloudflare dashboard, which is why it is rated LOW.

When keys are missing in production, the forms run on the always-pass test pair and log one warning. This follows the brief's fixed decision. The Inbox settings page shows the state ("test keys – not configured"), and the screenshot confirms it.

### Anonymity and consent enforced on the server

`dropIdentityWhenAnonymous` runs before the object schema, so an anonymous submit with a malformed email is still accepted and the email is never parsed. The schema's transform and `createPrayerRequest` each null the fields again. The DB test "anonymous: name and email are cleared server-side, even an invalid email" covers this path. On contact, consent is collapsed to `kind === "TESTIMONY" && checkbox` in both the schema and the service. The client also resets consent when the kind changes. Consent always defaults to unchecked, and `prayer-en-1280.png` and `contact-testimony-en-1280.png` show both boxes unticked.

`publishPrayer`/`publishTestimony` read consent and kind inside the admin transaction and throw CONFLICT before any write. The admin page hides the publish form when there is no consent, but that is only a UI convenience. The service gate is what counts, and the DB tests cover all three refusal cases with zero share and zero audit rows. The PII heuristic checks emails, ASCII and Devanagari phone runs, and whole-word name or email-local-part tokens. Verification.md is candid about its false positives and misses. The admin confirmation checkbox is the real control.

### Public output and email content

`listPublicShares` selects only `id, kind, textEn, textNe, publishedAt` from `PublicShare`, and the mapper's output keys are asserted exactly. `/[locale]/prayer` is `force-dynamic`, so an unpublish takes effect in both locales at once. The coder found the stale-ne case in screenshots and fixed it, and the e2e specs now assert en and ne. `prayer-wall-en-1280.png` shows only the edited texts: no name, no "Pokhara", no age. `prayer-wall-ne-375.png` shows the English fallback item next to the Nepali one.

The Resend body is fixed text plus the `/admin/inbox/<kind>/<id>` link, and the tests assert its exact keys. The recipient is `CONTACT_TO_EMAIL`, else `SiteSettings.contactEmail`. The seed sets that setting to `hello@example.org` (visible in every screenshot footer). An owner who adds a Resend key but forgets `CONTACT_TO_EMAIL` and the settings email would send notices to example.org. Nothing private leaks, because the email holds only a link, but the notices are lost without anyone noticing. The empty-string case reaches Resend and is only logged as a non-2xx.

### Admin mutations, retention and purge

All eight new inbox actions and the two OWNER actions use `runAdminAction` with the matching role. The guard-coverage test enforces that. Every new `inbox.ts` export starts with `requireAdmin()`. `updateInboxRetention` upserts only its own field, and `retentionSchema` bounds the value to 1..60. `purgeOldInbox` reads the retention from the same transaction and counts shares via the relation before deleting. The counts are recorded in audit metadata. `retentionCutoff` clamps month ends in UTC. `/admin/inbox/settings` is behind `requireOwnerPage`, and `previewPurge` there only counts. The unpublish services don't verify that the source row exists, so an unpublish on a bogus id succeeds and logs `{ removed: 0 }`. That is harmless but noisy.

### Form accessibility

Every field has a visible label. Errors come back as i18n keys and are linked through `describedBy(existing, invalid, errorId)`. Focus moves to the first invalid field, or to the `role="alert"` box (`tabIndex=-1`) when there is no field error. On success, focus moves to the success heading. Values survive errors because the inputs are controlled, and the component and e2e tests cover this. The honeypot sits off-screen inside `aria-hidden` with `tabIndex=-1`. The disabled anonymous fields are marked by more than colour (dashed border plus fill), as `prayer-anonymous-en-375.png` shows. The Turnstile `FieldError` ids are not referenced by any `aria-describedby`. The focused form alert still announces the problem, so this is LOW.

### Screenshots and evidence

I opened the following: `prayer-en-1280`, `prayer-ne-375`, `prayer-anonymous-en-375`, `prayer-error-en-375`, `prayer-wall-en-1280`, `prayer-wall-ne-375`, `contact-testimony-en-1280`, `contact-error-ne-375`, `contact-success-ne-375`, `admin-prayer-detail-consent-1280`, `admin-inbox-settings-1280` and `admin-prayer-list-375`. All of them are on-brand, with navy, ivory, beige, gold accents and dark-gold eyebrows. None overflow at 375. Devanagari renders without tofu. The header layout is unchanged: logo and name far left, nav and language switcher centre, gold CTA right. These shots show "Demo Ministry" because E2E runs against the seeded `mission_test`. Verification.md records that `mission_dev` still has 'Bible Distribution Ministry' and the user's logo. The admin list shows Consent and Public badges, and anonymous rows appear as "Anonymous". Verification.md records lint, typecheck, format, build, 591 unit/db tests, 232 e2e tests (52 axe scans with serious/critical = 0), additive-only migration SQL, the mission_dev read-only check, and the AWS, secret and `.env` greps. No evidence is missing.

</details>

<details>
<summary>File map</summary>

- `prisma/schema.prisma`, `prisma/migrations/20261027025835_phase6_forms_inbox/`: `PublicShare`, `FormSubmissionAttempt`, enums, `adminNote`, `inboxRetentionMonths`.
- `src/server/forms/{public-submission,rate-limit,turnstile}.ts`: public pipeline, hashed-IP limit, siteverify.
- `src/server/notify/email.ts`: link-only Resend notice.
- `src/server/actions/public-forms.ts`, `src/server/services/inbox-submit.ts`: public actions and create-only writes.
- `src/server/services/inbox.ts`, `src/server/actions/inbox.ts`, `src/server/services/settings.ts`: notes, delete, publish/unpublish, retention, purge.
- `src/lib/{sanitize-text,pii,retention,turnstile-keys,public-share-mappers,form-services-status}.ts`, `src/lib/validation/{public-forms,inbox}.ts`: pure helpers and schemas.
- `src/lib/content.ts`: `listPublicShares`.
- `src/components/public/{PrayerForm,ContactForm,FormParts,TurnstileWidget,PrayerWall,form-messages}.tsx`: public UI.
- `src/components/admin/{PublishShareForm,InboxNoteForm,InlineAction,AdminNav}.tsx`, `src/app/admin/(dashboard)/inbox/**`: admin UI and the inbox settings page.
- `src/app/[locale]/{prayer,contact}/page.tsx`: pages (prayer is now force-dynamic).
- `messages/{en,ne}.json`, `README.md`, `.env.example`, `playwright.config.ts`: strings, docs, env.
- Tests: unit, db, static scans and e2e (`e2e/{prayer-form,contact-form,admin-inbox,phase6-screenshots}.spec.ts`, `e2e/helpers/turnstile.ts`).

Full diff: `git -C "c:/Users/rasaily/Downloads/mission app" diff` plus the untracked files in `git status`.

</details>
