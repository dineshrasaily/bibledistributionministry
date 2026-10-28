// @vitest-environment node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Phase 9: no browser-exposed secrets, every environment variable the code
 * reads is documented in .env.example (with no real values), and no tracked
 * file contains a real-looking key.
 */
const ROOT = process.cwd();

/** Tracked + untracked-but-not-ignored files (so new files count too). */
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  { cwd: ROOT, encoding: "utf8" },
)
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((f) => !f.startsWith(".agents/") && !f.startsWith(".vscode/"));

const isText = (f: string) =>
  !/\.(png|jpe?g|webp|gif|ico|mp3|m4a|woff2?)$/i.test(f) &&
  f !== "package-lock.json";
const read = (f: string) => readFileSync(path.join(ROOT, f), "utf8");

const codeFiles = files.filter(
  (f) =>
    /^(src|scripts|prisma)\/.*\.(ts|tsx|mjs|js)$/.test(f) &&
    !f.startsWith("src/generated/"),
);
const nonTestCode = codeFiles.filter((f) => !/\.test\.tsx?$/.test(f));
const envExample = read(".env.example");

describe("environment variables", () => {
  it("the only NEXT_PUBLIC_ variable is NEXT_PUBLIC_SITE_URL", () => {
    const names = new Set<string>();
    for (const f of [...codeFiles, "next.config.ts", ".env.example"]) {
      for (const m of read(f).matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) {
        names.add(m[0]);
      }
    }
    expect([...names]).toEqual(["NEXT_PUBLIC_SITE_URL"]);
  });

  it("every variable the code reads is documented in .env.example", () => {
    const used = new Set<string>();
    for (const f of [...nonTestCode, "next.config.ts"]) {
      for (const m of read(f).matchAll(
        /\b(?:process\.env|env)\.([A-Z][A-Z0-9_]+)\b/g,
      )) {
        used.add(m[1]!);
      }
    }
    used.delete("NODE_ENV");
    expect(used.size).toBeGreaterThan(10);
    const missing = [...used].filter(
      (name) => !new RegExp(`\\b${name}\\b`).test(envExample),
    );
    expect(missing).toEqual([]);
  });

  it(".env.example sets values only for the local site URL and local DB", () => {
    const assigned = envExample
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/))
      .filter((m): m is RegExpMatchArray => m !== null && m[2]!.trim() !== "");
    expect(Object.fromEntries(assigned.map((m) => [m[1], m[2]]))).toEqual({
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      DATABASE_URL:
        '"postgresql://postgres:postgres@127.0.0.1:54329/mission_dev"',
    });
  });
});

describe("secrets", () => {
  // Real keys are long; the tests' obvious fakes ("sk_live_abc",
  // "vercel_blob_rw_x") stay allowed.
  const PATTERNS = [
    /[sr]k_live_[A-Za-z0-9]{16,}/,
    /[sr]k_test_[A-Za-z0-9]{20,}/,
    /whsec_[A-Za-z0-9]{20,}/,
    /\bre_[A-Za-z0-9]{20,}/,
    /vercel_blob_rw_[A-Za-z0-9]{8,}/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  ];

  it("no tracked file contains a real-looking key", () => {
    const self = "src/test/env-and-secrets.test.ts";
    const hits = files
      .filter(isText)
      .filter((f) => f !== self)
      .flatMap((f) => {
        let text: string;
        try {
          text = read(f);
        } catch {
          return []; // deleted in the working tree
        }
        return PATTERNS.filter((p) => p.test(text)).map((p) => `${f}: ${p}`);
      });
    expect(hits).toEqual([]);
  });

  it(".env is not tracked", () => {
    expect(files).not.toContain(".env");
  });
});
