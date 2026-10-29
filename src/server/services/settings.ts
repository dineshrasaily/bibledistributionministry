import "server-only";
import { defaultSiteSettings } from "@/config/site";
import type { SiteSettings } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { parseStoredSocialLinks } from "@/lib/site-settings-mappers";
import type { RetentionInput } from "@/lib/validation/inbox";
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

/** Inbox retention (months) only. OWNER only (enforced by the action's role). */
export async function updateInboxRetention(
  tx: Tx,
  input: RetentionInput,
): Promise<ServiceResult> {
  const existing = await tx.siteSettings.findUnique({
    where: { id: SINGLETON },
    select: { inboxRetentionMonths: true },
  });
  await tx.siteSettings.upsert({
    where: { id: SINGLETON },
    create: {
      ...defaultSiteSettings,
      id: SINGLETON,
      inboxRetentionMonths: input.inboxRetentionMonths,
    },
    update: { inboxRetentionMonths: input.inboxRetentionMonths },
  });
  return {
    entityId: SINGLETON,
    metadata: {
      inboxRetentionMonths: {
        from: existing?.inboxRetentionMonths ?? null,
        to: input.inboxRetentionMonths,
      },
    },
  };
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
      // Field NAMES only, never values (keeps bank account numbers out of the audit log).
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
