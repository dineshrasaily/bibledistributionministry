import { expect, test, type Page } from "@playwright/test";
import en from "../messages/en.json";
import ne from "../messages/ne.json";
import { EDITOR_STATE, OWNER_STATE } from "./helpers/admin";
import { seriousViolations } from "./helpers/axe";
import {
  E2E_OFFLINE,
  OFFLINE_LABELS,
  fillOfflineFields,
  fillOfflineGiving,
  resetOfflineGiving,
} from "./helpers/offline-giving";

// Zelle + bank transfer on the Support page, edited in Admin -> Settings.
// The main E2E server has no Stripe keys, so online giving is "not set up".
test.use({ storageState: OWNER_STATE });
test.describe.configure({ mode: "serial", timeout: 120_000 });

const ROUTING_MSG =
  "Enter a valid 9-digit US routing number (ABA). Check it for typos.";
const UNVERIFIED_TAX_NOTE: Record<"en" | "ne", string> = {
  en: "Gifts are not tax-deductible.",
  ne: "दानहरू करमा छुट पाउने (tax-deductible) होइनन्।",
};

const LOCALES = [
  { locale: "en", m: en.SupportPage },
  { locale: "ne", m: ne.SupportPage },
] as const;

const copyName = (m: (typeof LOCALES)[number]["m"], field: string) =>
  m.copyLabel.replace("{field}", field);

async function y(page: Page, testId: string): Promise<number> {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) throw new Error(`${testId} has no box`);
  return box.y;
}

test("owner fills Zelle + bank: Support (en + ne) shows the cards, numbers hidden", async ({
  page,
  context,
}) => {
  try {
    await fillOfflineGiving(page, E2E_OFFLINE);
    for (const { locale, m } of LOCALES) {
      await page.goto(`/${locale}/support`);
      const section = page.getByTestId("support-offline");
      await expect(
        section.getByRole("heading", { level: 2, name: m.offlineTitle }),
      ).toBeVisible();
      // Stripe isn't open: Zelle/bank first, then the softened card.
      await expect(page.getByTestId("support-other-ways")).toBeVisible();
      await expect(page.getByTestId("support-not-configured")).toHaveCount(0);
      expect(await y(page, "support-offline")).toBeLessThan(
        await y(page, "support-other-ways"),
      );

      const zelle = page.getByTestId("support-zelle");
      await expect(zelle).toContainText("E2E Ministry Zelle");
      await expect(zelle).toContainText("give@example.org");
      await expect(zelle).toContainText("(555) 010-0199");
      await expect(
        zelle.getByRole("button", {
          name: copyName(m, m.zelleEmailLabel),
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        zelle.getByRole("button", {
          name: copyName(m, m.zellePhoneLabel),
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        zelle.getByRole("img", { name: "E2E Zelle QR" }),
      ).toBeVisible();
      await expect(zelle.locator("ol")).toContainText("E2E Ministry Zelle");

      await expect(page.getByTestId("support-offline-tax-note")).toHaveText(
        UNVERIFIED_TAX_NOTE[locale],
      );
      const note = page.getByTestId("support-offline-note");
      if (locale === "ne") {
        await expect(note.locator('[lang="en"]')).toContainText(
          "Please write 'Bibles' in the memo",
        );
      } else {
        await expect(note).toContainText("Please write 'Bibles' in the memo");
      }

      // Bank: name + holder shown, numbers never in the HTML.
      const bank = page.getByTestId("support-bank");
      await expect(bank).toContainText("E2E Community Bank");
      await expect(bank).toContainText("E2E Ministry");
      const html = await page.content();
      expect(html).not.toContain("000123456789");
      expect(html).not.toContain("021000021");
      expect(html).not.toContain("CHASUS33");
      const contact = page.getByTestId("bank-contact-for-details");
      await expect(contact).toBeVisible();
      await expect(contact.getByRole("link")).toHaveAttribute(
        "href",
        `/${locale}/contact`,
      );
    }

    // Copy the Zelle email (en).
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/en/support");
    await page
      .getByRole("button", { name: "Copy Zelle email", exact: true })
      .click();
    await expect(
      page.getByTestId("support-zelle").getByRole("status").first(),
    ).toHaveText("Copied");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "give@example.org",
    );
  } finally {
    await resetOfflineGiving(page);
  }
});

test("account details show only after the owner turns them on; axe clean", async ({
  page,
}) => {
  try {
    await fillOfflineGiving(page, { ...E2E_OFFLINE, showDetails: true });
    for (const { locale, m } of LOCALES) {
      await page.goto(`/${locale}/support`);
      const bank = page.getByTestId("support-bank");
      for (const [value, label] of [
        ["000123456789", m.bankAccountNumberLabel],
        ["021000021", m.bankRoutingLabel],
        ["CHASUS33", m.bankSwiftLabel],
      ] as const) {
        await expect(bank).toContainText(value);
        await expect(
          bank.getByRole("button", { name: copyName(m, label), exact: true }),
        ).toBeVisible();
      }
      await expect(page.getByTestId("bank-contact-for-details")).toHaveCount(0);
      expect(
        await seriousViolations(page, `support ${locale} offline`),
      ).toEqual([]);
    }
    await page.goto("/admin/settings");
    await expect(
      page.getByRole("heading", { name: "Zelle and bank transfer" }),
    ).toBeVisible();
    expect(await seriousViolations(page, "admin settings")).toEqual([]);
  } finally {
    await resetOfflineGiving(page);
  }
});

test("turning the section off hides it and restores today's card", async ({
  page,
}) => {
  try {
    await fillOfflineGiving(page, E2E_OFFLINE);
    await page.goto("/en/support");
    await expect(page.getByTestId("support-offline")).toBeVisible();

    await fillOfflineGiving(page, { enabled: false });
    await page.goto("/en/support");
    await expect(page.getByTestId("support-offline")).toHaveCount(0);
    await expect(page.getByTestId("support-other-ways")).toHaveCount(0);
    await expect(page.getByTestId("support-not-configured")).toBeVisible();
    // The details stay saved while the section is off.
    await page.goto("/admin/settings");
    await expect(
      page.getByLabel(OFFLINE_LABELS.email, { exact: true }),
    ).toHaveValue("give@example.org");
  } finally {
    await resetOfflineGiving(page);
  }
});

test("an invalid routing number is a field error and saves nothing", async ({
  page,
}) => {
  try {
    await page.goto("/admin/settings");
    await fillOfflineFields(page, {
      enabled: true,
      bankName: "E2E Community Bank",
      routing: "123456789",
    });
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByTestId("form-error-summary")).toBeVisible();
    const routing = page.getByLabel(OFFLINE_LABELS.routing, { exact: true });
    await expect(routing).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText(ROUTING_MSG).first()).toBeVisible();
    // Error text is linked to the input.
    const describedBy = (await routing.getAttribute("aria-describedby")) ?? "";
    expect(describedBy).toContain("f-bankRoutingNumber-error");

    await page.goto("/en/support");
    await expect(page.getByTestId("support-offline")).toHaveCount(0);
    await expect(page.getByTestId("support-not-configured")).toBeVisible();
  } finally {
    await resetOfflineGiving(page);
  }
});

test("EDITORs can't open Settings or save Zelle/bank details (server-side)", async ({
  page,
  browser,
  playwright,
  baseURL,
}) => {
  // (a) The page itself.
  const editorContext = await browser.newContext({
    storageState: EDITOR_STATE,
  });
  const editorPage = await editorContext.newPage();
  await editorPage.goto("/admin/settings");
  await expect(editorPage).toHaveURL(/\/admin\/forbidden/);
  await editorContext.close();

  // (b) The server action: capture the owner's real request (aborted, so
  // nothing is saved), then replay it byte for byte with the EDITOR session.
  try {
    await page.goto("/admin/settings");
    await fillOfflineFields(page, E2E_OFFLINE);
    let captured: { headers: Record<string, string>; body: Buffer } | null =
      null;
    await page.route("**/admin/settings", async (route) => {
      const req = route.request();
      if (req.method() !== "POST") return route.continue();
      captured = {
        headers: await req.allHeaders(),
        body: req.postDataBuffer() ?? Buffer.alloc(0),
      };
      await route.abort();
    });
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect.poll(() => captured !== null).toBe(true);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    const sent = captured as unknown as {
      headers: Record<string, string>;
      body: Buffer;
    };
    expect(sent.headers["next-action"]).toBeTruthy();

    const editor = await playwright.request.newContext({
      baseURL,
      storageState: EDITOR_STATE,
    });
    const keep = [
      "next-action",
      "next-router-state-tree",
      "content-type",
      "accept",
    ];
    const res = await editor.post("/admin/settings", {
      headers: {
        ...Object.fromEntries(
          keep
            .filter((k) => sent.headers[k] !== undefined)
            .map((k) => [k, sent.headers[k]!]),
        ),
        origin: baseURL!,
      },
      data: sent.body,
    });
    const text = await res.text();
    await editor.dispose();
    expect(text).toContain("You don't have permission to do that.");

    await page.goto("/en/support");
    await expect(page.getByTestId("support-offline")).toHaveCount(0);
    await page.goto("/admin/settings");
    await expect(
      page.getByLabel(OFFLINE_LABELS.email, { exact: true }),
    ).toHaveValue("");
  } finally {
    await resetOfflineGiving(page);
  }
});
