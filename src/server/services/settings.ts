import "server-only";
import { defaultSiteSettings } from "@/config/site";
import type { SiteSettings } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { parseStoredSocialLinks } from "@/lib/site-settings-mappers";
import type { SettingsInput } from "@/lib/validation/settings";
import { changedFields, type ServiceResult, type Tx } from "./shared";

const SINGLETON = "singleton";

/** The settings row for the edit form (defaults when not seeded yet). */
export async function getSettingsForEdit(): Promise<SiteSettings> {
  const row = await prisma.siteSettings.findUnique({
    where: { id: SINGLETON },
  });
  return (
    row ?? { ...defaultSiteSettings, id: SINGLETON, updatedAt: new Date(0) }
  );
}

/** Stored social URL per platform, for pre-filling the form inputs. */
export function socialUrlsOf(row: SiteSettings): Record<string, string> {
  return Object.fromEntries(
    parseStoredSocialLinks(row.socialLinks).map((l) => [l.platform, l.url]),
  );
}

/** Upserts the singleton. OWNER only (enforced by the action's role). */
export async function updateSiteSettings(
  tx: Tx,
  input: SettingsInput,
): Promise<ServiceResult> {
  const existing = await tx.siteSettings.findUnique({
    where: { id: SINGLETON },
  });
  const data = { ...input };
  await tx.siteSettings.upsert({
    where: { id: SINGLETON },
    create: { id: SINGLETON, ...data },
    update: data,
  });
  const before = existing?.taxDeductibleVerified ?? false;
  return {
    entityId: SINGLETON,
    metadata: {
      changed: changedFields(existing, data),
      ...(before !== input.taxDeductibleVerified
        ? {
            taxDeductibleVerified: {
              from: before,
              to: input.taxDeductibleVerified,
            },
          }
        : {}),
    },
  };
}
