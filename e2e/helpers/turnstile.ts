import { expect, type Page } from "@playwright/test";

/** Cloudflare's documented dummy token for the always-pass test keys. */
export const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

/**
 * Replaces https://challenges.cloudflare.com/** with a tiny local stub, so
 * the tests never contact Cloudflare. The stub draws a labelled box and (when
 * `pass`) hands the dummy token to the widget callback, like the real
 * always-pass test widget does.
 */
export async function stubTurnstile(
  page: Page,
  { pass = true }: { pass?: boolean } = {},
): Promise<void> {
  const script = `
    (function () {
      var widgets = {};
      var n = 0;
      function solve(id) {
        var w = widgets[id];
        if (!w || !${pass}) return;
        setTimeout(function () {
          if (widgets[id]) {
            w.box.textContent = "Spam check passed (test stub)";
            w.opts.callback(${JSON.stringify(DUMMY_TOKEN)});
          }
        }, 50);
      }
      window.turnstile = {
        render: function (el, opts) {
          var id = "stub-" + (n += 1);
          var box = document.createElement("div");
          box.setAttribute("data-testid", "turnstile-stub");
          box.textContent = ${pass} ? "Spam check (test stub)" : "Spam check (test stub, never passes)";
          box.style.cssText = "box-sizing:border-box;width:100%;max-width:300px;height:65px;display:flex;align-items:center;padding:0 16px;border:1px solid #d6cfc2;border-radius:6px;background:#fafafa;color:#1E2A44;font:14px system-ui,sans-serif";
          el.appendChild(box);
          widgets[id] = { el: el, opts: opts, box: box };
          solve(id);
          return id;
        },
        reset: function (id) {
          if (widgets[id]) widgets[id].box.textContent = "Spam check (test stub)";
          solve(id);
        },
        remove: function (id) {
          if (widgets[id]) { widgets[id].box.remove(); delete widgets[id]; }
        },
      };
    })();
  `;
  await page.route("https://challenges.cloudflare.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: script,
    }),
  );
}

/** Waits until the (stubbed) Turnstile handed its token to the form. */
export async function waitForTurnstile(page: Page): Promise<void> {
  await expect(page.locator('input[name="turnstileToken"]')).toHaveValue(
    DUMMY_TOKEN,
  );
}

/**
 * Six random digits for admin-written public text: no letters (so it can't
 * share a word with a name marker) and too short to look like a phone number.
 */
export function digitMarker(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Unique, findable text for one test run. */
export function uniqueMarker(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
