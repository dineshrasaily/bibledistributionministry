# Phase 9 npm audit

Raw output: `npm-audit-before.txt` / `npm-audit-full-before.txt` (before), `npm-audit-after.txt` / `npm-audit-full-after.txt` (after).

| | `npm audit --omit=dev` | `npm audit` (incl. dev) |
|---|---|---|
| Before | 4 high (exit 1) | 4 high (exit 1), the same 4 |
| After | **0 vulnerabilities** (exit 0) | **0 vulnerabilities** (exit 0) |

## Advisory
- **GHSA-mrhx-c7xc-m3w5** (high): Zod < 4.6.6 can exhaust memory while validating oversized constrained collections.
- Path: `@vercel/blob@2.8.2` → `@vercel/oidc@3.8.10` → `@vercel/cli-config@0.3.1` → `zod@4.1.11` (pinned exactly by cli-config). The other 3 "high" entries are the same advisory reported on each parent.
- No upstream fix: the newest `@vercel/cli-config` (0.3.4) still depends on `zod: 4.1.11` (`npm view @vercel/cli-config@latest dependencies`). `npm audit fix --force` would downgrade `@vercel/blob` to 2.4.0 (breaking), so it was not used.

## Action
Exact npm override in `package.json` (same major, the version the app already pins):

```json
"overrides": { "@vercel/cli-config": { "zod": "4.6.7" } }
```

`npm install` then dedupes it: `npm ls zod` shows `@vercel/cli-config@0.3.1 └── zod@4.6.7 deduped`. `package-lock.json`: 3 insertions, 11 deletions (the nested zod 4.1.11 copy removed).

Gate: the full unit/db suite (including the Vercel Blob driver tests) and the E2E suite (including the upload specs) pass with the override; see verification.md. Risk is low either way: cli-config uses zod server-side to parse a local Vercel CLI config file, never visitor input.

Also added in Phase 9: `sharp@0.35.5` as an exact devDependency (same version Next already installs; the lockfile only flips it from optional/transitive to dev).
