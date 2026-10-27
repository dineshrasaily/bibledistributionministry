import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3210;
const baseURL = `http://localhost:${PORT}`;
// Same value as urlFor("mission_test") in scripts/local-db.ts. e2e:prepare
// refuses to run unless DATABASE_URL is exactly this URL.
const MISSION_TEST_URL =
  "postgresql://postgres:postgres@127.0.0.1:54329/mission_test";

// Generated once per run in the main process, which spawns the web server.
const authSecret = randomBytes(32).toString("base64");
const totpKey = randomBytes(32).toString("base64");

/** The Phase 1-3 public specs (unchanged). */
const PUBLIC_SPECS = [
  "a11y.spec.ts",
  "language-switcher.spec.ts",
  "mobile-menu.spec.ts",
  "navigation.spec.ts",
  "routing.spec.ts",
  "screenshots.spec.ts",
  // Phase 3
  "public-pages.spec.ts",
  "devotionals.spec.ts",
  "missions.spec.ts",
  "media-center.spec.ts",
  "phase3-screenshots.spec.ts",
];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL,
    trace: "on-first-retry",
    // Avoid catching mid-animation states in axe scans and screenshots.
    reducedMotion: "reduce",
  },
  projects: [
    {
      name: "public",
      testMatch: PUBLIC_SPECS,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Full password + TOTP login for owner and editor -> storage states.
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "admin-readonly",
      testMatch: ["admin-access.spec.ts", "admin-a11y.spec.ts"],
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Changes data: runs after the public specs (which assert the seeded
      // "Demo Ministry" content), one file at a time.
      name: "admin-mutations",
      testMatch: [
        "admin-content.spec.ts",
        "admin-logout.spec.ts",
        "admin-screenshots.spec.ts",
        "admin-settings.spec.ts",
        // Phase 6 (they write inbox rows; admin-readonly asserts an empty inbox)
        "prayer-form.spec.ts",
        "contact-form.spec.ts",
        "admin-inbox.spec.ts",
        "phase6-screenshots.spec.ts",
      ],
      dependencies: ["public", "admin-readonly"],
      fullyParallel: false,
      workers: 1,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Every run starts from a freshly reset and seeded mission_test database.
    command: `npm run e2e:prepare && npm run build && npm run start -- -p ${PORT}`,
    url: `${baseURL}/en`,
    reuseExistingServer: false,
    timeout: 600_000,
    stdout: "pipe",
    env: {
      DATABASE_URL: MISSION_TEST_URL,
      DIRECT_URL: MISSION_TEST_URL,
      AUTH_SECRET: authSecret,
      TOTP_ENCRYPTION_KEY: totpKey,
      // Every E2E request comes from localhost: don't let the form limit
      // (default 5/hour) throttle the suite. DB tests prove the limit itself.
      FORM_RATE_LIMIT_PER_HOUR: "100",
      // Cloudflare's test keys + no email in E2E, whatever the shell has set.
      TURNSTILE_SITE_KEY: "",
      TURNSTILE_SECRET_KEY: "",
      RESEND_API_KEY: "",
    },
  },
});
