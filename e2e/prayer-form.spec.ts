import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { OWNER_STATE } from "./helpers/admin";
import {
  digitMarker,
  stubTurnstile,
  uniqueMarker,
  waitForTurnstile,
} from "./helpers/turnstile";

test.describe.configure({ mode: "serial" });

let adminContext: BrowserContext;
let admin: Page;

async function openAdmin(browser: Browser) {
  adminContext = await browser.newContext({ storageState: OWNER_STATE });
  admin = await adminContext.newPage();
}

test.beforeAll(async ({ browser }) => {
  await openAdmin(browser);
});

test.afterAll(async () => {
  await adminContext?.close();
});

test.beforeEach(async ({ page }) => {
  await stubTurnstile(page);
});

async function fillPrayer(
  page: Page,
  { name, email, body }: { name?: string; email?: string; body: string },
) {
  if (name) await page.getByLabel("Your name").fill(name);
  if (email) await page.getByLabel("Your email").fill(email);
  await page.getByLabel(/Your prayer request/).fill(body);
}

async function submit(page: Page, label = "Send prayer request") {
  await waitForTurnstile(page);
  await page.getByRole("button", { name: label }).click();
}

/** Opens the admin detail page of the (only) request matching `q`. */
async function openRequest(q: string) {
  await admin.goto(`/admin/inbox/prayer?q=${encodeURIComponent(q)}`);
  const list = admin.getByRole("list", { name: "Prayer requests" });
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await list.getByRole("listitem").first().getByRole("link").first().click();
  await expect(admin).toHaveURL(/\/admin\/inbox\/prayer\/[a-z0-9]+$/);
}

async function expectNotPublic(page: Page, ...texts: string[]) {
  for (const locale of ["en", "ne"]) {
    await page.goto(`/${locale}/prayer`);
    for (const text of texts) {
      await expect(page.locator("body")).not.toContainText(text);
    }
  }
}

test("a normal request reaches the admin inbox and is not public", async ({
  page,
}) => {
  const name = uniqueMarker("E2E Person");
  const body = `Private prayer ${uniqueMarker("body")}`;
  await page.goto("/en/prayer");
  await expect(
    page.getByRole("heading", { level: 1, name: "Share a prayer request" }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /share a shortened version/ }),
  ).not.toBeChecked();
  await fillPrayer(page, { name, email: "e2e.person@example.org", body });
  await submit(page);
  const heading = page.getByRole("heading", { name: "Thank you" });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();

  await admin.goto(`/admin/inbox/prayer?q=${encodeURIComponent(name)}`);
  const row = admin
    .getByRole("list", { name: "Prayer requests" })
    .getByRole("listitem");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(name);
  await expect(row).toContainText("Sharing consent: no");
  await openRequest(name);
  await expect(admin.getByTestId("inbox-body")).toHaveText(body);
  await expect(admin.getByText("e2e.person@example.org")).toBeVisible();
  await expect(admin.getByTestId("no-consent-note")).toContainText(
    "did not agree to public sharing",
  );
  await expect(
    admin.getByRole("button", { name: "Publish public version" }),
  ).toHaveCount(0);

  await expectNotPublic(page, body, name);
});

test("an anonymous request stores no name or email", async ({ page }) => {
  const typedName = uniqueMarker("Typed Name");
  const body = `Anonymous prayer ${uniqueMarker("anon")}`;
  await page.goto("/en/prayer");
  await page.getByLabel("Your name").fill(typedName);
  await page.getByLabel("Your email").fill("typed@example.org");
  await page.getByRole("checkbox", { name: "Send anonymously" }).check();
  await expect(page.getByLabel("Your name")).toBeDisabled();
  await expect(page.getByLabel("Your email")).toBeDisabled();
  await expect(page.getByLabel("Your name")).toHaveValue("");
  await expect(page.getByLabel("Your email")).toHaveValue("");
  await page.getByLabel(/Your prayer request/).fill(body);
  await submit(page);
  await expect(page.getByRole("heading", { name: "Thank you" })).toBeVisible();

  await openRequest(body);
  await expect(
    admin.getByRole("heading", {
      level: 1,
      name: "Prayer request from Anonymous",
    }),
  ).toBeVisible();
  await expect(admin.getByText("Hidden (anonymous)")).toBeVisible();
  await expect(admin.locator("main")).not.toContainText(typedName);
  await expect(admin.locator("main")).not.toContainText("typed@example.org");

  await expectNotPublic(page, body);
});

test("a consented request is published only as admin-edited text", async ({
  page,
}) => {
  const name = uniqueMarker("Consent Person");
  const body = `Consented prayer, call me at person-x@example.org ${uniqueMarker("c")}`;
  const publicText = `Please pray for healing, request ${digitMarker()}`;
  await page.goto("/en/prayer");
  await fillPrayer(page, { name, body });
  await page
    .getByRole("checkbox", { name: /share a shortened version/ })
    .check();
  await submit(page);
  await expect(page.getByRole("heading", { name: "Thank you" })).toBeVisible();

  await openRequest(name);
  await expect(admin.getByText("Sharing consent: yes")).toBeVisible();
  // The prefilled original still contains the email: refused.
  await expect(admin.getByLabel("Public text (English)")).toHaveValue(body);
  await admin.getByLabel(/I removed names, contact details/).check();
  await admin.getByRole("button", { name: "Publish public version" }).click();
  await expect(admin.locator("#f-textEn-error")).toContainText(
    "an email address",
  );
  await expect(admin.getByTestId("form-error-summary")).toBeFocused();

  await admin.getByLabel("Public text (English)").fill(publicText);
  await admin.getByRole("button", { name: "Publish public version" }).click();
  await expect(admin.getByTestId("toasts")).toContainText(
    "Public version published.",
  );
  await expect(admin.getByText(/^Published /)).toBeVisible();

  await page.goto("/en/prayer");
  const wall = page.getByTestId("prayer-wall");
  await expect(wall).toContainText(publicText);
  await expect(wall).toContainText("Prayer");
  await expect(page.locator("body")).not.toContainText(body);
  await expect(page.locator("body")).not.toContainText(name);
  // The Nepali page falls back to the English text, marked lang="en".
  await page.goto("/ne/prayer");
  await expect(
    page.getByTestId("prayer-wall").getByText(publicText),
  ).toHaveAttribute("lang", "en");

  // The admin detail page with the publish form passes axe.
  const results = await new AxeBuilder({ page: admin })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  console.log(
    `[axe] ${admin.url()} violations=${results.violations.length} serious/critical=${serious.length}`,
  );
  expect(serious.map((v) => v.id)).toEqual([]);

  await admin
    .getByRole("button", { name: /Unpublish the public version/ })
    .click();
  await expect(admin.getByTestId("toasts")).toContainText(
    "Public version removed.",
  );
  for (const locale of ["en", "ne"]) {
    await page.goto(`/${locale}/prayer`);
    await expect(page.locator("body")).not.toContainText(publicText);
  }
});

test("a Nepali request is stored with lang=ne", async ({ page }) => {
  const body = `कृपया मेरो परिवारका लागि प्रार्थना गर्नुहोस् ${uniqueMarker("ne")}`;
  await page.goto("/ne/prayer");
  await page.getByLabel(/तपाईंको प्रार्थना अनुरोध/).fill(body);
  await submit(page, "प्रार्थना अनुरोध पठाउनुहोस्");
  await expect(page.getByRole("heading", { name: "धन्यवाद" })).toBeVisible();
  await expect(
    page.getByText("तपाईंको अनुरोध प्राप्त भयो र गोप्य राखिएको छ।"),
  ).toBeVisible();

  await openRequest(body);
  await expect(admin.getByTestId("inbox-body")).toHaveAttribute("lang", "ne");
  await expect(admin.getByTestId("inbox-body")).toHaveText(body);
});

test("validation errors are announced, linked and keep the typed values", async ({
  page,
}) => {
  await page.goto("/en/prayer");
  await page.getByLabel("Your name").fill("Kept Name");
  await page.getByLabel("Your email").fill("kept@example.org");
  await submit(page);
  const error = page.locator("#prayer-body-error");
  await expect(error).toHaveText("Please fill in this field.");
  const textarea = page.getByLabel(/Your prayer request/);
  await expect(textarea).toHaveAttribute("aria-invalid", "true");
  await expect(textarea).toHaveAttribute(
    "aria-describedby",
    /prayer-body-error/,
  );
  await expect(textarea).toBeFocused();
  await expect(page.getByTestId("form-alert")).toContainText(
    "Please fix the highlighted fields.",
  );
  await expect(page.getByLabel("Your name")).toHaveValue("Kept Name");
  await expect(page.getByLabel("Your email")).toHaveValue("kept@example.org");

  // Fixing the field and resending works (a fresh token is issued).
  const body = `After error ${uniqueMarker("fix")}`;
  await textarea.fill(body);
  await submit(page);
  await expect(page.getByRole("heading", { name: "Thank you" })).toBeVisible();
  await openRequest(body);
});

test("the honeypot fakes success and stores nothing", async ({ page }) => {
  const body = `Bot text ${uniqueMarker("bot")}`;
  await page.goto("/en/prayer");
  await page.getByLabel(/Your prayer request/).fill(body);
  await page.locator('[name="website"]').fill("https://spam.example", {
    force: true,
  });
  await submit(page);
  await expect(page.getByRole("heading", { name: "Thank you" })).toBeVisible();

  await admin.goto(`/admin/inbox/prayer?q=${encodeURIComponent(body)}`);
  await expect(admin.getByText("No matching prayer requests")).toBeVisible();
});

test("without a Turnstile token nothing is sent", async ({ page }) => {
  await page.unrouteAll();
  await stubTurnstile(page, { pass: false });
  const body = `No token ${uniqueMarker("nt")}`;
  await page.goto("/en/prayer");
  await page.getByLabel(/Your prayer request/).fill(body);
  await page.getByRole("button", { name: "Send prayer request" }).click();
  await expect(page.locator("#prayer-turnstile-error")).toHaveText(
    "Please wait for the spam check to finish, then send again.",
  );
  await expect(page.getByTestId("form-alert")).toBeFocused();

  await admin.goto(`/admin/inbox/prayer?q=${encodeURIComponent(body)}`);
  await expect(admin.getByText("No matching prayer requests")).toBeVisible();
});
