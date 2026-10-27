# Phase 6 implementation plan: prayer request + contact forms

Scope:
- Public prayer form and contact form, both protected by Turnstile, a honeypot and a per-hashed-IP rate limit.
- Admin inbox gains notes, delete, publish-as-public (consent only), and an OWNER retention setting with a purge action.
- An optional public "prayer wall" on `/[locale]/prayer` showing published, consented items only.
- Resend admin notification that carries a link only.
- Support stays a placeholder (Phase 8). The header is not touched.

Root: `c:\Users\rasaily\Downloads\mission app` (it has a space, so quote every path). Windows + PowerShell. Paths with `[locale]` need `-LiteralPath` in PowerShell. Work on `master`, no worktree. **Do not commit.** The finalize step makes the one Phase 6 commit after review approval.

Baselines (from `.agents/tasks/phase3/verification.md`): `npm test` 474 tests, `npm run test:e2e` 179 tests. Both stay green, plus the new tests below.

## Ground rules (from the brief and the codebase)

- **mission_dev holds the user's real data.** Never run `db:reset`, `db:seed`, `prisma migrate reset`, `prisma db push` or TRUNCATE against it. The schema changes only through `prisma migrate dev` (item 1). Vitest uses `mission_unit` and Playwright uses `mission_test`. Both are recreated automatically.
- Don't stop Postgres unless you started it. Don't kill the user's `npm run dev` on :3000. The user must restart it after the schema change, so say that in the final notes. Never run `npm test` and `npm run test:e2e` at the same time.
- Patterns to follow:
  - **Admin mutations:** they go only through `runAdminAction` (`src/server/actions/run-admin-action.ts`). That means a guard, then Zod, then a transaction with an AuditLog row, then revalidate. Services take `(tx, input, actor)` and return `ServiceResult`. Redirects happen only in the action file, after success (see `deletePostAction` -> `redirect("/admin/posts?toast=deleted")`).
  - **Inbox privacy:** `src/server/services/privacy-scan.test.ts` enforces two rules. Only `src/server/services/inbox.ts` (plus `src/test/*` and the seed) may use the `.prayerRequest` / `.contactMessage` delegates, and every export of inbox.ts must call `requireAdmin()` first. **This includes test files.** DB tests must read and backdate inbox rows through helpers in `src/test/` (factories or a new `src/test/inbox-rows.ts`), never with `prisma.prayerRequest` directly.
  - **Server action files:** `src/server/actions/guard-coverage.test.ts` requires `"use server";` as the first statement, and every export must use `runAdminAction(` or be allow-listed.
  - **Audit metadata:** it never contains bodies, names, emails, subjects, notes or public text. Only ids, statuses, counts and booleans.
  - **Messages:** `messages/en.json` and `messages/ne.json` must have identical keys (`src/lib/messages.test.ts`). That test forbids the literal "Demo Ministry" and `/tax[- ]deductible|501\(c\)|registered charity/i`. Nepali strings are machine-assisted: extend the `_note` in ne.json to say "Phase 6 strings added; review with the rest."
  - **Pure modules:** they import neither `server-only` nor `@/lib/db`, and each new one is added to `PURE_MODULES` in `src/test/script-imports.test.ts`.
  - **Client components:** they may use `useTranslations` (the `[locale]/layout.tsx` wraps everything in `NextIntlClientProvider`, as `MobileMenu` does).
  - **UI:** use the primitives in `src/components/ui/*` (`Input`, `Textarea`, `Select`, `Checkbox`, `Label`, `FieldError` with `describedBy`, `Button`, `Card`, `Badge`, `EmptyState`, `Container`, `SectionHeader`) and `PageHero` from `src/components/public/PageHero.tsx`. Admin UI uses `src/components/admin/*` (`FormShell`, `fields.tsx`, `SubmitButton`, `ConfirmDialog`, `InlineAction`, `EditorSection`, `DetailList`, `PrivacyNotice`/`ConsentBadge`, `FlashToast` keys).
  - **Colours:** gold `#B8924A` is decorative only. Text on light surfaces uses `text-gold-dark`.
- Every DB test file starts with `resetDb()`. It truncates every `Prisma.ModelName`, so new models are covered automatically.

## Decisions (picked per the standing directive, with rationale)

1. **Public "published" text lives in a separate `PublicShare` model, not in columns on the private rows.**
   - Fields: `id`, `kind PublicShareKind (PRAYER | TESTIMONY)`, `textEn String?`, `textNe String?`, `prayerRequestId String? @unique` (FK, `onDelete: Cascade`), `contactMessageId String? @unique` (FK, Cascade), `publishedById String?` (FK AdminUser, SetNull), `publishedAt`, `updatedAt`.
   - The wall reads only this table with an explicit `select`, so a public code path can never reach name/email/body. The privacy scan stays meaningful. Cascade means deleting or purging a request also removes its public version, which favours privacy and matches the privacy text's "withdraw your consent".
2. **Publishing rules (enforced in `inbox.ts`, not just the UI):**
   - A prayer can be published only when `shareConsent = true`.
   - A contact message can be published only when `kind = TESTIMONY` and `shareConsent = true`. Anything else returns `DomainError("CONFLICT", "This person did not agree to public sharing, so it can't be published.")`. No PublicShare row and no audit row are written (the transaction rolls back).
   - The admin writes the public text. It is prefilled with the original body for convenience, and English, Nepali or both are allowed (at least one is required, max 1500 each). The admin must tick a required checkbox: "I removed names, contact details and anything that identifies the person."
   - Server-side PII heuristic (`findPersonalInfo`): reject text containing any email address, a phone-like run (7+ digits, ASCII or Devanagari `०-९`, with optional spaces/dashes/dots/parentheses/+), or any word of 3+ letters from the submitter's name or email local part (case-insensitive, whole word). The rejection is a field error. Re-publishing updates the same row (upsert on the FK). Unpublish deletes the row.
3. **The wall shows as a section on `/[locale]/prayer`**, titled "Prayers and testimonies shared with permission". It lists the latest 12 PublicShares, newest first, with a "Prayer"/"Testimony" badge and a date, rendered as plain text with `whitespace-pre-line`. Text is shown in the page locale, falling back to the other language, with a matching `lang` attribute. The section is hidden when empty, and no demo items are seeded, because inventing prayers or testimonies is forbidden. Admin publish/unpublish revalidates `"public"`.
4. **Pipeline order for public submissions (`runPublicSubmission`):**
   1. Honeypot. Non-empty `website` returns a fake success, with no DB write and `log.info("form.honeypot", { form })`.
   2. Zod. Validation errors make no DB write.
   3. Rate-limit reservation (insert-then-count).
   4. Turnstile server-side verification.
   5. Sanitize + create.
   6. Notify.
   7. Success.

   Only plausible submissions consume rate budget, and garbage never touches the DB. Unexpected errors are logged as `{ form, name }` only and return the generic error.
5. **Rate limit:**
   - A new `FormSubmissionAttempt { id, form FormKind (PRAYER | CONTACT), ipHash, createdAt }` with `@@index([form, ipHash, createdAt])` and `@@index([createdAt])`.
   - `ipHash = hashIp(ip)` reuses `src/server/auth/rate-limit.ts` (sha256(AUTH_SECRET + ip)) together with `clientIp(headers)`. The raw IP is never stored or logged; logs carry only the first 12 hex chars of the hash.
   - Limit: 5 accepted-for-processing submissions per form per ipHash per rolling 60 minutes. Each reservation also deletes attempt rows older than 24 hours, matching the privacy text "deleted after a short time".
   - The limit comes from `FORM_RATE_LIMIT_PER_HOUR`: an integer 1..1000, default 5, with invalid values falling back to 5. The Playwright webServer sets it to `100` so the E2E suite (all requests come from localhost) is never throttled. The limit itself is proven in DB tests with the default.
6. **Turnstile:**
   - Keys are read from `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`. The site key is read server-side and passed as a prop, not `NEXT_PUBLIC_*`, so it can change without a rebuild and the "no NEXT_PUBLIC secrets" audit stays trivial. Replace the `# NEXT_PUBLIC_TURNSTILE_SITE_KEY=` placeholder in `.env.example`.
   - If either key is missing, use Cloudflare's official always-pass test pair: site `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`. In production this also logs one `log.warn("turnstile.test_keys")`, and the forms keep working with honeypot + rate limit, so the site is never broken by missing keys.
   - Server verification with the test secret is done offline. It accepts exactly Cloudflare's documented dummy token `XXXX.DUMMY.TOKEN.XXXX`, which is what the always-pass pair returns, so dev and E2E need no network.
   - With real keys it POSTs `application/x-www-form-urlencoded` `{ secret, response, idempotency_key: randomUUID() }` to `https://challenges.cloudflare.com/turnstile/v0/siteverify` with `AbortSignal.timeout(5000)`. No `remoteip` is sent (data minimisation).
   - It passes only if `success === true` and `action` matches the form (`"prayer"` / `"contact"`). Network or parse errors fail closed (`TURNSTILE_UNAVAILABLE`). Tokens over 2048 chars are rejected by Zod. Only `error-codes` are logged.
   - Phase 9's CSP must allow `https://challenges.cloudflare.com` in `script-src` and `frame-src`. Note this in the README.
7. **Email (Resend):**
   - No SDK. A plain `fetch` POST to `https://api.resend.com/emails` with `Authorization: Bearer`, a 5s timeout, and no new dependency.
   - Env vars: `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (a verified-domain sender) and `CONTACT_TO_EMAIL`. The recipient falls back to `SiteSettings.contactEmail`.
   - Subject is "New prayer request" or "New contact message". The text/HTML body is only "A new … was received. Open the admin inbox to read it: <link>", with the link `${siteUrl}/admin/inbox/prayer/<id>` (or `/messages/<id>`). It never contains name, email, subject or body.
   - If the key or from-address is missing, it logs `log.info("notify.email.skipped", { kind, id, reason: "RESEND_API_KEY missing" | "RESEND_FROM_EMAIL missing" })` and continues. A non-2xx response logs `{ kind, id, status }`. Neither path ever logs the recipient or the key.
   - It is awaited inside the action, after the row is committed, with errors caught. `after()` is not used because it is untestable in the Vitest db project, and the 5s timeout bounds the latency.
8. **Sanitization (`sanitizePlainText`, pure):**
   - It applies Unicode NFC, turns CRLF/CR into LF, strips C0/C1 control chars except `\n` and `\t`, and strips bidi overrides/isolates (U+202A–U+202E, U+2066–U+2069) and U+200B, U+FEFF. It keeps ZWNJ/ZWJ (U+200C/U+200D), which Devanagari needs.
   - It collapses 3+ blank lines into 2 and trims. Single-line fields (name, subject) also collapse whitespace and newlines to single spaces.
   - HTML is not stripped. These fields are only ever rendered as React text (auto-escaped), never as HTML or Markdown, and the email never contains them. So `<3` or `a < b` in a prayer is preserved rather than mangled. Length limits apply after sanitizing.
9. **Field limits:**
   - Prayer: name 100, email 254, body 1..4000.
   - Contact: name 1..100, email required, subject 1..150, message 1..5000.
   - Admin: note 2000, public text 1500.
   - Emails use the existing `emailSchema` rules (trim, lower-case). Locale is `"en" | "ne"` (`.catch("en")`).
10. **Anonymity is enforced in two places.**
    - The schema preprocesses: when `isAnonymous` is checked, `name`/`email` are removed before validation, so an invalid email can't block an anonymous submit.
    - `createPrayerRequest` sets `name: null, email: null` again whenever `isAnonymous`.
    - The client toggle disables the two inputs and clears their controlled values.
11. **Contact consent:** the "You may share my testimony publicly…" checkbox is rendered only when Kind = Testimony (client state) and is unchecked by default. The server stores `shareConsent = kind === "TESTIMONY" && checkbox`.
12. **Error messages are i18n keys.** Public Zod schemas use message strings that are keys (`required`, `tooLong`, `invalidEmail`). The action returns `{ status: "error", code, fieldErrors: { field: key } }` and the client translates them via `FormErrors.<key>`. Server-side `getTranslations` would not run in the Vitest db project.
13. **Admin roles:**
    - Notes, status, delete, publish and unpublish are `ADMIN` (OWNER + EDITOR), because editors run the inbox.
    - The retention setting and purge are `OWNER` (bulk destructive, settings-like).
    - The new page `/admin/inbox/settings` ("Inbox settings", owner-only, in the sidebar's Owner section) holds retention + purge + a read-only service status. The status shows "Spam protection: Cloudflare Turnstile (live keys | test keys – not configured)" and "Email notifications: Resend configured | not configured (notices are logged)". Values are never shown.
14. **Retention:**
    - `SiteSettings.inboxRetentionMonths Int @default(12)`, range 1..60. It is edited on the inbox settings page by its own action, not the big Settings form, so existing settings tests and forms are untouched.
    - Purge is manual: ConfirmDialog -> `purgeOldInboxAction`. It deletes PrayerRequest and ContactMessage rows with `createdAt < cutoff`, where cutoff = now minus N calendar months in UTC (pure `retentionCutoff(now, months)`). Their PublicShares cascade. It also deletes FormSubmissionAttempt rows older than 24h.
    - The page previews the counts that would be deleted and shows the last purge date (the latest AuditLog `inbox.purge`). Audit metadata is `{ months, cutoff, prayerDeleted, messagesDeleted, sharesDeleted }`.
    - No cron (out of scope). The README tells the owner to purge periodically.
15. **Admin notes:** add `adminNote String?` to PrayerRequest and ContactMessage, saved by a separate note action (so the existing status form/tests are unchanged). Audit metadata is `{ noteChanged: true, length }`.
16. **Honeypot:**
    - The field is `website`, inside a `div` that is positioned off-screen (`absolute -left-[10000px] h-px w-px overflow-hidden`) with `aria-hidden="true"`.
    - The input has `tabIndex={-1}` and `autoComplete="off"`. axe treats `tabindex=-1` content inside `aria-hidden` as passing.
    - Its label is "Leave this field empty".
17. **Form state must survive errors.** React 19 resets uncontrolled forms after an action, so all public form fields are controlled (`useState`), with the server action called via `useActionState`.
    - On error, focus moves to the first invalid field. If there are no field errors, it moves to the form-level `role="alert"` message, which has `tabIndex={-1}`.
    - On success, the form is replaced by a success panel whose heading receives focus (`tabIndex={-1}`), plus a "Send another" button that resets state and the Turnstile widget.
    - The submit button shows "Sending…" with `aria-disabled` while pending.
18. **Turnstile in E2E:** a Playwright route stub (`e2e/helpers/turnstile.ts`) fulfils `https://challenges.cloudflare.com/**` with a tiny script. It defines `window.turnstile.render(el, opts)`, which draws a labelled box and calls `opts.callback("XXXX.DUMMY.TOKEN.XXXX")`, plus `reset`/`remove`. A `{ pass: false }` variant never calls back. There are no real Cloudflare requests in tests.
19. **Where public writes live:**
    - A new `src/server/services/inbox-submit.ts` (server-only, create-only: `createPrayerRequest`, `createContactMessage`, each with `select: { id: true }`).
    - The privacy scan allow-lists it and asserts that it uses only `.create(` on the inbox delegates (no find/update/delete/count) and has no other exports.
    - The scan also forbids `prayerRequest:` / `contactMessage:` relation keys (include/select) outside the allowed files, so `content.ts` can't join PublicShare back to the private row.

## Plan

- [ ] 1. Schema change and migration (additive only)
  - **Schema** (`prisma/schema.prisma`):
    - New enums: `FormKind { PRAYER CONTACT }` and `PublicShareKind { PRAYER TESTIMONY }`.
    - `SiteSettings`: `inboxRetentionMonths Int @default(12) // 1..60 (Zod), OWNER only`.
    - `PrayerRequest` and `ContactMessage`: `adminNote String? // private, admin only` and `publicShare PublicShare?`.
    - New model `PublicShare` per decision 1, with `@@index([publishedAt])`. `AdminUser` gains `publicShares PublicShare[]`.
    - New model `FormSubmissionAttempt` per decision 5.
  - **Defaults:** add `inboxRetentionMonths: 12` to `defaultSiteSettings` in `src/config/site.ts` (its `satisfies` check needs it).
  - **Migration:**
    1. `npm run db:status`. If Postgres is stopped, `npm run db:start` and record that you started it.
    2. Read-only pre-check: a small `npx tsx -e` script using `createPrismaClient` counts OWNER `AdminUser` rows and prints `ministryName`/`logoUrl`. Record the output in verification.md.
    3. `npx prisma migrate dev --create-only --name phase6_forms_inbox`.
    4. Open the SQL and confirm it contains only `CREATE TYPE`, `CREATE TABLE`, `ALTER TABLE … ADD COLUMN` (with defaults), `CREATE INDEX` / `CREATE UNIQUE INDEX` and `ADD CONSTRAINT … FOREIGN KEY` (`ON DELETE CASCADE` for the two PublicShare source FKs, `SET NULL` for `publishedById`). No DROP, no UPDATE.
    5. Apply with `npm run db:migrate`.
    - **If Prisma reports drift or asks to reset, stop.** Don't confirm and don't reset. Record the message and investigate.
  - **Files:** `prisma/schema.prisma`, `prisma/migrations/<ts>_phase6_forms_inbox/migration.sql`, `src/config/site.ts`.
  - **Verify:** `npm run typecheck` exits 0. `npx prisma migrate status` reports up to date. The post-check shows the owner + 'Bible Distribution Ministry' settings unchanged and `inboxRetentionMonths = 12`.

- [ ] 2. Pure helpers, schemas and mappers, with unit tests (needs item 1 for generated enums)
  - `src/lib/sanitize-text.ts`: `sanitizePlainText(s)` and `sanitizeSingleLine(s)` (decision 8).
  - `src/lib/pii.ts`: `findPersonalInfo(text, { name?, email? })` returns `("email" | "phone" | "name")[]` (decision 2).
  - `src/lib/retention.ts`: `retentionCutoff(now, months)` uses UTC calendar months and clamps the day (Mar 31 − 1 month -> Feb 28/29). Also `RETENTION_MIN = 1`, `RETENTION_MAX = 60`.
  - `src/lib/turnstile-keys.ts`: `TURNSTILE_TEST_SITE_KEY`, `TURNSTILE_TEST_SECRET_KEY`, `TURNSTILE_DUMMY_TOKEN` and `resolveTurnstileKeys(env)` -> `{ siteKey, secretKey, mode: "live" | "test" }` (live only when both keys are non-empty).
  - `src/lib/validation/public-forms.ts`:
    - `prayerSubmissionSchema` and `contactSubmissionSchema` (decisions 9–12; key-style messages). Each has `turnstileToken: z.string().max(2048)` (missing -> `"turnstileMissing"`) and `website` (the honeypot, read by the pipeline before parsing).
    - Exported types plus `PublicFormState = { status: "idle" } | { status: "success" } | { status: "error"; code: "VALIDATION" | "RATE_LIMITED" | "TURNSTILE" | "TURNSTILE_UNAVAILABLE" | "ERROR"; fieldErrors?: Record<string, string> }`.
    - Also `formRateLimit(env)` parses `FORM_RATE_LIMIT_PER_HOUR` (decision 5).
  - `src/lib/validation/inbox.ts` additions:
    - `prayerNoteSchema` / `messageNoteSchema` (`{ id, adminNote: optionalText(2000) }`).
    - `publishShareSchema` (`{ id, textEn: optionalText(1500), textNe: optionalText(1500), confirmNoPersonalInfo: checkbox() }` refined so at least one text is required (error on `textEn`) and confirm is true (error on `confirmNoPersonalInfo`)). Text goes through `sanitizePlainText`.
    - `retentionSchema` (`{ inboxRetentionMonths: z.coerce.number().int().min(1).max(60) }` with friendly English messages).
    - `purgeSchema` (`{ confirm: z.literal("purge") }`).
    - Reuse `byIdSchema` for delete/unpublish.
  - `src/lib/public-share-mappers.ts`: `toPublicShareView(row: { id, kind, textEn, textNe, publishedAt }, locale)` -> `{ id, kind, text, lang, publishedAt }`, or `null` when both texts are empty.
  - Add all six new pure modules to `PURE_MODULES` in `src/test/script-imports.test.ts`.
  - **Tests:**
    - `src/lib/sanitize-text.test.ts`: control/bidi chars removed, ZWJ/ZWNJ kept in a Devanagari sample, NFC, CRLF, blank-line collapse, `<b>` preserved literally.
    - `src/lib/pii.test.ts`: email, `+977 98-1234-5678`, Devanagari digits, name tokens (case-insensitive, whole word, 3+ letters), clean text passes.
    - `src/lib/retention.test.ts`: month-end clamping, leap year, 12 and 60 months.
    - `src/lib/turnstile-keys.test.ts`: live vs test resolution (a single key present -> test).
    - `src/lib/validation/public-forms.test.ts`:
      - Anonymity strips name/email even when the email is invalid.
      - Non-anonymous invalid email -> `invalidEmail`.
      - Body required/too long (limits checked after sanitizing).
      - `shareConsent` defaults false.
      - Contact consent forced false for GENERAL/VOLUNTEER and kept for TESTIMONY.
      - Invalid kind -> error.
      - Locale catch.
      - Token too long.
      - `formRateLimit` parsing.
    - Extend `src/lib/validation/admin.test.ts` (or add `inbox.test.ts` beside it): publish schema needs one text + confirm; retention bounds; purge literal.
    - `src/lib/public-share-mappers.test.ts`: locale pick and fallback with `lang`, both empty -> null.
  - **Verify:** `npx vitest --run --project unit` passes.

- [ ] 3. Server-side form pipeline: Turnstile, rate limit, email, create-only service, public actions (needs 1–2)
  - `src/server/forms/turnstile.ts` (server-only):
    - `getTurnstileConfig()` reads `process.env` at call time (so tests can `vi.stubEnv`) and warns once in production on test keys.
    - `verifyTurnstile(token, expectedAction, { fetchImpl = fetch } = {})` -> `{ ok: true } | { ok: false; reason: "invalid" | "unavailable" }` (decision 6).
  - `src/server/forms/rate-limit.ts` (server-only): `reserveFormSubmission(db, { form, ipHash, now, limit })` deletes rows older than 24h, inserts the attempt row, counts rows in the last 60 min for `(form, ipHash)`, and returns `{ limited: count > limit }`.
  - `src/server/notify/email.ts` (server-only): `notifyNewSubmission({ kind: "prayer" | "contact", id }, { fetchImpl = fetch, env = process.env } = {})`, per decision 7. It never throws. It uses `getSiteConfig().siteUrl` for the link and `getSiteSettings().contactEmail` as the recipient fallback.
  - `src/server/services/inbox-submit.ts` (server-only): `createPrayerRequest(input)` (re-applies the anonymity null-out) and `createContactMessage(input)`. Create-only, `select: { id: true }`.
  - `src/server/forms/public-submission.ts` (server-only, **no** `"use server"`): `runPublicSubmission({ form, schema, turnstileAction, create, notifyKind }, formData)`, which implements decision 4. It uses `formDataToObject` from `run-admin-action.ts`, `clientIp(await headers())` + `hashIp`, `prisma` for the reservation, and `log` with no PII.
  - `src/server/actions/public-forms.ts` (`"use server";`): `submitPrayerAction(_prev: PublicFormState | null, formData)` and `submitContactAction(...)`. Each just returns `runPublicSubmission(...)`.
  - **Test updates:**
    - `src/server/actions/guard-coverage.test.ts`: add a `PUBLIC_ACTIONS = new Set(["submitPrayerAction", "submitContactAction"])` branch whose body must contain `runPublicSubmission(`, and assert `public-submission.ts` is server-only and not a server-action file.
    - `src/server/services/privacy-scan.test.ts`: allow `inbox-submit.ts`. Assert that it only calls `.create(` on the inbox delegates and exports exactly the two functions. Extend the offender regex with `\b(prayerRequest|contactMessage)\s*:` (relation keys). Allow `src/server/services/inbox-submit.ts`, inbox.ts, `src/test/*` and the seed only.
  - **Tests:**
    - `src/server/forms/turnstile.test.ts` (unit, node env, `vi.stubEnv`, mocked `fetchImpl`):
      - Test keys: the dummy token passes, any other fails, and no fetch call is made.
      - Live keys: success+matching action passes; `success: false` fails as invalid; mismatched action fails; fetch rejects -> unavailable; non-JSON -> unavailable.
      - The request body is urlencoded with secret, response and idempotency_key, and contains no `remoteip`.
    - `src/server/notify/email.test.ts` (unit, `vi.spyOn(console, "info"/"warn")`, mocked fetch):
      - No key -> one skipped log line, no fetch, and the log contains neither the sample body, name, email nor subject.
      - Key but no from -> skipped.
      - Key + from -> one fetch to `https://api.resend.com/emails` with a Bearer header, and a JSON body containing the `/admin/inbox/prayer/<id>` link but not the body, name, email or subject.
      - A 500 response is logged with status only, without the key or recipient.
      - fetch throws -> no throw.
    - `src/server/forms/public-submission.db.test.ts` (db project; read rows via a new `src/test/inbox-rows.ts` helper exposing `allPrayerRows()`, `allMessageRows()`, `allAttemptRows()`; set `testRequest.headers.set("x-forwarded-for", "203.0.113.7")`; stub `fetch` globally so any real network call fails the test):
      - A normal prayer is stored with the sanitized body, locale, `shareConsent=false` and status NEW.
      - An anonymous prayer with a name and an invalid email is stored with name/email null and `isAnonymous=true`.
      - Honeypot -> success, 0 rows, 0 attempt rows.
      - Validation error -> 0 rows, 0 attempts, and key-style `fieldErrors`.
      - Rate limit: 5 succeed, the 6th returns `RATE_LIMITED` with no 6th row. A different IP still succeeds. Attempt rows hold a 64-hex `ipHash`, and the JSON of all attempt rows does not contain `203.0.113.7`. Attempts older than 24h (backdated via the helper) are deleted on the next reservation.
      - Turnstile: a wrong token -> `TURNSTILE` with no row. Live keys (`vi.stubEnv`) + a mocked fetch returning success/action OK -> stored.
      - Contact GENERAL with the consent box ticked -> stored `shareConsent=false`. TESTIMONY -> true.
      - The notification skip is logged without the body.
  - **Verify:** `npm test` passes, including `guard-coverage`, `privacy-scan` and `script-imports`.

- [ ] 4. Admin inbox services and actions: notes, delete, publish/unpublish, retention, purge (needs 1–3)
  - In `src/server/services/inbox.ts`, every new export starts with `await requireAdmin()` (the privacy scan checks the first await):
    - `setPrayerNote` / `setMessageNote`.
    - `deletePrayerRequest` / `deleteContactMessage` (metadata `{ hadPublicShare }`).
    - `publishPrayer(tx, input, actor)` and `publishTestimony(tx, input, actor)` (decision 2: consent/kind gate, then `findPersonalInfo` against the row's name/email -> `DomainError("VALIDATION", msg, "textEn" | "textNe")`, then upsert PublicShare with `publishedById = actor.id`; metadata `{ kind, updated: boolean }`).
    - `unpublishPrayer` / `unpublishTestimony`.
    - `purgeOldInbox(tx, { now })` (decision 14; reads `inboxRetentionMonths` from settings in the same tx).
    - `previewPurge()` (counts only).
    - `listPrayerRequests` / `listContactMessages` / `getPrayerRequest` / `getContactMessage` now also select `publicShare: { select: { id, textEn, textNe, publishedAt } }` for badges and prefill. That is allowed inside inbox.ts.
  - `src/server/services/settings.ts`: `updateInboxRetention(tx, input)` upserts only that field, with metadata `{ inboxRetentionMonths: { from, to } }`.
  - `src/lib/content.ts`: `listPublicShares(locale, limit = 12)` uses `prisma.publicShare.findMany({ orderBy: [{ publishedAt: "desc" }, { id: "asc" }], take, select: { id, kind, textEn, textNe, publishedAt } })` mapped through `toPublicShareView`. No include and no relation keys.
  - `src/lib/form-services-status.ts` (server-only): `getFormServicesStatus()` -> `{ turnstile: "live" | "test", email: "configured" | "not-configured" }` (decision 13).
  - Actions (all through `runAdminAction`):
    - `src/server/actions/inbox.ts`: `setPrayerNoteAction` (`prayer.note`), `setMessageNoteAction` (`message.note`), `deletePrayerAction` (`prayer.delete`, redirects `/admin/inbox/prayer?toast=deleted` after ok), `deleteMessageAction` (`message.delete`, redirects `/admin/inbox/messages?toast=deleted`), `publishPrayerAction` (`prayer.publish`), `unpublishPrayerAction` (`prayer.unpublish`), `publishTestimonyAction` (`message.publish`), `unpublishTestimonyAction` (`message.unpublish`). All `role: "ADMIN"`, entityType `PrayerRequest` / `ContactMessage`. The publish/unpublish/delete actions revalidate `["public", "admin"]`, the others `["admin"]`.
    - OWNER actions: `setInboxRetentionAction` (`settings.retention`, entityType `SiteSettings`) and `purgeOldInboxAction` (`inbox.purge`, entityType `Inbox`, revalidate both).
  - **Tests:** extend `src/server/services/inbox.db.test.ts`, using factories or `src/test/inbox-rows.ts` only (extend `makePrayerRequest`/`makeContactMessage` overrides to accept `createdAt`, `shareConsent`, `kind`, `isAnonymous`):
    - Every new service export throws UNAUTHENTICATED with no session (extend the existing list).
    - Note saved, and the audit has no note text.
    - Delete removes the row and its PublicShare (cascade).
    - **Consent gating:** publishing a prayer with `shareConsent=false` -> CONFLICT, 0 PublicShare rows, 0 audit rows. A GENERAL message with consent=true -> CONFLICT. A TESTIMONY without consent -> CONFLICT.
    - PII: text containing the submitter's email, name token or phone -> VALIDATION on `textEn`. Missing confirm -> VALIDATION.
    - Publish ok: `listPublicShares("en")` returns the edited text, never the original body, name or email (assert the object keys are exactly `id, kind, text, lang, publishedAt`). Re-publish updates. Unpublish removes. The audit metadata JSON contains none of the body, name, email or public text.
    - Retention: EDITOR -> FORBIDDEN on both owner actions. OWNER sets 6. 0 and 61 are rejected.
    - Purge: rows backdated 7 months are deleted with retention 6, rows 5 months old are kept, the PublicShare of a deleted row is gone, attempt rows older than 24h are gone, and the audit counts are correct.
    - Extend `src/server/actions/actions.db.test.ts` AC15-style: EDITOR gets FORBIDDEN from `setInboxRetentionAction`/`purgeOldInboxAction` with the DB unchanged.
  - **Verify:** `npm test` passes.

- [ ] 5. Admin UI (needs 4)
  - `src/app/admin/(dashboard)/inbox/prayer/[id]/page.tsx`: keep the existing Request + Status sections, then add:
    - **Private note:** a new `src/components/admin/InboxNoteForm.tsx`, a FormShell with a TextAreaField `adminNote` (hint "Only admins can see this.").
    - **Public version:**
      - If `shareConsent`: a new `src/components/admin/PublishShareForm.tsx` with guidance text, `textEn` (prefilled with the existing public text, else the body when `locale !== "ne"`), `textNe` (prefilled when `locale === "ne"`), the required `confirmNoPersonalInfo` checkbox and the submit "Publish public version" / "Update public version". When published, it also shows a "Published {date}" badge, an `InlineAction` "Unpublish" and a link "View on the prayer page" (`/en/prayer#share-<id>`).
      - Else a `role="note"` panel: "This person did not agree to public sharing, so it can't be published." with no form.
    - **Delete:** `ConfirmDialog` "Delete this prayer request" ("This permanently deletes the request and any public version. This can't be undone.").
  - `src/app/admin/(dashboard)/inbox/messages/[id]/page.tsx`: the same sections. The publish form shows only for `kind === TESTIMONY && shareConsent`. Otherwise it shows a note explaining why (not a testimony / no consent).
  - List pages (`inbox/prayer/page.tsx`, `inbox/messages/page.tsx`): add a navy `Badge` "Public" when `publicShare` exists. Change the empty-state description to "They will appear here when someone sends the prayer form." (and "…the contact form."). Update the matching assertion in `e2e/admin-access.spec.ts`.
  - New `src/app/admin/(dashboard)/inbox/settings/page.tsx` (`await requireOwnerPage("/admin/inbox/settings")` first):
    - The retention form (number input 1–60, hint).
    - A purge panel: preview counts, last purge date, and a `ConfirmDialog` with fields `{ confirm: "purge" }`, confirm label "Delete old items", described with the counts.
    - A service status `DetailList`.
    - The `PrivacyNotice`.
  - `src/components/admin/AdminNav.tsx`: add `{ href: "/admin/inbox/settings", label: "Inbox settings" }` to `OWNER`.
  - `src/app/admin/admin-structure.test.ts`: add `inbox/settings` to the owner-only `it.each`.
  - **Verify:** `npm run lint`, `npm run typecheck` and `npx vitest --run --project unit` pass. A manual smoke on a dev server you start yourself on another port against mission_test is optional. Do not touch :3000.

- [ ] 6. Public forms, pages and messages (needs 2–4)
  - `src/components/public/TurnstileWidget.tsx` (client):
    - Loads `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` via `next/script` (`afterInteractive`; handles an already-loaded `window.turnstile` on mount).
    - Renders into a ref with `{ sitekey, action, size: "flexible", "response-field": false, callback, "expired-callback", "error-callback" }`.
    - Exposes `reset()` via a ref/imperative handle and `onToken(token | "")`. Shows a muted "Checking that you're not a robot…" status (`aria-live="polite"`), and on a load/error callback the `FormErrors.turnstileLoadFailed` text.
    - Container labelled with `aria-label={t("Turnstile.label")}`.
  - `src/components/public/PrayerForm.tsx` (client, `useActionState(submitPrayerAction)`, controlled fields, decision 17):
    - Hidden `locale`, `turnstileToken` and honeypot fields.
    - The anonymous `Checkbox` comes first. Name and Email are optional, with hints, and `disabled` + cleared when anonymous.
    - Request `Textarea` (`maxLength 4000`, required).
    - Consent `Checkbox`, unchecked, with a hint.
    - Privacy notice paragraph with a link to `/[locale]/privacy`.
    - Turnstile, then Submit, then the success panel.
    - Field ids are `prayer-<field>` and error ids `prayer-<field>-error`, wired through `invalid`/`errorId`/`aria-describedby`.
  - `src/components/public/ContactForm.tsx`: the same structure. Fields: Name, Email (required), Kind `Select` (General/Testimony/Volunteer), Subject, Message. The testimony consent checkbox renders only when Kind = Testimony (decision 11). A Volunteer hint links to `/[locale]/missions`.
  - `src/components/public/PrayerWall.tsx` (server): a section with an `h2` and a list of `Card`s with `id="share-<id>"`, a `Badge` (Prayer/Testimony), `lang` on the text and a localized date. It returns null when the list is empty.
  - Pages:
    - `src/app/[locale]/prayer/page.tsx`: `PageHero` (eyebrow, h1, intro), a two-column layout at `lg` (form in a `Card` with an aside "How we handle your request" listing private/anonymous/consent points), then `PrayerWall` from `listPublicShares(locale)`. Pass `siteKey` from `getTurnstileConfig()`.
    - `src/app/[locale]/contact/page.tsx`: `PageHero`, the form `Card`, and an aside with "Prefer email? {contactEmail}" (from `getLocalizedSiteSettings`).
    - Both keep `localizedPageMetadata`, `hasLocale` and `setRequestLocale`. `PlaceholderPage` stays for Support.
  - Messages (`messages/en.json` + `messages/ne.json`, identical keys; update `Metadata.prayer.description` / `Metadata.contact.description` only if they still say "coming soon"):
    - `PrayerPage`: eyebrow, title, intro, asideTitle, asidePoints.private/anonymous/consent, wallTitle, wallIntro, wallKinds.PRAYER/TESTIMONY, sharedOn.
    - `PrayerForm`: anonymousLabel, anonymousHint, nameLabel, emailLabel, optional, bodyLabel, bodyHint, consentLabel, consentHint, privacyNotice (with a `{link}` rich tag), privacyLink, submit, sending, successTitle, successBody, sendAnother.
    - `ContactPage`: eyebrow, title, intro, emailAside.
    - `ContactForm`: nameLabel, emailLabel, kindLabel, kinds.GENERAL/TESTIMONY/VOLUNTEER, subjectLabel, messageLabel, volunteerHint, consentLabel, consentHint, privacyNotice, submit, sending, successTitle, successBody, sendAnother.
    - `FormErrors`: required, tooLong (`{max}`), invalidEmail, invalidOption, turnstileMissing, turnstile, turnstileUnavailable, turnstileLoadFailed, rateLimited, generic, fixFields.
    - `Turnstile`: label, loading.
    - Honeypot: label.
    - Wording must stay neutral: no promises such as "our team will pray", no statistics, no tax wording. For example, successBody: "Thank you. Your request was received and is kept private."
  - **Tests (jsdom, wrapped in `NextIntlClientProvider locale="en" messages={en}`; mock `@/server/actions/public-forms` and `next/script`):**
    - `src/components/public/PrayerForm.test.tsx`:
      - Ticking anonymous disables name/email and clears the typed values; unticking re-enables them empty.
      - Consent is unchecked by default.
      - Every input has a label.
      - A VALIDATION state renders `FormErrors` text linked via `aria-describedby` and focuses the first invalid field.
      - A RATE_LIMITED state renders an alert.
      - A success state renders the success heading with focus.
      - The honeypot is inside `aria-hidden` with `tabIndex=-1`.
    - `src/components/public/ContactForm.test.tsx`: the consent checkbox appears only for Testimony and disappears (unchecked) when the kind changes back.
    - `src/components/public/TurnstileWidget.test.tsx`: with a fake `window.turnstile`, render is called with sitekey/action and the callback token is forwarded.
  - **Verify:** `npm run lint`, `npm run typecheck`, `npx vitest --run --project unit` (incl. `messages.test.ts`) and `npm run build` all pass.

- [ ] 7. Docs and env (independent of 5–6; do after 3)
  - `.env.example`: replace the Phase 6 placeholder block with commented, empty entries and one-line explanations:
    - `# TURNSTILE_SITE_KEY=`, `# TURNSTILE_SECRET_KEY=` (empty -> Cloudflare test keys).
    - `# RESEND_API_KEY=`, `# RESEND_FROM_EMAIL=` (an address on a domain verified in Resend), `# CONTACT_TO_EMAIL=` (defaults to the Settings contact email).
    - `# FORM_RATE_LIMIT_PER_HOUR=` (default 5).
    - Remove `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. No real values, no AWS mentions.
  - `README.md`:
    - Phase status: Phase 6 done.
    - Environment variables table: the new vars.
    - Admin guide:
      - Reading the inbox, notes and status.
      - Publishing only with consent and editing out personal details.
      - Unpublishing when someone withdraws consent.
      - Deleting.
      - Inbox settings: retention and "purge regularly, for example monthly".
    - "Setting up Turnstile": create a widget in the Cloudflare dashboard, add the hostnames (production domain + `localhost` optional), copy the keys into Vercel env, redeploy, and check that Inbox settings shows "live keys".
    - "Setting up Resend": create an account, verify the sending domain (DNS records), create an API key, set the three env vars, and check that Inbox settings shows "configured".
    - Security notes: rate limit + hashed IP; Turnstile fails closed with real keys; the email contains a link only; Phase 9 CSP needs `challenges.cloudflare.com`.
    - Go-live checklist: real Turnstile + Resend keys; re-read the privacy policy against the implemented behaviour.
  - `src/content/legal/privacy.ts`: re-read it against decisions 1–16. The current text already matches: optional name/email, anonymous, private, consent + edited version, hashed IP kept a short time, Turnstile, Resend link-only, owner-set retention. Change it only if something contradicts; if so, update en and ne together and keep `legal.test.ts` passing.
  - **Verify:** `npm run format:check` exits 0. `git status --short` shows `.env` untracked/ignored and `.env.example` has no `=\S` assignments other than `NEXT_PUBLIC_SITE_URL` and `DATABASE_URL`.

- [ ] 8. E2E specs (needs 5–7)
  - `e2e/helpers/turnstile.ts`: `stubTurnstile(page, { pass = true } = {})` (decision 18), plus `uniqueMarker(prefix)` (a timestamp + random suffix for findable text).
  - `playwright.config.ts`:
    - Add `FORM_RATE_LIMIT_PER_HOUR: "100"` to `webServer.env` (decision 5).
    - Add `prayer-form.spec.ts`, `contact-form.spec.ts`, `admin-inbox.spec.ts` and `phase6-screenshots.spec.ts` to the **admin-mutations** project, which runs after `public` and `admin-readonly` (those assert an empty inbox) and is serial.
  - `e2e/prayer-form.spec.ts` (`stubTurnstile` in `beforeEach`; the admin side uses a second context with `OWNER_STATE`):
    1. Normal submit on `/en/prayer`: fill name/email/body (marker) and leave consent unchecked. The success heading is visible and focused. In the admin, `/admin/inbox/prayer` lists the name with "Sharing consent: no", and the detail shows the body. The detail shows the "can't be published" note and **no** "Publish public version" button. `/en/prayer` and `/ne/prayer` do **not** contain the marker.
    2. Anonymous: type a name/email, tick anonymous, and assert both inputs are disabled with empty values. Submit. The admin list row shows "Anonymous", the detail shows "Hidden (anonymous)" and the typed name is nowhere on the page. Not public.
    3. Consent + publish: submit with consent and the body "… call me at person-x@example.org". In the admin, publishing with the email left in -> a field error. Edit to clean text (marker2) + confirm -> a success toast. `/en/prayer` shows marker2 in the wall and does not contain the original body or the submitter's name. Unpublish -> marker2 is gone from `/en/prayer`.
    4. Nepali: `/ne/prayer` submit with a Devanagari body -> success in Nepali. The admin detail shows it with `lang="ne"`.
    5. Validation: an empty body submit -> the error text is visible, the textarea has `aria-invalid="true"` and `aria-describedby` pointing to the error, focus is on the textarea, and typed name/email values are preserved.
    6. Honeypot: fill `website` via `page.locator('[name=website]').fill(..., { force: true })` and submit -> success shown, but the marker is absent from the admin list.
    7. Turnstile not completed (`stubTurnstile({ pass: false })`) -> the `FormErrors.turnstileMissing` (or `turnstile`) message and no row in the admin list.
  - `e2e/contact-form.spec.ts`:
    1. General message on `/en/contact` -> success. It appears in `/admin/inbox/messages` with kind General. Consent is not offered on the detail page and the publish form is absent.
    2. Choosing Testimony shows the consent checkbox (unchecked). Switching to Volunteer hides it.
    3. A testimony with consent -> the admin publishes an edited version -> it appears on `/en/prayer` with the "Testimony" badge. Unpublish.
    4. A testimony without consent -> no publish form.
    5. `/ne/contact` submit works.
  - `e2e/admin-inbox.spec.ts`:
    - Save a private note (toast, persists after reload, not shown publicly).
    - Change status.
    - Delete via ConfirmDialog -> redirected list with a "Deleted." toast, and the row is gone.
    - As OWNER, `/admin/inbox/settings`: set retention to 6 (toast + persisted), see the service status "test keys" / "not configured", and purge (dialog -> toast with counts; recent items remain).
    - As EDITOR (`EDITOR_STATE`): `/admin/inbox/settings` shows the forbidden page and the nav has no "Inbox settings".
  - `e2e/a11y.spec.ts`: add `/prayer` and `/contact` (en + ne, 1280 + 375) with `stubTurnstile(page)` before `goto`. Add a contact case with Testimony selected (consent visible). Add a prayer case after a validation error (error state).
  - `e2e/admin-a11y.spec.ts`: add `/admin/inbox/settings` (1280 + 375). Prayer detail pages with the publish form are scanned in `admin-inbox.spec.ts` or `prayer-form.spec.ts` (data is needed, so it stays in the mutations project). Use the same `seriousViolations` helper (copy, or move it to `e2e/helpers/axe.ts`).
  - `e2e/admin-access.spec.ts`: update the empty-inbox text, and add `/admin/inbox/settings` to the EDITOR-forbidden list, if such a list exists.
  - Update `e2e/navigation.spec.ts` / `routing.spec.ts` only if they assert placeholder text on `/prayer` or `/contact` (currently they only check 200 + h1; keep the h1 present).
  - **Verify:** `npm run test:e2e` (≈10–15 min; it rebuilds) passes with 0 failed and 0 flaky, more than 179 tests, and the `[axe]` lines for the new pages show `serious/critical=0`.

- [ ] 9. Screenshots (needs 8)
  - `e2e/phase6-screenshots.spec.ts` (admin-mutations project, serial, `stubTurnstile`, `document.fonts.ready`, scroll to the bottom and back before capturing full-page shots so lazy content is loaded). Save to `c:\Users\rasaily\Downloads\mission app\.agents\screenshots\phase6\` (use `path.join(process.cwd(), ".agents", "screenshots", "phase6")`, matching `ADMIN_SCREENSHOTS` in `e2e/helpers/admin.ts`):
    - `prayer-{en,ne}-{375,1280}.png`: empty form, full page.
    - `prayer-anonymous-en-375.png`: anonymous ticked, fields disabled.
    - `prayer-error-{en,ne}-375.png`: validation state.
    - `prayer-success-{en,ne}-1280.png`.
    - `prayer-wall-{en-1280,ne-375}.png`: after publishing one prayer and one testimony via the admin within the spec.
    - `contact-{en,ne}-{375,1280}.png`, plus `contact-testimony-en-1280.png` (consent visible) and `contact-success-ne-375.png`.
    - Admin: `admin-prayer-detail-consent-{1280,375}.png` (publish form), `admin-prayer-detail-noconsent-1280.png`, `admin-message-detail-testimony-1280.png`, `admin-inbox-settings-{1280,375}.png` and `admin-prayer-list-1280.png` (badges).
  - **Look at every image** (open the files) and confirm:
    - Navy/ivory/beige/gold, no horizontal overflow at 375.
    - The Turnstile stub box fits.
    - Devanagari renders without tofu.
    - Labels are aligned, the disabled state is visibly distinct (not just colour), and error text is legible red.
    - The header is unchanged (logo + name far left, nav + switcher centred on xl, gold CTA right).
  - Record observations per image in verification.md, and fix any visual defect before moving on.
  - **Verify:** the files exist and are non-empty, and each is noted in verification.md.

- [ ] 10. Full verification and evidence (needs all)
  - Run in order (never two test commands at once), and record each command, its exit code and the key counts in `.agents/tasks/phase6/verification.md`:
    1. `npm run lint`
    2. `npm run typecheck`
    3. `npm run format:check` (run `npm run format` first if needed)
    4. `npm run build`
    5. `npm test` (> 474, all pass)
    6. `npm run test:e2e` (> 179, all pass)
  - Grep checks (PowerShell `Select-String` over `src`, `e2e`, `scripts`, `prisma`, `README.md`, `.env.example`, excluding `node_modules`/`src/generated`):
    - No `aws|amazon|\bS3\b|cognito|\bSES\b` (case-insensitive).
    - No `NEXT_PUBLIC_TURNSTILE` and no other new `NEXT_PUBLIC_`.
    - No hard-coded real secrets (`re_[A-Za-z0-9]{10,}`, `0x4AAAA`).
    - `git ls-files .env` prints nothing.
  - Privacy evidence: paste the db-test names that prove anonymity null-out, consent gating, no raw IP stored, and the email/log redaction.
  - Repeat the read-only mission_dev check (owner count, `ministryName` = 'Bible Distribution Ministry', `logoUrl`, `inboxRetentionMonths`) and `npx prisma migrate status`.
  - In verification.md, list the decisions, known limitations, and user follow-ups:
    - No automatic purge.
    - The wall shows the 12 most recent items only.
    - The PII check is heuristic, and the admin confirmation remains the real control.
    - Test Turnstile keys in production mean no bot challenge.
    - User actions: create Turnstile + Resend accounts, set the env vars, restart `npm run dev` after the migration, and have a native speaker review the Nepali strings.
  - **Verify:** every command exits 0, `git status` shows only Phase 6 changes, no files were committed, and mission_dev is intact.
