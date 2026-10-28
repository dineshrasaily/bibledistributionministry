// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static guard: every admin route handler authorizes through
 * requireAdminRoute(), and POST handlers pass mutation: true (same-origin).
 */
const ADMIN_API = path.join(process.cwd(), "src/app/api/admin");

function routes(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return routes(full);
    return name === "route.ts" ? [full] : [];
  });
}

const handlers = (source: string) => {
  const re = /^export (?:async )?function (\w+)\s*\(/gm;
  const starts = [...source.matchAll(re)];
  return starts.map((m, i) => ({
    name: m[1]!,
    body: source.slice(m.index, starts[i + 1]?.index ?? source.length),
  }));
};

describe("admin route handler guard coverage", () => {
  const files = routes(ADMIN_API);

  it("finds the upload, token and library routes", () => {
    const rel = files.map((f) =>
      path.relative(ADMIN_API, f).replaceAll("\\", "/"),
    );
    expect(rel.sort()).toEqual(
      [
        "media/library/route.ts",
        "uploads/blob/route.ts",
        "uploads/local/route.ts",
      ].sort(),
    );
  });

  it.each(files.map((f) => [path.relative(ADMIN_API, f), f]))(
    "%s: every handler calls requireAdminRoute",
    (_rel, file) => {
      const source = readFileSync(file, "utf8");
      const fns = handlers(source);
      expect(fns.length).toBeGreaterThan(0);
      // Only function exports for HTTP methods (no `export const { GET }`).
      expect(source).not.toMatch(/export const \{/);
      for (const { name, body } of fns) {
        expect(["GET", "POST"]).toContain(name);
        expect(body, name).toContain("requireAdminRoute(");
        if (name === "POST") expect(body, name).toMatch(/mutation: true/);
      }
    },
  );
});
