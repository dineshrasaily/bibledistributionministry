import { expect, test, type BrowserContext, type Page } from "@playwright/test";
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

test.beforeAll(async ({ browser }) => {
  adminContext = await browser.newContext({ storageState: OWNER_STATE });
  admin = await adminContext.newPage();
});

test.afterAll(async () => {
  await adminContext?.close();
});

test.beforeEach(async ({ page }) => {
  await stubTurnstile(page);
});

const consentBox = (page: Page) =>
  page.getByRole("checkbox", { name: /share a shortened version/ });

async function sendContact(
  page: Page,
  {
    kind = "GENERAL",
    subject,
    message,
    consent = false,
  }: {
    kind?: "GENERAL" | "TESTIMONY" | "VOLUNTEER";
    subject: string;
    message: string;
    consent?: boolean;
  },
) {
  await page.goto("/en/contact");
  await page.getByLabel(/Your name/).fill("E2E Contact Person");
  await page.getByLabel(/Your email/).fill("contact.person@example.org");
  await page.getByLabel("What is this about?").selectOption(kind);
  await page.getByLabel(/Subject/).fill(subject);
  await page.getByLabel(/^Message/).fill(message);
  if (consent) await consentBox(page).check();
  await waitForTurnstile(page);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("heading", { name: "Thank you" })).toBeVisible();
}

async function openMessage(subject: string) {
  await admin.goto(`/admin/inbox/messages?q=${encodeURIComponent(subject)}`);
  const list = admin.getByRole("list", { name: "Messages" });
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await list.getByRole("link", { name: subject, exact: true }).click();
  await expect(
    admin.getByRole("heading", { level: 1, name: subject }),
  ).toBeVisible();
}

test("a general message reaches the inbox; it can't be published", async ({
  page,
}) => {
  const subject = uniqueMarker("E2E question");
  const message = `Private message ${uniqueMarker("m")}`;
  await page.goto("/en/contact");
  await expect(
    page.getByRole("heading", { level: 1, name: "Get in touch" }),
  ).toBeVisible();
  await expect(consentBox(page)).toHaveCount(0);
  await sendContact(page, { subject, message });

  await openMessage(subject);
  await expect(admin.getByTestId("inbox-body")).toHaveText(message);
  await expect(admin.getByText("General", { exact: true })).toBeVisible();
  await expect(admin.getByTestId("no-consent-note")).toContainText(
    "Only testimonies can be published",
  );
  await expect(
    admin.getByRole("button", { name: "Publish public version" }),
  ).toHaveCount(0);

  await page.goto("/en/prayer");
  await expect(page.locator("body")).not.toContainText(message);
});

test("the testimony consent box appears only for testimonies", async ({
  page,
}) => {
  await page.goto("/en/contact");
  const kind = page.getByLabel("What is this about?");
  await kind.selectOption("TESTIMONY");
  await expect(consentBox(page)).toBeVisible();
  await expect(consentBox(page)).not.toBeChecked();
  await consentBox(page).check();
  await kind.selectOption("VOLUNTEER");
  await expect(consentBox(page)).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "missions page" }),
  ).toHaveAttribute("href", "/en/missions");
  await kind.selectOption("TESTIMONY");
  await expect(consentBox(page)).not.toBeChecked();
});

test("a consented testimony is published as edited text and unpublished", async ({
  page,
}) => {
  const subject = uniqueMarker("E2E testimony");
  const message = `My private testimony ${uniqueMarker("t")}`;
  const publicText = `God provided in a hard season, story ${digitMarker()}`;
  await sendContact(page, {
    kind: "TESTIMONY",
    subject,
    message,
    consent: true,
  });

  await openMessage(subject);
  await expect(admin.getByText("Sharing consent: yes")).toBeVisible();
  await admin.getByLabel("Public text (English)").fill(publicText);
  await admin.getByLabel(/I removed names, contact details/).check();
  await admin.getByRole("button", { name: "Publish public version" }).click();
  await expect(admin.getByTestId("toasts")).toContainText(
    "Public version published.",
  );

  await page.goto("/en/prayer");
  const wall = page.getByTestId("prayer-wall");
  await expect(wall).toContainText(publicText);
  await expect(wall.getByText("Testimony", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(message);
  await expect(page.locator("body")).not.toContainText("E2E Contact Person");

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

test("a testimony without consent offers no publish form", async ({ page }) => {
  const subject = uniqueMarker("E2E private testimony");
  await sendContact(page, {
    kind: "TESTIMONY",
    subject,
    message: "Keep this private.",
  });
  await openMessage(subject);
  await expect(admin.getByText("Sharing consent: no")).toBeVisible();
  await expect(admin.getByTestId("no-consent-note")).toContainText(
    "did not agree to public sharing",
  );
  await expect(
    admin.getByRole("button", { name: "Publish public version" }),
  ).toHaveCount(0);
});

test("the Nepali contact form works", async ({ page }) => {
  const subject = uniqueMarker("नमस्ते");
  await page.goto("/ne/contact");
  await page.getByLabel(/तपाईंको नाम/).fill("राम");
  await page.getByLabel(/तपाईंको इमेल/).fill("ram@example.org");
  await page.getByLabel(/^विषय/).fill(subject);
  await page.getByLabel(/^सन्देश/).fill("नेपालीमा सन्देश");
  await waitForTurnstile(page);
  await page.getByRole("button", { name: "सन्देश पठाउनुहोस्" }).click();
  await expect(page.getByRole("heading", { name: "धन्यवाद" })).toBeVisible();

  await openMessage(subject);
  await expect(admin.getByTestId("inbox-body")).toHaveAttribute("lang", "ne");
});
