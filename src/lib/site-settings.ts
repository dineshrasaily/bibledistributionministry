import "server-only";
import { cache } from "react";
import { defaultSiteSettings } from "@/config/site";
import type { SiteSettings } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/routing";
import { prisma } from "./db";
import { log } from "./log";
import {
  toLocalizedSiteSettings,
  type LocalizedSiteSettings,
} from "./site-settings-mappers";

export type {
  LocalizedSiteSettings,
  LocalizedSocialLink,
} from "./site-settings-mappers";

let warnedMissing = false;

/**
 * The singleton settings row, deduped per request. A missing row (not seeded
 * yet) falls back to the defaults; DB errors propagate on purpose so a broken
 * database never ships a wrong-but-static page.
 */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  const row = await prisma.siteSettings.findUnique({
    where: { id: "singleton" },
  });
  if (row) return row;
  if (!warnedMissing) {
    warnedMissing = true;
    console.warn("[site-settings] singleton row missing; using defaults");
  }
  return { ...defaultSiteSettings, id: "singleton", updatedAt: new Date(0) };
});

export async function getLocalizedSiteSettings(
  locale: AppLocale,
): Promise<LocalizedSiteSettings> {
  const row = await getSiteSettings();
  return toLocalizedSiteSettings(row, locale, (count) =>
    log.warn("site-settings.social.invalid", { count }),
  );
}
