import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots.txt", () => {
  it("disallows the admin area and API routes", () => {
    const rules = [robots().rules].flat();
    const disallow = rules.flatMap((r) => [r.disallow ?? []].flat());
    expect(disallow).toContain("/admin");
    expect(disallow).toContain("/api/");
  });
});
