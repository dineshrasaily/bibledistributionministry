import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it.each([
    "/admin",
    "/admin/posts",
    "/admin/posts/abc-123",
    "/admin/inbox/prayer",
  ])("accepts %s", (value) => {
    expect(safeNext(value)).toBe(value);
  });

  it.each([
    "//evil.com",
    "https://evil.com",
    "/admin/../x",
    "/administration",
    "/admin//evil.com",
    "/en",
    "/admin?x=1",
    "",
  ])("rejects %s", (value) => {
    expect(safeNext(value)).toBeNull();
  });

  it("rejects non-strings", () => {
    expect(safeNext(null)).toBeNull();
    expect(safeNext(undefined)).toBeNull();
    expect(safeNext(42)).toBeNull();
  });
});
