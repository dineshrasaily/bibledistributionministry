import { describe, expect, it } from "vitest";
import { toPublicShareView } from "./public-share-mappers";

const row = {
  id: "s1",
  kind: "PRAYER" as const,
  textEn: "Pray for peace.",
  textNe: "शान्तिको लागि प्रार्थना।",
  publishedAt: new Date("2026-10-01T00:00:00.000Z"),
};

describe("toPublicShareView", () => {
  it("picks the page locale", () => {
    expect(toPublicShareView(row, "en")).toEqual({
      id: "s1",
      kind: "PRAYER",
      text: "Pray for peace.",
      lang: "en",
      publishedAt: row.publishedAt,
    });
    expect(toPublicShareView(row, "ne")?.lang).toBe("ne");
  });

  it("falls back to the other language with a matching lang", () => {
    expect(toPublicShareView({ ...row, textNe: null }, "ne")).toMatchObject({
      text: "Pray for peace.",
      lang: "en",
    });
    expect(toPublicShareView({ ...row, textEn: "  " }, "en")).toMatchObject({
      text: row.textNe,
      lang: "ne",
    });
  });

  it("returns null when both texts are empty", () => {
    expect(toPublicShareView({ ...row, textEn: null, textNe: "" }, "en")).toBe(
      null,
    );
  });
});
