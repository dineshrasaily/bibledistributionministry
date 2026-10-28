import { describe, expect, it } from "vitest";
import { supportViewModel } from "./support-view";

const PORTAL = "https://billing.stripe.com/p/login/test_x";

describe("supportViewModel", () => {
  it("open + unverified: says gifts are not tax-deductible", () => {
    const view = supportViewModel({
      state: "open",
      verified: false,
      portalUrl: null,
      locale: "en",
    });
    expect(view.kind).toBe("open");
    expect(view.taxNote).toBe("Gifts are not tax-deductible.");
    expect(view.taxNote).not.toMatch(/may|consult/);
  });

  it("open + verified: only 'may be', 'consult' and the receipt note", () => {
    const view = supportViewModel({
      state: "open",
      verified: true,
      portalUrl: null,
      locale: "en",
    });
    expect(view.taxNote).toMatch(/may be tax-deductible/);
    expect(view.taxNote).toMatch(/consult your tax advisor/);
    expect(view.taxNote).toMatch(/receipt/);
  });

  it.each(["not-configured", "closed"] as const)(
    "%s: no form and no tax wording at all, whatever the flag",
    (state) => {
      for (const verified of [true, false]) {
        expect(
          supportViewModel({
            state,
            verified,
            portalUrl: PORTAL,
            locale: "en",
          }),
        ).toEqual({ kind: state, taxNote: null });
      }
    },
  );

  it("monthly management: portal link when set, else email", () => {
    const withPortal = supportViewModel({
      state: "open",
      verified: false,
      portalUrl: PORTAL,
      locale: "ne",
    });
    expect(withPortal.kind === "open" && withPortal.manageMonthly).toEqual({
      kind: "portal",
      url: PORTAL,
    });
    const withoutPortal = supportViewModel({
      state: "open",
      verified: false,
      portalUrl: null,
      locale: "ne",
    });
    expect(
      withoutPortal.kind === "open" && withoutPortal.manageMonthly,
    ).toEqual({ kind: "email" });
  });
});
