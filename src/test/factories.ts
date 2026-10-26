/**
 * Test data factories for DB tests. Each returns the created row.
 * Admin factories also return the plain password and TOTP secret.
 * (`setTestSession` lives in src/test/db-setup.ts next to the `@/auth` mock.)
 */
import type { AdminUser, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/server/auth/password";
import { seal } from "@/server/auth/secret-box";
import { newTotpSecret } from "@/server/auth/totp";

let seq = 0;
const next = () => `${Date.now().toString(36)}-${(seq += 1)}`;

export const TEST_PASSWORD = "correct horse battery staple";

export type TestAdmin = AdminUser & { password: string; totpSecret: string };

type AdminOverrides = Partial<
  Omit<Prisma.AdminUserUncheckedCreateInput, "role">
> & {
  password?: string;
  /** false: no authenticator yet (first login enrols). Default true. */
  totp?: boolean;
};

async function makeAdmin(
  role: "OWNER" | "EDITOR",
  { password = TEST_PASSWORD, totp = true, ...data }: AdminOverrides,
): Promise<TestAdmin> {
  const n = next();
  const totpSecret = newTotpSecret();
  // Create first (the id is the AAD), then seal (review NIT 2).
  const created = await prisma.adminUser.create({
    data: {
      email: `${role.toLowerCase()}-${n}@example.org`,
      name: `Test ${role.toLowerCase()} ${n}`,
      passwordHash: await hashPassword(password),
      role,
      ...data,
      totpSecretEnc: null,
      totpEnabled: false,
    },
  });
  const user = totp
    ? await prisma.adminUser.update({
        where: { id: created.id },
        data: {
          totpSecretEnc: seal(totpSecret, `totp:${created.id}`),
          totpEnabled: true,
        },
      })
    : created;
  return { ...user, password, totpSecret };
}

export const makeOwner = (data: AdminOverrides = {}) =>
  makeAdmin("OWNER", data);
export const makeEditor = (data: AdminOverrides = {}) =>
  makeAdmin("EDITOR", data);

export function makeCategory(
  data: Partial<Prisma.CategoryUncheckedCreateInput> = {},
) {
  const n = next();
  return prisma.category.create({
    data: { slug: `test-category-${n}`, nameEn: `Category ${n}`, ...data },
  });
}

/** Inbox rows (Phase 6 writes these; tests create them here). */
export function makePrayerRequest(
  data: Partial<Prisma.PrayerRequestUncheckedCreateInput> = {},
) {
  return prisma.prayerRequest.create({
    data: {
      name: "Test Person",
      email: "person@example.org",
      body: "Please pray for my family.",
      ...data,
    },
  });
}

export function makeContactMessage(
  data: Partial<Prisma.ContactMessageUncheckedCreateInput> = {},
) {
  return prisma.contactMessage.create({
    data: {
      name: "Test Person",
      email: "person@example.org",
      subject: "Hello",
      body: "A private message body.",
      ...data,
    },
  });
}

export function makePost(data: Partial<Prisma.PostUncheckedCreateInput> = {}) {
  const n = next();
  return prisma.post.create({
    data: {
      type: "MINISTRY_UPDATE",
      slug: `test-post-${n}`,
      titleEn: `Test post ${n}`,
      excerptEn: "Test excerpt",
      status: "PUBLISHED",
      publishedAt: new Date(),
      ...data,
    },
  });
}

export function makeEvent(
  data: Partial<Prisma.EventUncheckedCreateInput> = {},
) {
  const n = next();
  return prisma.event.create({
    data: {
      kind: "OUTREACH",
      slug: `test-event-${n}`,
      titleEn: `Test event ${n}`,
      startsAt: new Date(Date.now() + 86_400_000),
      locationEn: "Test location",
      status: "UPCOMING",
      publishStatus: "PUBLISHED",
      ...data,
    },
  });
}

export function makeMedia(
  data: Partial<Prisma.MediaItemUncheckedCreateInput> = {},
) {
  const n = next();
  return prisma.mediaItem.create({
    data: {
      type: "VIDEO_EMBED",
      category: "GENERAL",
      titleEn: `Test media ${n}`,
      descriptionEn: "Test description",
      embedUrl: "https://www.youtube-nocookie.com/embed/abc123",
      status: "PUBLISHED",
      isFeatured: true,
      ...data,
    },
  });
}

export function makeVerse(
  data: Partial<Prisma.BibleVerseUncheckedCreateInput> = {},
) {
  const n = next();
  return prisma.bibleVerse.create({
    data: {
      reference: `Test ${n}`,
      text: "Test verse text.",
      translation: "WEB",
      status: "PUBLISHED",
      ...data,
    },
  });
}
