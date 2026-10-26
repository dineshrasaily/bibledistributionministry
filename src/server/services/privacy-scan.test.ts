// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * AC27: only src/server/services/inbox.ts (plus seed and test helpers) touches
 * the private inbox tables, and every function it exports calls requireAdmin().
 */
const ROOT = process.cwd();
const INBOX = path.join(ROOT, "src/server/services/inbox.ts");
const SELF = path.join(ROOT, "src/server/services/privacy-scan.test.ts");
const DELEGATE_RE = /\.(prayerRequest|contactMessage)\b/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      return name === "generated" || name === "node_modules" ? [] : walk(full);
    }
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const isAllowed = (file: string) => {
  const rel = path.relative(ROOT, file).replaceAll("\\", "/");
  return (
    file === INBOX ||
    file === SELF ||
    rel.startsWith("src/test/") ||
    /^prisma\/seed[^/]*\.ts$/.test(rel)
  );
};

describe("inbox privacy scan", () => {
  it("no module outside inbox.ts uses the prayerRequest/contactMessage delegates", () => {
    const files = [
      ...walk(path.join(ROOT, "src")),
      ...walk(path.join(ROOT, "prisma")),
      ...walk(path.join(ROOT, "scripts")),
    ];
    const offenders = files.filter(
      (f) => !isAllowed(f) && DELEGATE_RE.test(readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("every exported function in inbox.ts calls requireAdmin() first", () => {
    const source = readFileSync(INBOX, "utf8");
    const starts = [...source.matchAll(/^export async function (\w+)/gm)];
    expect(starts.length).toBeGreaterThanOrEqual(7);
    starts.forEach((m, i) => {
      const body = source.slice(m.index, starts[i + 1]?.index ?? source.length);
      const firstAwait = body.match(/await\s+([\w.]+)\(/)?.[1];
      expect(firstAwait, m[1]).toBe("requireAdmin");
    });
    // No non-async exports that could bypass the guard.
    expect(source).not.toMatch(/^export (const|function|let) /m);
  });
});
