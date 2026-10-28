import { describe, expect, it, vi } from "vitest";

describe("zod-setup", () => {
  it.each(["./public-forms", "./donations", "./common"])(
    "importing %s switches Zod to jitless (no eval probe under the CSP)",
    async (mod) => {
      vi.resetModules();
      const { z } = await import("zod");
      await import(/* @vite-ignore */ mod);
      expect(z.config().jitless).toBe(true);
    },
  );

  it("never calls Function / eval while parsing", async () => {
    const { prayerSubmissionSchema } = await import("./public-forms");
    const spy = vi.spyOn(globalThis, "Function");
    prayerSubmissionSchema.safeParse({ body: "Please pray", anonymous: "on" });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
