# Design review: Phase 4 + 5 (revision 2)

Reviewed: `.agents/tasks/phase4-5/design.md` (revision 2). I checked it against the original user request, the fixed decisions in the step prompt and the current codebase. I re-checked all 12 findings from the previous review (4 MEDIUM, 8 NIT). Each one is addressed in the text, and section 21.1 maps every finding to where it was fixed.

Verdict: APPROVED (0 HIGH, 0 MEDIUM, 7 NIT).

The design stands on its own. Every fixed decision is covered:
- no AWS anywhere;
- Vercel + Neon in production;
- Docker-free local Postgres that tests start and stop themselves, using `embedded-postgres`. `npx prisma dev` was the example, and the design gives a measured reason for rejecting it;
- Prisma pinned to 7.10.1, not the `8.0.0-rc` `latest` tag;
- Auth.js v5 Credentials + Argon2id + TOTP, with AES-256-GCM secrets from `TOTP_ENCRYPTION_KEY`;
- OWNER exactly one (CLI only, advisory lock) and EDITOR max 3 active, enforced in the service under an advisory lock;
- atomic lockout and IP limiting;
- server-side guards on every page, action and route handler, enforced by static tests;
- Zod + AuditLog in one wrapper;
- server-side sanitized Markdown;
- en/ne columns with ne->en fallback;
- `/admin` excluded from the proxy and sitemap, plus robots, noindex and security headers;
- seeded demo content that keeps the public site identical;
- the header layout unchanged;
- `taxDeductibleVerified` OWNER-only and stored only;
- no commits and no worktree;
- exact pinned versions.

The remaining items are NITs the coder can apply while implementing.

On scope: the user asked to "upload pictures and video". The design defers real uploads to Phase 7 (Vercel Blob). It is explicit and honest about that (section 1.5: a hint on every URL field, plus the README). That matches the phase split the workflow is executing, so I'm not raising it as a finding.

## Method

- Read the full design (sections 0 to 21).
- Read the code the design relies on or changes:
  - `src/lib/content.ts`, `src/lib/content.test.ts`, `src/config/site.ts`, `src/content/demo/{types,posts,events,verses,media}.ts`;
  - `src/proxy.ts`, `playwright.config.ts`, `vitest.config.mts`, `package.json`, `.npmrc`, `.gitignore`, `.prettierignore`, `eslint.config.mjs`, `.env.example`, `next.config.ts`;
  - `src/app/layout.tsx`, `src/app/not-found.tsx`, `src/app/[locale]/{layout,page}.tsx`, `src/lib/metadata.ts`, `src/components/layout/Header.tsx`, `src/components/home/{FeaturedContent,UpcomingEvents}.tsx`, `src/lib/messages.test.ts`, `src/components/home/RecentUpdates.test.tsx`;
  - the `e2e/*.spec.ts` assertions that touch the ministry name and the Home messages.
- Ran these checks:
  - the AC31 hygiene scan on the current tree (0 matches) and `git check-ignore .env` (prints `.env`);
  - `server-external-packages.jsonc` in the installed `next` (lists `@node-rs/argon2`, `@prisma/client`, `pg`, `prisma`);
  - `next` 16.4.3 type definitions (`updateTag`, `revalidatePath(path, 'layout')` and `unstable_rethrow` all exist);
  - tsx 4.23.15 in a CommonJS package, in a temp folder that I then removed: `import.meta.url`, the `isMain` check and `createRequire(import.meta.url)` all work;
  - the Vitest count in `.agents/tasks/verification.md` (55 tests).

## Findings

### 1. NIT: email normalization isn't stated for `createEditorSchema` or the CLI

Where: section 9 (`createEditorSchema`: "`email`"), section 14 (CLI validation), and section 4.2 (`AdminUser.email` comment "stored lower-cased + trimmed").

Problem: only `loginStep1Schema` (section 7.6) says it trims and lower-cases. If the editor or owner create path stores `Bob@Example.org` as typed, step 1 looks up `bob@example.org` and that account can never sign in.

Fix: define one shared schema in `src/lib/validation/common.ts` and use it in `loginStep1Schema`, `createEditorSchema` and the CLI:
```ts
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
```
Add a unit test: `" Bob@Example.ORG "` parses to `"bob@example.org"`.

### 2. NIT: how the OWNER/E2E user id is known before sealing the TOTP secret isn't specified

Where: section 14 ("new TOTP secret sealed with AAD `totp:<id>`") and section 3.5 step 5 (`seal(secret, "totp:<id>", …)`).

Problem: `id` is `@default(cuid())`, so the caller doesn't know it until after the insert. The order of operations is left open.

Fix: in one transaction, `create` the user with `totpSecretEnc: null, totpEnabled: false`. Then `update` it with `totpSecretEnc: seal(secret, \`totp:${user.id}\`, key), totpEnabled: true`. Use the same order in `create-owner --reset` (there the id is already known) and in `e2e-prepare`.

### 3. NIT: `E2E: "1"` in `webServer.env` has no defined consumer

Where: section 3.5 (Playwright `webServer.env`).

Problem: nothing in the design reads `process.env.E2E`. An undefined flag invites test-only behaviour to creep into production code.

Fix: remove `E2E: "1"`. If it is kept, state its only use, and add a rule that no file under `src/` reads `process.env.E2E` (a one-line check in `script-imports.test.ts`).

### 4. NIT: the trust assumption behind the IP rate-limit key isn't documented

Where: section 7.2 (`x-forwarded-for` first hop, else `x-real-ip`) and section 7.6 step 1.2.

Problem: the key is only trustworthy because Vercel overwrites `x-forwarded-for` with the real client IP. On any other host, or on a bare `next start`, a client can rotate the header and get around the 20-per-15-minute IP limit. The per-account lockout still caps password guessing, so this isn't a hole on the target platform. It is an unstated assumption.

Fix: add one line to section 7.2 and to the README security notes: "The IP key relies on Vercel overwriting `x-forwarded-for`. Behind any other proxy, derive the IP from that proxy's trusted header. The per-account lockout is the primary control."

### 5. NIT: on a first Neon deploy, the site can go out empty before seeding

Where: README outline section 19.5 and section 6.4 (static pages, `revalidate = 3600` on the home page only).

Problem: the outline sets the Vercel env vars, lets `vercel-build` deploy, and seeds Neon afterwards. The first build then prerenders the home page with no posts, events or verse. It stays that way for up to an hour, and the other pages until an admin edit triggers `revalidatePath`.

Fix: in README section 5, order the one-time steps as: `db:deploy` -> `db:seed` -> `admin:create-owner`, then trigger the first deploy (or "Redeploy" in Vercel after seeding). State that any later content edit refreshes the pages automatically.

### 6. NIT: the `Cache-Control: no-store` header can't be asserted exactly

Where: section 12 (admin security headers) and section 17.3 (`admin-access.spec.ts`: "security headers present on `/admin/login`").

Problem: Next.js sets its own `Cache-Control` on dynamic responses (`private, no-cache, no-store, max-age=0, must-revalidate`). It can override a `Cache-Control` set in `next.config.ts` `headers()`. An exact-equality assertion would fail even though the response is not cacheable.

Fix: the E2E asserts `cache-control` contains `no-store`. It asserts the other six headers exactly.

### 7. NIT: what an empty `publishedAt` means on update is undefined

Where: section 9 (`postSchema.publishedAt` optional; "On publish with no `publishedAt` -> now") and section 11 (`publishedAt ??= now`).

Problem: on an edit of an already published post, an empty date field could be read as "clear it", "keep it" or "set it to now". Each reading gives a different public sort order.

Fix: the edit form always pre-fills `publishedAt`. In the service, an empty value on update means "keep the stored value". On publish, only a stored `null` becomes `now`. Unpublish never touches it. Add a unit test for update with an empty `publishedAt` on a PUBLISHED post: the date is unchanged.

## Verified assumptions

- `src/lib/content.ts` exports exactly `getRecentUpdates`, `getFeaturedContent`, `getUpcomingEvents`, `getVerseById` and `getFeaturedVerse`. Its view models match section 6.2 (`durationMinutes: number`, `description: string`, ISO strings). The current `getFeaturedVerse` throws when the verse is missing, as the design says.
- `src/content/demo/*` ids are `post-1..6`, `event-1..4` (3 UPCOMING, 1 COMPLETED), `isaiah-6-8`/`john-3-16`/`psalm-23-1` and `media-1..3`. `FEATURED_VERSE_ID = "isaiah-6-8"`. Media kinds in the data are SERMON/VIDEO only (the AUDIO mapping is unused but harmless). Every record has `isDemo: true`.
- `src/config/site.ts` has a single `name`/`email`, three placeholder social entries and `isDemo: true`. `getSiteConfig()` is used by robots, sitemap, the locale layout, `metadata.ts`, Header, Footer, PlaceholderPage and Hero, which matches the consumer list in section 6.3.
- `Home.heroEyebrow`, `missionStatement`, `introBody1` and `introBody2` exist in both message files. They are used only by `Hero.tsx` and `MinistryIntro.tsx`, and no E2E spec references them. `messages.test.ts` enforces key parity and forbids "Demo Ministry" and tax/charity claims, which is consistent with moving the values into `site.ts`.
- `src/proxy.ts` is `createMiddleware(routing)` with matcher `/((?!api|trpc|_next|_vercel|.*\\..*).*)`. The design's segment-anchored matcher and the `isAdminPath` wrapper are a correct change.
- `playwright.config.ts` has a single chromium project, port 3210, `webServer` = build + start, and `reuseExistingServer: !CI`. The design's changes are described accurately.
- `src/app/layout.tsx` is a pass-through, and `src/app/[locale]/layout.tsx` renders `<html>` with the four `next/font/google` fonts. An `admin/layout.tsx` that renders its own `<html>` therefore follows the existing pattern.
- `Header.tsx` is brand/logo left, nav + language center, CTA right. It has no About/Support/Contact links. The design changes only the source of the name text (plus the optional `logoUrl` image, which is null after seeding).
- `e2e/routing.spec.ts` asserts the hero h1 "Demo Ministry" and the page title containing "Demo Ministry". These hold with the seeded `ministryName`, and the settings E2E runs after `public` and restores the name.
- `.npmrc` has `save-exact=true`. `package.json` has no ranges, and `pretypecheck` is currently `next typegen`.
- `.gitignore` already ignores `.env*` except `.env.example` (`git check-ignore .env` prints `.env`). Prettier 3 also honours `.gitignore`, so `.local/`, `src/generated/` and `playwright/.auth/` are skipped by `format:check` once they are added.
- The AC31 scan pattern returns nothing on the current tree.
- In the installed Next 16.4.3: `server-external-packages.jsonc` lists `@node-rs/argon2`, `@prisma/client`, `pg` and `prisma`. `updateTag`, `revalidatePath(path, "layout")` and `unstable_rethrow` exist.
- tsx 4.23.15 under CommonJS (a package without `"type"`): `import.meta.url` is populated, the `pathToFileURL(path.resolve(argv[1])).href === import.meta.url` check is true for the entry file, and `createRequire(import.meta.url)` works. This confirms the section 3.2 approach.
- Node is v24.22.1, so `process.loadEnvFile` is available.
- Vitest currently runs 55 tests and Playwright 38, per `.agents/tasks/verification.md` and the last run.
- These are concurrency-correct as specified:
  - the reserve-then-verify account counter: a row-locked `UPDATE … RETURNING` gives unique counts 1..N, so there are at most 5 real-hash verifications between locks;
  - the IP limit: insert-then-count means the k-th committed insert sees at least k rows;
  - `applyLock`: a conditional `updateMany` gives one lock and one audit row;
  - challenge single-use and TOTP replay: conditional `updateMany` calls inside one transaction, each required to affect exactly 1 row.

## Unverified / wrong assumptions

No wrong assumptions found. These stay UNVERIFIED. Each one is already listed in section 20 with a concrete verification step and a fallback, which is the right handling:
- Turbopack bundling the Prisma 7 `prisma-client` output (fallback: `serverExternalPackages`).
- `prisma generate` with an empty datasource URL (fallback: placeholder URL).
- `revalidatePath` from a Server Action making the next request fresh (E2E AC9/AC10; fallback: `unstable_cache` + `updateTag`).
- A real 307 from page guards with no `loading.tsx` while the dashboard layout returns `null`. This is plausible because App Router renders child segments as separate seed data, so the page guard still runs. AC14 checks it with `maxRedirects: 0`.
- `admin/[...rest]` not shadowing `(dashboard)` routes (E2E AC12 + `/admin/does-not-exist`).
- `/admin/:path*` header source also matching `/admin` (E2E asserts both).
- next-auth 5.0.0-beta.32 runtime with Next 16.4.3 / React 19.3 (peer range OK; E2E login).
- `createRequire(import.meta.url)(platformPkg)` resolving `@embedded-postgres/windows-x64`. `createRequire` itself is now verified under tsx CJS. Resolving the platform package needs the install (first `npm run db:start`).
- Prisma 7 `migrate reset` no longer seeding (harmless, since the seed is idempotent).
- Whether the embedded-postgres spike ran inside this exact space-containing project path. The design passes every argument as an array to `spawnSync`, so quoting is handled. The first `npm run db:start` confirms it.
