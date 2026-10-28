import { describe, expect, it } from "vitest";
import { resolveGivingState } from "./giving-state";

describe("resolveGivingState", () => {
  it.each([
    [false, false, "not-configured"],
    [false, true, "not-configured"],
    [true, false, "closed"],
    [true, true, "open"],
  ] as const)(
    "checkoutReady=%s donationsEnabled=%s -> %s",
    (checkoutReady, donationsEnabled, state) => {
      expect(resolveGivingState({ checkoutReady, donationsEnabled })).toBe(
        state,
      );
    },
  );
});
