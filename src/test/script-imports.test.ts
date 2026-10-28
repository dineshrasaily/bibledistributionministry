// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Section 6.1a: scripts run under plain tsx (no react-server condition), so
 * they must only import pure modules, and pure modules must not import
 * server-only.
 */
const ROOT = process.cwd();

const FORBIDDEN_SPECIFIERS = [
  "@/lib/db",
  "@/lib/env",
  "@/server/auth/guards",
  "@/server/auth/login",
  "@/server/services/",
  "@/server/actions/",
  "@/auth",
];

const PURE_MODULES = [
  "src/lib/prisma-factory.ts",
  "src/server/auth/password.ts",
  "src/server/auth/totp.ts",
  "src/server/auth/secret-box.ts",
  "src/server/auth/keys.ts",
  "src/server/auth/lockout.ts",
  "src/lib/localize.ts",
  "src/lib/content-mappers.ts",
  "src/lib/about-mappers.ts",
  "src/lib/pagination.ts",
  "src/lib/share-links.ts",
  "src/lib/sitemap-entries.ts",
  "src/lib/donation-wording.ts",
  "src/lib/validation/public-query.ts",
  // Phase 6
  "src/lib/sanitize-text.ts",
  "src/lib/pii.ts",
  "src/lib/retention.ts",
  "src/lib/turnstile-keys.ts",
  "src/lib/public-share-mappers.ts",
  "src/lib/validation/public-forms.ts",
  "src/lib/validation/inbox.ts",
  "src/content/legal/privacy.ts",
  "src/content/legal/terms.ts",
  "src/content/legal/types.ts",
  // Phase 7
  "src/lib/uploads/policy.ts",
  "src/lib/image-src.ts",
  "src/lib/same-origin.ts",
  "src/lib/storage-mode.ts",
  "src/lib/validation/uploads.ts",
  "src/lib/validation/galleries.ts",
  "src/content/demo/media.ts",
  // Phase 8
  "src/lib/donations/amount.ts",
  "src/lib/donations/stripe-config.ts",
  "src/lib/donations/giving-state.ts",
  "src/lib/donations/period.ts",
  "src/lib/donations/csv.ts",
  "src/lib/donations/checkout-params.ts",
  "src/lib/donations/support-view.ts",
  "src/lib/validation/donations.ts",
  "src/lib/site-settings-mappers.ts",
  "src/lib/safe-next.ts",
  "src/lib/log.ts",
  // Phase 9
  "src/lib/og-image.ts",
  "src/lib/security/headers.ts",
  "src/lib/validation/zod-setup.ts",
  "scripts/generate-brand-assets.ts",
  "src/config/site.ts",
  "src/config/social.ts",
  "src/server/errors.ts",
  "prisma/seed-lib.ts",
  "scripts/local-db.ts",
  "scripts/assert-local-db.ts",
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      return name === "generated" ? [] : walk(full);
    }
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const importSpecifiers = (source: string) =>
  [
    ...source.matchAll(
      /(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']/g,
    ),
  ].map((m) => m[1] ?? m[2] ?? m[3]!);

/** Resolves a relative specifier to a project-relative path (for ../src/...). */
function normalize(file: string, spec: string): string {
  if (!spec.startsWith(".")) return spec;
  const rel = path
    .relative(ROOT, path.resolve(path.dirname(file), spec))
    .replaceAll("\\", "/");
  return rel.startsWith("src/") ? `@/${rel.slice(4)}` : rel;
}

describe("script imports", () => {
  const scriptFiles = [
    ...walk(path.join(ROOT, "scripts")),
    ...readdirSync(path.join(ROOT, "prisma"))
      .filter((f) => /^seed.*\.ts$/.test(f) && !f.endsWith(".test.ts"))
      .map((f) => path.join(ROOT, "prisma", f)),
  ].filter((f) => !f.endsWith(".test.ts"));

  it("finds the scripts", () => {
    const names = scriptFiles.map((f) => path.basename(f));
    expect(names).toEqual(
      expect.arrayContaining(["create-owner.ts", "e2e-prepare.ts", "seed.ts"]),
    );
  });

  it.each(scriptFiles.map((f) => [path.relative(ROOT, f), f]))(
    "%s imports no server-only app modules",
    (_rel, file) => {
      const specs = importSpecifiers(readFileSync(file, "utf8")).map((s) =>
        normalize(file, s),
      );
      for (const spec of specs) {
        for (const forbidden of FORBIDDEN_SPECIFIERS) {
          const hit = forbidden.endsWith("/")
            ? spec.startsWith(forbidden)
            : spec === forbidden;
          expect(hit, `${file} imports ${spec}`).toBe(false);
        }
        expect(spec, file).not.toBe("server-only");
      }
    },
  );

  it.each(PURE_MODULES)("%s has no server-only import", (rel) => {
    const source = readFileSync(path.join(ROOT, rel), "utf8");
    expect(source).not.toMatch(/import\s+["']server-only["']/);
    expect(importSpecifiers(source)).not.toContain("@/lib/db");
  });

  it("no file under src/ reads process.env.E2E", () => {
    const offenders = walk(path.join(ROOT, "src")).filter(
      (f) =>
        f !== path.join(ROOT, "src/test/script-imports.test.ts") &&
        /process\.env\.E2E\b|process\.env\[["']E2E["']\]/.test(
          readFileSync(f, "utf8"),
        ),
    );
    expect(offenders).toEqual([]);
  });
});
