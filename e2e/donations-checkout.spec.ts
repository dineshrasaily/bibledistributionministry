import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import ne from "../messages/ne.json";
import { OWNER_STATE } from "./helpers/admin";
import {
  demoWebhookEvents,
  DONATIONS_ENABLED,
  setSettingsCheckbox,
  signedWebhook,
  startStripeE2e,
  TAX_VERIFIED,
  type StripeE2e,
} from "./helpers/stripe-server";

/**
 * Checkout + webhooks against the local mock Stripe API (no network).
 * :3210 = main server (no keys, admin), :3211 = same build with test keys.
 */
test.use({ storageState: OWNER_STATE });
test.describe.configure({ mode: "serial" });

const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
let stripe: StripeE2e;

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(tags).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  console.log(
    `[axe] ${page.url()} violations=${results.violations.length} serious/critical=${serious.length} passes=${results.passes.length}`,
  );
  return serious.map((v) => ({
    id: v.id,
    targets: v.nodes.map((n) => n.target.join(" ")),
  }));
}

const sessions = () =>
  stripe.requests.filter(
    (r) => r.method === "POST" && r.path === "/v1/checkout/sessions",
  );

const choose = (page: Page, id: string) =>
  page.locator(`label[for="${id}"]`).click();

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  stripe = await startStripeE2e();
  const page = await browser.newPage({ storageState: OWNER_STATE });
  await setSettingsCheckbox(page, DONATIONS_ENABLED, true);
  await page.close();
});

test.afterAll(async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await browser.newPage({ storageState: OWNER_STATE });
  await setSettingsCheckbox(page, TAX_VERIFIED, false);
  await setSettingsCheckbox(page, DONATIONS_ENABLED, false);
  await page.close();
  await stripe?.stop();
});

test("with keys + donations enabled the Support page shows the form (axe clean)", async ({
  page,
}) => {
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${stripe.baseUrl}/en/support`);
    await expect(page.getByTestId("support-open")).toBeVisible();
    await expect(page.getByRole("form", { name: "Give online" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "$50" })).toHaveCount(1);
    await page.evaluate(() => document.fonts.ready);
    expect(await seriousViolations(page)).toEqual([]);
  }
  // The keyless main server still says "not set up yet".
  await page.goto("/en/support");
  await expect(page.getByTestId("support-not-configured")).toBeVisible();
});

test("amounts are validated on the server; Stripe is not called", async ({
  page,
}) => {
  await page.goto(`${stripe.baseUrl}/en/support`);
  await choose(page, "donation-amount-custom");
  const input = page.locator("#donation-customAmount");
  await expect(input).toBeFocused();
  await input.fill("4");
  await page
    .getByRole("button", { name: "Continue to secure payment" })
    .click();
  await expect(page.getByText("The smallest gift online is $5.")).toBeVisible();
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("aria-invalid", "true");

  await input.fill("10001");
  await page
    .getByRole("button", { name: "Continue to secure payment" })
    .click();
  await expect(
    page.getByText(/The largest gift online is \$10,000\./),
  ).toBeVisible();

  await input.fill("abc");
  await page
    .getByRole("button", { name: "Continue to secure payment" })
    .click();
  await expect(page.getByText(/Enter an amount in US dollars/)).toBeVisible();

  // No amount chosen at all.
  await page.goto(`${stripe.baseUrl}/en/support`);
  await page
    .getByRole("button", { name: "Continue to secure payment" })
    .click();
  await expect(page.getByText("Please choose an amount.")).toBeVisible();
  expect(sessions()).toHaveLength(0);
});

test("a one-time $50 gift creates a payment-mode Checkout Session and redirects", async ({
  page,
}) => {
  await page.goto(`${stripe.baseUrl}/en/support`);
  await choose(page, "donation-amount-50");
  await page
    .getByRole("button", { name: "Continue to secure payment" })
    .click();
  await page.waitForURL(/\/en\/support\/thank-you\?session_id=cs_test_e2e_1$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Thank you for your gift",
  );
  const [session] = sessions();
  expect(session!.form).toMatchObject({
    mode: "payment",
    submit_type: "donate",
    "allowed_payment_method_types[0]": "card",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": "5000",
    "line_items[0][price_data][product_data][name]": "Gift to Demo Ministry",
    "metadata[app]": "mission-site",
    "metadata[interval]": "ONE_TIME",
    "payment_intent_data[metadata][app]": "mission-site",
  });
  expect(session!.form.success_url).toMatch(
    /\/en\/support\/thank-you\?session_id=\{CHECKOUT_SESSION_ID\}$/,
  );
  expect(session!.form.cancel_url).toMatch(/\/en\/support\/cancelled$/);
  // No donor data is sent by us.
  expect(JSON.stringify(session!.form)).not.toMatch(/email|customer/);
});

test("a monthly custom $12.34 gift (Nepali) creates a subscription session", async ({
  page,
}) => {
  await page.goto(`${stripe.baseUrl}/ne/support`);
  await choose(page, "donation-interval-MONTHLY");
  await choose(page, "donation-amount-custom");
  await page.locator("#donation-customAmount").fill("12.34");
  await page
    .getByRole("button", { name: ne.DonationForm.submitMonthly })
    .click();
  await page.waitForURL(/\/ne\/support\/thank-you\?session_id=cs_test_e2e_2$/);
  const session = sessions()[1]!;
  expect(session.form).toMatchObject({
    mode: "subscription",
    "line_items[0][price_data][unit_amount]": "1234",
    "line_items[0][price_data][recurring][interval]": "month",
    "subscription_data[metadata][app]": "mission-site",
    "metadata[interval]": "MONTHLY",
  });
  expect(session.form).not.toHaveProperty("submit_type");
  expect(session.form.success_url).toMatch(/\/ne\/support\/thank-you\?/);
  expect(session.form.cancel_url).toMatch(/\/ne\/support\/cancelled$/);
});

test("tax wording follows the owner's 'verified' setting", async ({ page }) => {
  await page.goto(`${stripe.baseUrl}/en/support`);
  const note = page.getByTestId("support-tax-note");
  await expect(note).toHaveText("Gifts are not tax-deductible.");
  await setSettingsCheckbox(page, TAX_VERIFIED, true);
  await page.goto(`${stripe.baseUrl}/en/support`);
  await expect(note).toContainText(
    "may be tax-deductible; consult your tax advisor",
  );
  await expect(note).toContainText("receipt");
  await expect(note).not.toContainText("not tax-deductible");
  await page.goto(`${stripe.baseUrl}/en/support/thank-you`);
  await expect(page.getByTestId("support-tax-note")).toContainText(
    "may be tax-deductible",
  );
  await setSettingsCheckbox(page, TAX_VERIFIED, false);
  await page.goto(`${stripe.baseUrl}/en/support`);
  await expect(note).toHaveText("Gifts are not tax-deductible.");
});

test("signed webhooks are recorded once; the owner sees them and exports a safe CSV", async ({
  page,
  request,
}) => {
  const url = `${stripe.baseUrl}/api/stripe/webhook`;
  const post = (event: unknown) => {
    const { payload, header } = signedWebhook(event);
    return request.post(url, {
      headers: {
        "content-type": "application/json",
        "stripe-signature": header,
      },
      data: payload,
    });
  };
  const [payment, subscription, invoice, refund] = demoWebhookEvents();

  const first = await post(payment);
  expect(first.status()).toBe(200);
  expect(await first.json()).toEqual({ received: true, outcome: "processed" });
  const again = await post(payment);
  expect(again.status()).toBe(200);
  expect(await again.json()).toEqual({ received: true, duplicate: true });
  for (const event of [subscription, invoice, refund]) {
    const res = await post(event);
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ received: true, outcome: "processed" });
  }
  // invoice.paid asked the mock for the invoice's payment intent.
  expect(
    stripe.requests.some(
      (r) => r.method === "GET" && r.path === "/v1/invoice_payments",
    ),
  ).toBe(true);

  // Bad signature.
  const bad = await request.post(url, {
    headers: {
      "content-type": "application/json",
      "stripe-signature": "t=1,v1=00",
    },
    data: JSON.stringify(payment),
  });
  expect(bad.status()).toBe(400);

  // The owner's view on the main server.
  await page.goto("/admin/donations?period=all");
  const list = page.getByRole("list", { name: "Donations" });
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(list).toContainText("$50.00");
  await expect(list).toContainText("$12.34");
  await expect(list.getByText("Test", { exact: true })).toHaveCount(2);
  await expect(list).toContainText("Partially refunded");
  const totals = page.getByTestId("donation-totals");
  await expect(totals).toContainText("$62.34"); // gross
  await expect(totals).toContainText("$15.00"); // refunded
  await expect(totals).toContainText("$47.34"); // net
  await expect(page.getByText(/^Not set: the Support page says/)).toBeVisible();
  // A webhook was received.
  await expect(page.getByText("Never", { exact: true })).toHaveCount(0);

  await page.goto("/admin/donations?period=all&interval=MONTHLY");
  await expect(
    page.getByRole("list", { name: "Donations" }).getByRole("listitem"),
  ).toHaveCount(1);

  await page.goto("/admin/donations?period=all");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Export CSV" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /^donations-all-\d{4}-\d{2}-\d{2}\.csv$/,
  );
  const csv = readFileSync((await download.path())!, "utf8");
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split("\r\n")
    .filter(Boolean);
  expect(lines).toHaveLength(3);
  expect(csv.toLowerCase()).toContain(`"'=hyperlink(""x"")@example.org"`);
  expect(csv).not.toMatch(/,"=/);
});
