import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import Stripe from "stripe";

/**
 * Phase 8 E2E without real Stripe: a mock Stripe API on 127.0.0.1:3212 and
 * a second `next start` (same build, same mission_test DB) on :3211 with
 * TEST keys pointed at the mock (STRIPE_API_BASE_URL_FOR_TESTS, loopback +
 * test key only). Nothing leaves the machine. The main :3210 server keeps
 * running without keys ("not set up yet" state).
 */
export const STRIPE_APP_PORT = 3211;
export const STRIPE_MOCK_PORT = 3212;
export const STRIPE_APP_URL = `http://localhost:${STRIPE_APP_PORT}`;
export const E2E_WEBHOOK_SECRET = "whsec_e2e_dummy";

// Same value as playwright.config.ts (kept literal: helpers load as CJS).
const MISSION_TEST_URL =
  "postgresql://postgres:postgres@127.0.0.1:54329/mission_test";
const ROOT = process.cwd();
export const PID_FILE = path.join(ROOT, ".local", "e2e-stripe-server.pid");

export type RecordedRequest = {
  method: string;
  path: string;
  /** Stripe's bracketed form encoding, flattened: line_items[0][quantity]. */
  form: Record<string, string>;
};

export type StripeE2e = {
  baseUrl: string;
  requests: RecordedRequest[];
  stop(): Promise<void>;
};

function startMock(requests: RecordedRequest[]): Promise<Server> {
  let n = 0;
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const url = new URL(
        req.url ?? "/",
        `http://127.0.0.1:${STRIPE_MOCK_PORT}`,
      );
      const form = Object.fromEntries(
        new URLSearchParams(req.method === "GET" ? url.search : body),
      );
      requests.push({ method: req.method ?? "", path: url.pathname, form });
      const send = (status: number, json: unknown) => {
        res.writeHead(status, {
          "Content-Type": "application/json",
          "Request-Id": `req_e2e_${requests.length}`,
        });
        res.end(JSON.stringify(json));
      };
      if (req.method === "POST" && url.pathname === "/v1/checkout/sessions") {
        n += 1;
        const locale = form.locale === "en" ? "en" : "ne";
        const id = `cs_test_e2e_${n}`;
        return send(200, {
          id,
          object: "checkout.session",
          url: `${STRIPE_APP_URL}/${locale}/support/thank-you?session_id=${id}`,
        });
      }
      if (req.method === "GET" && url.pathname === "/v1/invoice_payments") {
        return send(200, {
          object: "list",
          url: "/v1/invoice_payments",
          has_more: false,
          data: [
            {
              id: "inpay_test_e2e_1",
              object: "invoice_payment",
              invoice: url.searchParams.get("invoice"),
              payment: {
                type: "payment_intent",
                payment_intent: "pi_test_e2e_invoice",
              },
            },
          ],
        });
      }
      return send(404, {
        error: { type: "invalid_request_error", message: "Not mocked" },
      });
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(STRIPE_MOCK_PORT, "127.0.0.1", () => resolve(server));
  });
}

async function waitForApp(child: ChildProcess, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`stripe e2e server exited (${child.exitCode})`);
    }
    try {
      const res = await fetch(`${STRIPE_APP_URL}/en`);
      if (res.status === 200) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("stripe e2e server did not start in time");
}

function killTree(child: ChildProcess) {
  if (child.exitCode !== null || !child.pid) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
  } else {
    child.kill("SIGTERM");
  }
}

export async function startStripeE2e(): Promise<StripeE2e> {
  const requests: RecordedRequest[] = [];
  const mock = await startMock(requests);
  const nextBin = createRequire(path.join(ROOT, "package.json")).resolve(
    "next/dist/bin/next",
  );
  const secret = () => randomBytes(32).toString("base64");
  const child = spawn(
    process.execPath,
    [nextBin, "start", "-p", String(STRIPE_APP_PORT)],
    {
      cwd: ROOT,
      stdio: "ignore",
      windowsHide: true,
      env: {
        ...process.env,
        NODE_ENV: "production",
        DATABASE_URL: MISSION_TEST_URL,
        DIRECT_URL: MISSION_TEST_URL,
        AUTH_SECRET: secret(),
        TOTP_ENCRYPTION_KEY: secret(),
        STRIPE_SECRET_KEY: "sk_test_e2e_dummy",
        STRIPE_WEBHOOK_SECRET: E2E_WEBHOOK_SECRET,
        STRIPE_CUSTOMER_PORTAL_URL: "",
        STRIPE_API_BASE_URL_FOR_TESTS: `http://127.0.0.1:${STRIPE_MOCK_PORT}`,
        DONATION_RATE_LIMIT_PER_HOUR: "100",
        FORM_RATE_LIMIT_PER_HOUR: "100",
        TURNSTILE_SITE_KEY: "",
        TURNSTILE_SECRET_KEY: "",
        RESEND_API_KEY: "",
        BLOB_READ_WRITE_TOKEN: "",
        LOCAL_UPLOAD_DIR: ".local/uploads-e2e",
        VERCEL: "",
      },
    },
  );
  mkdirSync(path.dirname(PID_FILE), { recursive: true });
  writeFileSync(PID_FILE, String(child.pid ?? ""));
  try {
    await waitForApp(child);
  } catch (error) {
    killTree(child);
    mock.close();
    throw error;
  }
  return {
    baseUrl: STRIPE_APP_URL,
    requests,
    async stop() {
      killTree(child);
      await new Promise<void>((resolve) => mock.close(() => resolve()));
      // Wait until the port is free so the next spec can start again.
      for (let i = 0; i < 40; i += 1) {
        try {
          await fetch(`${STRIPE_APP_URL}/en`);
          await new Promise((r) => setTimeout(r, 250));
        } catch {
          break;
        }
      }
      rmSync(PID_FILE, { force: true });
    },
  };
}

type StripeFixture = {
  id: string;
  created: number;
  data: { object: Record<string, unknown> };
};

/** A unit-test fixture event (synthetic ids), re-dated to "now". */
export function e2eFixture(name: string): StripeFixture {
  const file = path.join(ROOT, "src/test/fixtures/stripe", `${name}.json`);
  const event = JSON.parse(readFileSync(file, "utf8")) as StripeFixture;
  const now = Math.floor(Date.now() / 1000);
  event.created = now;
  const transitions = event.data.object.status_transitions as
    Record<string, unknown> | undefined;
  if (transitions) transitions.paid_at = now;
  return event;
}

/** Signed webhook body + header, made with Stripe's own test helper. */
export function signedWebhook(event: unknown): {
  payload: string;
  header: string;
} {
  const payload = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: E2E_WEBHOOK_SECRET,
  });
  return { payload, header };
}

/** The webhook events the checkout spec and the screenshots post (in order). */
export function demoWebhookEvents(): StripeFixture[] {
  const payment = e2eFixture("checkout-session-completed-payment");
  // A formula-like (but valid) email proves the CSV-injection guard.
  (payment.data.object.customer_details as Record<string, unknown>).email =
    '=HYPERLINK("x")@example.org';
  return [
    payment,
    e2eFixture("checkout-session-completed-subscription"),
    e2eFixture("invoice-paid"),
    e2eFixture("charge-refunded-partial"),
  ];
}

/** Admin settings checkbox (on the main :3210 server, as the owner). */
export async function setSettingsCheckbox(
  page: Page,
  label: string,
  checked: boolean,
): Promise<void> {
  await page.goto("/admin/settings");
  const box = page.getByLabel(label, { exact: true });
  if ((await box.isChecked()) === checked) return;
  await box.setChecked(checked);
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByTestId("toasts")).toContainText("Settings saved.");
}

export const DONATIONS_ENABLED = "Donations are enabled";
export const TAX_VERIFIED = "Donation tax status has been verified";
