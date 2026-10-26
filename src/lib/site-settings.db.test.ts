import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSiteSettings } from "@/config/site";
import { resetDb } from "@/test/db-setup";
import { seedDemoContent } from "../../prisma/seed-lib";
import { prisma } from "./db";
import { getLocalizedSiteSettings, getSiteSettings } from "./site-settings";

beforeEach(async () => {
  await resetDb();
});

describe("site settings", () => {
  it("falls back to the defaults (with a warning) when the row is missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const row = await getSiteSettings();
    expect(row).toMatchObject({ ...defaultSiteSettings, id: "singleton" });
    expect(warn).toHaveBeenCalledWith(
      "[site-settings] singleton row missing; using defaults",
    );
    warn.mockRestore();
  });

  it("returns the stored row values", async () => {
    await seedDemoContent(prisma);
    await prisma.siteSettings.update({
      where: { id: "singleton" },
      data: {
        ministryName: "Stored Ministry",
        contactEmail: "team@example.org",
      },
    });
    const settings = await getLocalizedSiteSettings("en");
    expect(settings.name).toBe("Stored Ministry");
    expect(settings.contactEmail).toBe("team@example.org");
    expect(settings.isDemo).toBe(true);
  });

  it("resolves Nepali with an English fallback and splits paragraphs", async () => {
    await seedDemoContent(prisma);
    const ne = await getLocalizedSiteSettings("ne");
    expect(ne.tagline).toBe(defaultSiteSettings.taglineNe);
    expect(ne.aboutIntroParagraphs).toHaveLength(2);
    expect(ne.aboutIntroParagraphs[0]).toMatch(/[\u0900-\u097F]/);

    await prisma.siteSettings.update({
      where: { id: "singleton" },
      data: { missionStatementNe: "  ", aboutIntroNe: null },
    });
    const fallback = await getLocalizedSiteSettings("ne");
    expect(fallback.missionStatement).toBe(
      defaultSiteSettings.missionStatementEn,
    );
    expect(fallback.aboutIntroParagraphs).toEqual(
      defaultSiteSettings.aboutIntroEn.split("\n\n"),
    );
  });
});
