// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static guard: every server action is authorized server-side, either through
 * runAdminAction() or (allow-listed) by calling requireAdmin() itself.
 */
const ROOT = process.cwd();
const ACTIONS_DIR = path.join(ROOT, "src/server/actions");
const SERVICES_DIR = path.join(ROOT, "src/server/services");
const WRAPPER = "run-admin-action.ts";

const LOGIN_ACTIONS = new Set([
  "startLoginAction",
  "completeLoginAction",
  "cancelLoginAction",
]);
const SELF_GUARDED = new Set([
  "logoutAction",
  "previewMarkdownAction",
  "changePasswordAction",
]);
/** Public form actions: no session, but always the spam-protected pipeline. */
const PUBLIC_ACTIONS = new Set(["submitPrayerAction", "submitContactAction"]);
const PUBLIC_PIPELINE = path.join(
  ROOT,
  "src/server/forms/public-submission.ts",
);

const read = (file: string) => readFileSync(file, "utf8");
const sourceFiles = (dir: string) =>
  readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

/** Exported async functions with their body text (until the next export). */
function exportedFunctions(source: string): { name: string; body: string }[] {
  const re = /^export async function (\w+)\s*\(/gm;
  const starts = [...source.matchAll(re)];
  return starts.map((m, i) => ({
    name: m[1]!,
    body: source.slice(m.index, starts[i + 1]?.index ?? source.length),
  }));
}

const actionFiles = sourceFiles(ACTIONS_DIR).filter((f) => f !== WRAPPER);

describe("server action guard coverage", () => {
  it("finds the action files", () => {
    expect(actionFiles.length).toBeGreaterThanOrEqual(10);
  });

  it.each(actionFiles)('%s starts with "use server"', (file) => {
    const source = read(path.join(ACTIONS_DIR, file));
    const firstStatement = source
      .replace(/^(\s*(\/\/[^\n]*|\/\*[\s\S]*?\*\/))*\s*/, "")
      .split("\n")[0];
    expect(firstStatement).toBe('"use server";');
  });

  it.each(actionFiles)(
    "%s: every exported action goes through runAdminAction or is allow-listed",
    (file) => {
      const fns = exportedFunctions(read(path.join(ACTIONS_DIR, file)));
      expect(fns.length).toBeGreaterThan(0);
      for (const { name, body } of fns) {
        if (LOGIN_ACTIONS.has(name)) continue;
        if (SELF_GUARDED.has(name)) {
          expect(body, name).toContain("requireAdmin(");
          continue;
        }
        if (PUBLIC_ACTIONS.has(name)) {
          expect(file, name).toBe("public-forms.ts");
          expect(body, name).toContain("runPublicSubmission(");
          continue;
        }
        expect(body, name).toContain("runAdminAction(");
      }
    },
  );

  it("run-admin-action.ts is server-only and not a server action file", () => {
    const source = read(path.join(ACTIONS_DIR, WRAPPER));
    expect(source).toContain('import "server-only"');
    expect(source).not.toContain('"use server"');
  });

  it("public-submission.ts is server-only and not a server action file", () => {
    const source = read(PUBLIC_PIPELINE);
    expect(source).toContain('import "server-only"');
    expect(source).not.toContain('"use server"');
  });

  it("public-forms.ts exports only the two public actions", () => {
    const fns = exportedFunctions(
      read(path.join(ACTIONS_DIR, "public-forms.ts")),
    ).map((f) => f.name);
    expect(fns.sort()).toEqual([...PUBLIC_ACTIONS].sort());
  });

  it("services and the wrapper never redirect", () => {
    const files = [
      path.join(ACTIONS_DIR, WRAPPER),
      ...sourceFiles(SERVICES_DIR).map((f) => path.join(SERVICES_DIR, f)),
    ];
    for (const file of files) {
      const source = read(file);
      expect(source, file).not.toMatch(/\bredirect\(/);
      expect(source, file).not.toMatch(
        /import\s*\{[^}]*\bredirect\b[^}]*\}\s*from\s*["']next\/navigation["']/,
      );
    }
  });
});
