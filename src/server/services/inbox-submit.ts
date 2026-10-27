import "server-only";
import { prisma } from "@/lib/db";
import type {
  ContactSubmission,
  PrayerSubmission,
} from "@/lib/validation/public-forms";

/**
 * Create-only writes for the PUBLIC prayer and contact forms. Nothing here
 * reads, updates or deletes inbox rows (the privacy scan enforces that);
 * reading stays in inbox.ts behind requireAdmin().
 */

export async function createPrayerRequest(
  input: PrayerSubmission,
): Promise<{ id: string }> {
  return prisma.prayerRequest.create({
    data: {
      // Anonymous: never store a name or email, whatever was sent.
      name: input.isAnonymous ? null : input.name,
      email: input.isAnonymous ? null : input.email,
      isAnonymous: input.isAnonymous,
      body: input.body,
      shareConsent: input.shareConsent,
      locale: input.locale,
    },
    select: { id: true },
  });
}

export async function createContactMessage(
  input: ContactSubmission,
): Promise<{ id: string }> {
  return prisma.contactMessage.create({
    data: {
      name: input.name,
      email: input.email,
      kind: input.kind,
      subject: input.subject,
      body: input.message,
      shareConsent: input.kind === "TESTIMONY" && input.shareConsent,
      locale: input.locale,
    },
    select: { id: true },
  });
}
