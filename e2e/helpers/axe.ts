import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

/** Same tags and log line as the existing a11y specs. */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

export type AxeSummary = { id: string; impact: string; targets: string[] }[];

/** Serious/critical axe violations on the current page (logged per URL). */
export async function seriousViolations(
  page: Page,
  label = "",
): Promise<AxeSummary> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  console.log(
    `[axe] ${page.url()}${label ? ` (${label})` : ""} violations=${results.violations.length} serious/critical=${serious.length} passes=${results.passes.length}`,
  );
  return serious.map((v) => ({
    id: v.id,
    impact: v.impact ?? "",
    targets: v.nodes.map((n) => n.target.join(" ")),
  }));
}

export type CspViolation = { directive: string; blocked: string };

/**
 * Records every `securitypolicyviolation` event from page start. Call before
 * the first navigation; read with `cspViolations(page)`.
 */
export async function collectCspViolations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Types are erased; only this function body runs in the page.
    const w = window as unknown as { __csp?: CspViolation[] };
    w.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      w.__csp!.push({ directive: e.violatedDirective, blocked: e.blockedURI });
    });
  });
}

export async function cspViolations(page: Page): Promise<CspViolation[]> {
  // Violations are dispatched asynchronously: give queued events a tick.
  await page.waitForTimeout(100);
  return page.evaluate(
    () => (window as unknown as { __csp?: CspViolation[] }).__csp ?? [],
  );
}

/**
 * Collects console errors and uncaught page errors. Returns the live array.
 * `ignore` drops expected messages (for example the 404 document itself).
 */
export function collectConsoleErrors(
  page: Page,
  { ignore = [] }: { ignore?: RegExp[] } = {},
): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (ignore.some((re) => re.test(text))) return;
    errors.push(text);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/** YouTube stub: the iframe loads (CSP is checked on the URL) offline. */
export async function stubYouTube(page: Page): Promise<void> {
  await page.route(/youtube(-nocookie)?\.com|ytimg\.com/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html lang='en'><head><title>stub</title></head><body></body></html>",
    }),
  );
}
