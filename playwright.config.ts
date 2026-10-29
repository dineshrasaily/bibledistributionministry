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
  // Phase 8 (no Stripe keys on this server: "not set up yet")
  "support.spec.ts",
  // Phase 9 (read-only: headers/CSP, icons + OG image, full public sweep)
  "security-headers.spec.ts",
  "branding.spec.ts",
  "phase9-public-sweep.spec.ts",
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
      testMatch: [
        "admin-access.spec.ts",
        "admin-a11y.spec.ts",
        // Phase 7 (read-only: anonymous / cross-origin rejections)
        "upload-access.spec.ts",
        // Phase 8 (read-only: anonymous / editor rejections, empty owner view)
        "donation-access.spec.ts",
        // Phase 9 (read-only: pinned Log out; never clicks it)
        "admin-sidebar.spec.ts",
      ],
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Changes data: runs after the public specs (which assert the seeded
      // "Demo Ministry" content), one file at a time.
      name: "admin-mutations",
      testMatch: [
        "admin-content.spec.ts",
        // Phase 7 uploads (local driver), galleries and pickers
        "admin-uploads.spec.ts",
        "admin-logout.spec.ts",
        "admin-screenshots.spec.ts",
        "admin-settings.spec.ts",
        // Zelle + bank transfer (restores the settings in finally blocks)
        "offline-giving.spec.ts",
        // Phase 6 (they write inbox rows; admin-readonly asserts an empty inbox)
        "prayer-form.spec.ts",
        "contact-form.spec.ts",
        "admin-inbox.spec.ts",
        // Phase 9: logo from Settings (restored afterwards) + admin a11y sweep
        // (after the inbox specs so the inbox has rows to open)
        "admin-branding.spec.ts",
        "phase9-admin-sweep.spec.ts",
        "phase6-screenshots.spec.ts",
        "phase7-screenshots.spec.ts",
        // Phase 8: mock Stripe API + a second server with test keys (:3211)
        "donations-checkout.spec.ts",
        "phase8-screenshots.spec.ts",
        // Phase 9 screenshots (sets the logo, restores it afterwards)
        "phase9-screenshots.spec.ts",
        "zelle-bank-screenshots.spec.ts",
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
      // Phase 7: always the local upload driver in E2E (never real Vercel Blob).
      BLOB_READ_WRITE_TOKEN: "",
      LOCAL_UPLOAD_DIR: ".local/uploads-e2e",
      VERCEL: "",
      // Phase 8: the main server has NO Stripe keys ("not set up yet" state).
      // e2e/helpers/stripe-server.ts starts a second server with test keys
      // pointed at a local mock Stripe API.
      STRIPE_SECRET_KEY: "",
      STRIPE_WEBHOOK_SECRET: "",
      STRIPE_CUSTOMER_PORTAL_URL: "",
      STRIPE_API_BASE_URL_FOR_TESTS: "",
      DONATION_RATE_LIMIT_PER_HOUR: "100",
    },
  },
});
