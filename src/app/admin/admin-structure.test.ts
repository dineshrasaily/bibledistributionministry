// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Section 12 rules: no loading.tsx under /admin (it would turn guard
 * redirects into client-side refreshes), and every dashboard page awaits its
 * guard before any Suspense boundary.
 */
const ADMIN = path.join(process.cwd(), "src/app/admin");
const DASHBOARD = path.join(ADMIN, "(dashboard)");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const rel = (file: string) => path.relative(ADMIN, file).replaceAll("\\", "/");
const dashboardPages = walk(DASHBOARD).filter(
  (f) => path.basename(f) === "page.tsx",
);
const read = (file: string) => readFileSync(file, "utf8");

describe("admin route structure", () => {
  it("has no loading.tsx anywhere under src/app/admin", () => {
    const loading = walk(ADMIN).filter((f) =>
      /^loading\.[jt]sx?$/.test(path.basename(f)),
    );
    expect(loading.map(rel)).toEqual([]);
  });

  it("finds the dashboard pages", () => {
    expect(dashboardPages.length).toBeGreaterThanOrEqual(20);
  });

  it.each(dashboardPages.map(rel))("%s calls a page guard", (file) => {
    const source = read(path.join(ADMIN, file));
    expect(source).toMatch(/require(Admin|Owner)Page\(/);
  });

  it.each(dashboardPages.map(rel))(
    "%s awaits the guard before the first <Suspense",
    (file) => {
      const source = read(path.join(ADMIN, file));
      const guard = source.search(/await require(Admin|Owner)Page\(/);
      expect(guard).toBeGreaterThan(-1);
      const suspense = source.indexOf("<Suspense");
      if (suspense !== -1) expect(guard).toBeLessThan(suspense);
    },
  );

  it.each(["settings", "users", "audit", "inbox/settings"])(
    "(dashboard)/%s/page.tsx is owner-only",
    (section) => {
      const source = read(path.join(DASHBOARD, section, "page.tsx"));
      expect(source).toContain("requireOwnerPage(");
    },
  );

  it("[...rest]/page.tsx only calls notFound() and reads no data", () => {
    const file = path.join(ADMIN, "[...rest]", "page.tsx");
    expect(existsSync(file)).toBe(true);
    const source = read(file);
    expect(source).toContain("notFound()");
    expect(source).not.toMatch(/@\/server|@\/lib\/db|prisma|await /);
  });

  it("the dashboard layout never redirects", () => {
    const source = read(path.join(DASHBOARD, "layout.tsx"));
    expect(source).not.toMatch(/redirect\(|require(Admin|Owner)Page\(/);
  });
});
