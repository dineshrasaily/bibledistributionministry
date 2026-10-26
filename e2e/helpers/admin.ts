import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { generate } from "otplib";

// Do not import scripts/local-db.ts here: Playwright loads helpers as CJS.

export type E2EUser = {
  email: string;
  password: string;
  totpSecret: string;
  name: string;
  role: "OWNER" | "EDITOR";
};
export type E2EUserKey = "owner" | "editor" | "editor2";

export const AUTH_DIR = path.join(process.cwd(), "playwright", ".auth");
export const OWNER_STATE = path.join(AUTH_DIR, "owner.json");
export const EDITOR_STATE = path.join(AUTH_DIR, "editor.json");
export const ADMIN_SCREENSHOTS = path.join(
  process.cwd(),
  ".agents",
  "screenshots",
  "admin",
);

/** Credentials written by `npm run e2e:prepare` (never committed). */
export function e2eUser(key: E2EUserKey): E2EUser {
  const file = path.join(AUTH_DIR, "e2e-users.json");
  const users = JSON.parse(readFileSync(file, "utf8")) as Record<
    E2EUserKey,
    E2EUser
  >;
  return users[key];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Milliseconds until the next 30 s TOTP window (+1 s margin). */
function untilNextWindow(): number {
  const ms = Date.now() % 30_000;
  return 30_000 - ms + 1_000;
}

/**
 * Full two-step login: password, then a TOTP code generated from the seeded
 * secret. Codes are single use (replay protection), so if a code is rejected
 * the helper waits for the next 30 s window and retries once.
 */
export async function loginAs(page: Page, user: E2EUser): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Enter your authenticator code" }),
  ).toBeVisible();

  for (let attempt = 0; attempt < 2; attempt++) {
    const code = await generate({ secret: user.totpSecret });
    await page.getByLabel("Authenticator code").fill(code);
    await page.getByRole("button", { name: "Verify" }).click();
    // Both branches swallow their own timeout so the loser never rejects later.
    const outcome = await Promise.race([
      page
        .waitForURL((url) => url.pathname === "/admin", { timeout: 15_000 })
        .then(
          () => "ok" as const,
          () => "timeout" as const,
        ),
      page
        .getByText("That code didn't work")
        .waitFor({ timeout: 15_000 })
        .then(
          () => "rejected" as const,
          () => "timeout" as const,
        ),
    ]);
    if (outcome === "ok") return;
    if (attempt === 0) await sleep(untilNextWindow());
  }
  throw new Error(`TOTP login failed twice for ${user.email}`);
}

/** Horizontal overflow check used by the screenshot specs. */
export async function scrollWidth(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth);
}
