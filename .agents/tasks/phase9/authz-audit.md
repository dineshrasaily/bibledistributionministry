# Phase 9 authz re-audit (route handlers, server actions, admin pages)

Built by reading each function (`src/server/actions/*.ts`, `src/app/api/**/route.ts`, `src/app/admin/**/page.tsx`, `src/server/auth/route-guard.ts`, `src/server/actions/run-admin-action.ts`, `src/server/forms/public-submission.ts`, `src/server/donations/checkout.ts`, `src/server/auth/login.ts`), not from the tests.

Legend:
- **RAA(ADMIN|OWNER)**: `runAdminAction` (guard `requireAdmin`/`requireOwner` → Zod `safeParse` → mutation + `AuditLog` row in one transaction → revalidate). Deactivated users and bumped `sessionVersion` are rejected by the guard.
- **SA origin**: Next's built-in server-action Origin/Host check (CSRF).
- **RAR**: `requireAdminRoute(request, { mutation, role })` (401 without session, 403 FORBIDDEN for owner-only, 403 FORBIDDEN_ORIGIN for cross-origin mutations via `src/lib/same-origin.ts`).

Result: **55 server-action exports, 8 route-handler methods (7 files), 30 admin pages. No gaps found; no code change needed.** The static coverage tests (`src/server/actions/guard-coverage.test.ts`, `src/app/api/route-guard-coverage.test.ts`) already cover every category found here (wrapper, self-guarded, login, public pipeline, admin route guard), so they were not extended.

## Server actions (55)

| File | Export | Area | Guard | Origin/CSRF | Zod | Rate limit | Audit | Verdict |
|---|---|---|---|---|---|---|---|---|
| account.ts | changePasswordAction | admin | `requireAdmin` (phase A, self) then RAA(ADMIN) (phase B) | SA origin | changePasswordSchema, newPasswordSchema | credential lockout (`reserveCredentialAttempt`, 5 tries → 15 min, signs out) | yes (failure row + `account.password.change`) | OK |
| auth.ts | startLoginAction | public (login) | none (it *is* the login); `safeNext` on `next` | SA origin | loginStep1Schema | per-hashed-IP (`reserveIpAttempt`) + per-account lockout | login events in AuditLog via beginLogin | OK |
| auth.ts | completeLoginAction | public (login) | needs the httpOnly sameSite=strict challenge cookie; the session is minted only by Auth.js `authorize` | SA origin | loginStep2Schema | challenge attempts + lockout | yes (in authorize) | OK |
| auth.ts | cancelLoginAction | public (login) | none needed: only deletes the caller's own challenge (by the hash of their cookie) and the cookie | SA origin | n/a (no input) | n/a | no (no state of value) | OK, note: cannot affect anyone else's challenge |
| auth.ts | logoutAction | admin | `requireAdmin` (self); an AuthzError still signs out | SA origin | n/a (no input) | n/a | yes (`auth.logout`, bumps sessionVersion) | OK, note: anonymous call only clears the caller's cookie |
| categories.ts | createCategoryAction, updateCategoryAction, deleteCategoryAction | admin | RAA(ADMIN) | SA origin | categorySchema / updateCategorySchema / byIdSchema | n/a | yes | OK |
| events.ts | createEventAction, updateEventAction, setEventStatusAction, deleteEventAction | admin | RAA(ADMIN) | SA origin | eventSchema / updateEventSchema / eventPublishSchema / byIdSchema | n/a | yes | OK |
| galleries.ts | createGalleryAction, updateGalleryAction, setGalleryStatusAction, deleteGalleryAction, addGalleryItemsAction, moveGalleryItemAction, removeGalleryItemAction | admin | RAA(ADMIN) (shared `common.role`) | SA origin | gallerySchema / updateGallerySchema / galleryStatusSchema / byIdSchema / galleryAddItemsSchema / galleryMoveSchema / galleryRemoveItemSchema | n/a | yes | OK |
| inbox.ts | setPrayerStatusAction, setMessageStatusAction, setPrayerNoteAction, setMessageNoteAction, deletePrayerAction, deleteMessageAction | admin | RAA(ADMIN) | SA origin | prayerStatusSchema / messageStatusSchema / inboxNoteSchema / byIdSchema | n/a | yes (no request body in metadata) | OK |
| inbox.ts | publishPrayerAction, publishTestimonyAction | admin | RAA(ADMIN); the service refuses when `shareConsent` is false | SA origin | publishShareSchema | n/a | yes | OK |
| inbox.ts | unpublishPrayerAction, unpublishTestimonyAction | admin | RAA(ADMIN) | SA origin | byIdSchema | n/a | yes | OK |
| inbox.ts | setInboxRetentionAction, purgeOldInboxAction | owner | RAA(OWNER) | SA origin | retentionSchema / purgeSchema | n/a | yes | OK |
| markdown.ts | previewMarkdownAction | admin | `requireAdmin` (self) → UNAUTHENTICATED/FORBIDDEN result | SA origin | `z.string().max(50_000)` | n/a | no: read-only, renders through the production sanitizer, writes nothing | OK, note: read-only by design |
| media.ts | createMediaAction, updateMediaAction, setMediaStatusAction, deleteMediaAction | admin | RAA(ADMIN) | SA origin | mediaSchema / updateMediaSchema / mediaStatusSchema / byIdSchema | n/a | yes | OK |
| posts.ts | createPostAction, updatePostAction, setPostStatusAction, deletePostAction | admin | RAA(ADMIN) | SA origin | postSchema / updatePostSchema / postStatusSchema / byIdSchema | n/a | yes | OK |
| public-donations.ts | startCheckoutAction | public | none (public); `runCheckoutStart`: honeypot → Zod → giving open (key + webhook secret + `donationsEnabled`, Phase 9) → rate limit → Stripe | SA origin | donation schema (server-side min/max, USD) | per hashed IP (`DONATION_RATE_LIMIT_PER_HOUR`) | n/a (public; no PII logged) | OK |
| public-forms.ts | submitPrayerAction, submitContactAction | public | none (public); `runPublicSubmission`: honeypot → Zod → rate limit → Turnstile (server-side) → create → notify (link only) | SA origin | prayerSubmissionSchema / contactSubmissionSchema (sanitized, length-limited, anonymity clears PII) | per hashed IP (`FORM_RATE_LIMIT_PER_HOUR`); raw IP never stored | n/a (public) | OK |
| settings.ts | updateSiteSettingsAction | owner | RAA(OWNER) | SA origin | settingsSchema (`isSafeUrl` on URLs incl. logoUrl) | n/a | yes | OK |
| uploads.ts | registerUploadAction | admin | RAA(ADMIN) | SA origin | registerUploadSchema (MIME/size allow-list, key rules) | n/a | yes | OK |
| users.ts | createEditorAction, setUserActiveAction, resetEditorTotpAction, setEditorPasswordAction | owner | RAA(OWNER); max 3 editors enforced in the service | SA origin | createEditorSchema / setUserActiveSchema / byIdSchema / setEditorPasswordSchema | n/a | yes | OK |
| verses.ts | createVerseAction, updateVerseAction, setVerseStatusAction, setFeaturedVerseAction, clearFeaturedVerseAction, deleteVerseAction | admin | RAA(ADMIN) | SA origin | verseSchema / updateVerseSchema / verseStatusSchema / featureVerseSchema / byIdSchema | n/a | yes | OK |

Count: account 1 + auth 4 + categories 3 + events 4 + galleries 7 + inbox 12 + markdown 1 + media 4 + posts 4 + public-donations 1 + public-forms 2 + settings 1 + uploads 1 + users 4 + verses 6 = **55** (`run-admin-action.ts` is not counted: it has no `"use server"` directive, so its wrapper and helpers can't be called from the browser). The plan estimated 63 exports; the actual count read from the files is 55.

## Route handlers (8 methods)

| Route | Method | Area | Guard | Origin/CSRF | Zod | Rate limit | Audit | Verdict |
|---|---|---|---|---|---|---|---|---|
| `/api/admin/donations/export` | GET | owner | RAR `{ mutation: false, role: "OWNER" }` → 401/403 | n/a (read; `no-store`, admin CSP) | donation list query parser | n/a | export recorded in AuditLog | OK |
| `/api/admin/media/library` | GET | admin | RAR `{ mutation: false }` | n/a (read) | list query parser | n/a | n/a (read) | OK |
| `/api/admin/uploads/blob` | POST | admin | blob mode only (404 otherwise); only `blob.generate-client-token` bodies; RAR `{ mutation: true }` then `requireAdmin` again inside `onBeforeGenerateToken` | `same-origin.ts` | blobClientPayloadSchema + pathname/kind check; content types + max size per kind | n/a | yes (`media.upload.token`) | OK (no unauthenticated upload-completed callback) |
| `/api/admin/uploads/local` | POST | admin | RAR `{ mutation: true }` (local mode only) | `same-origin.ts` | upload policy (MIME sniff, size, key) | n/a | yes | OK |
| `/api/stripe/webhook` | POST | machine | none (Stripe); 503 unless `webhookReady`; Stripe-Signature HMAC over the raw body (`constructEvent`) | Stripe signature | event shape checks per type; amounts validated | n/a (signature-gated); idempotent by stored event id | n/a (StripeEvent rows) | OK |
| `/api/uploads/[...key]` | GET, HEAD | public | none: serves public media files; local mode only; strict key rules + path containment; 404 otherwise | n/a (read) | key regex | n/a | n/a | OK (`sandbox` CSP, nosniff) |
| `/api/auth/[...nextauth]` | GET, POST | auth | Auth.js handlers; credentials provider `admin-totp` needs a valid challenge + TOTP; Auth.js CSRF token | Auth.js CSRF | in authorize | via login lockout | yes (login) | OK |

## Admin pages (30)

| Page | Guard | Verdict |
|---|---|---|
| `/admin` (dashboard) | requireAdminPage | OK |
| `/admin/account` | requireAdminPage | OK |
| `/admin/posts`, `/posts/new`, `/posts/[id]` | requireAdminPage | OK |
| `/admin/categories`, `/categories/[id]` | requireAdminPage | OK |
| `/admin/verses`, `/verses/new`, `/verses/[id]` | requireAdminPage | OK |
| `/admin/events`, `/events/new`, `/events/[id]` | requireAdminPage | OK |
| `/admin/media`, `/media/new`, `/media/[id]` | requireAdminPage | OK |
| `/admin/galleries`, `/galleries/new`, `/galleries/[id]` | requireAdminPage | OK |
| `/admin/inbox/prayer`, `/inbox/prayer/[id]`, `/inbox/messages`, `/inbox/messages/[id]` | requireAdminPage (prayer requests visible only to OWNER/EDITOR) | OK |
| `/admin/forbidden` | requireAdminPage | OK |
| `/admin/settings` | requireOwnerPage | OK |
| `/admin/donations` | requireOwnerPage (EDITOR: forbidden, per the Phase 8 decision) | OK |
| `/admin/inbox/settings` | requireOwnerPage | OK |
| `/admin/users` | requireOwnerPage | OK |
| `/admin/audit` | requireOwnerPage | OK |
| `/admin/login` | public; redirects signed-in admins via `safeNext` | OK |
| `/admin/[...rest]` | `notFound()` only, renders nothing | OK |

The dashboard layout (`src/app/admin/(dashboard)/layout.tsx`) never redirects; each page awaits its own guard (unchanged design). Phase 9 only passes `logoUrl` to the shell there.

## Other checks
- `NEXT_PUBLIC_*`: only `NEXT_PUBLIC_SITE_URL` (public by nature). Enforced by `src/test/env-and-secrets.test.ts`.
- Every admin/auth response also carries the admin CSP (`frame-src 'none'`, `form-action 'self'`), `Cache-Control: no-store` and `X-Robots-Tag: noindex, nofollow`.
