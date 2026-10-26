// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isAdminPath } from "./admin-path";

/** The proxy matcher literal, read from src/proxy.ts (Next requires it to stay inline there). */
function proxyMatcher(): RegExp {
  const source = readFileSync(path.resolve(__dirname, "../proxy.ts"), "utf8");
  const literal = /matcher:\s*("(?:[^"\\]|\\.)*")/.exec(source)?.[1];
  if (!literal) throw new Error("matcher literal not found in src/proxy.ts");
  return new RegExp(`^${JSON.parse(literal) as string}$`);
}

describe("isAdminPath", () => {
  it("matches /admin and its sub-paths only", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/")).toBe(true);
    expect(isAdminPath("/admin/posts")).toBe(true);
    expect(isAdminPath("/administration")).toBe(false);
    expect(isAdminPath("/admins")).toBe(false);
    expect(isAdminPath("/en/admin")).toBe(false);
  });
});

describe("proxy matcher", () => {
  const matcher = proxyMatcher();

  it.each(["/admin", "/admin/posts", "/api/auth/session", "/icon.svg"])(
    "does not run the proxy for %s",
    (p) => {
      expect(matcher.test(p)).toBe(false);
    },
  );

  it.each(["/", "/en", "/administration", "/ne/about"])(
    "runs the proxy for %s",
    (p) => {
      expect(matcher.test(p)).toBe(true);
    },
  );
});
