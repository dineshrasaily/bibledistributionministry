import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { seedDemoContent } from "../../../prisma/seed-lib";
import { NavigationSignal, resetDb, setTestSession } from "@/test/db-setup";
import {
  makeCategory,
  makeEditor,
  makeOwner,
  makePost,
} from "@/test/factories";
import { form, postForm } from "@/test/forms";
import {
  createPostAction,
  deletePostAction,
  setPostStatusAction,
  updatePostAction,
} from "./posts";
import { createCategoryAction } from "./categories";
import { createEventAction } from "./events";
import { createMediaAction } from "./media";
import { updateSiteSettingsAction } from "./settings";
import { createEditorAction, setUserActiveAction } from "./users";
import { createVerseAction } from "./verses";
import { setPrayerStatusAction } from "./inbox";

const auditCount = () => prisma.auditLog.count();

async function caught(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    (value) => value,
    (e: unknown) => e,
  );
}

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("AC15: authorization in actions", () => {
  it("EDITOR gets FORBIDDEN from owner-only actions; DB unchanged; no audit row", async () => {
    await seedDemoContent(prisma);
    const editor = await makeEditor();
    const other = await makeEditor();
    setTestSession(editor);

    const settings = await updateSiteSettingsAction(
      null,
      form({ ministryName: "Hijacked", contactEmail: "x@example.org" }),
    );
    const create = await createEditorAction(
      null,
      form({
        name: "New",
        email: "new@example.org",
        password: "correct horse battery",
        confirmPassword: "correct horse battery",
      }),
    );
    const deactivate = await setUserActiveAction(
      null,
      form({ id: other.id, active: "false" }),
    );

    for (const result of [settings, create, deactivate]) {
      expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
    }
    const row = await prisma.siteSettings.findUniqueOrThrow({
      where: { id: "singleton" },
    });
    expect(row.ministryName).toBe("Demo Ministry");
    expect(await prisma.adminUser.count()).toBe(2);
    expect(
      (await prisma.adminUser.findUniqueOrThrow({ where: { id: other.id } }))
        .isActive,
    ).toBe(true);
    expect(await auditCount()).toBe(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("no session -> UNAUTHENTICATED for content actions, nothing written", async () => {
    setTestSession(null);
    const results = await Promise.all([
      createPostAction(null, postForm()),
      createCategoryAction(null, form({ nameEn: "News", slug: "news" })),
      createVerseAction(
        null,
        form({
          reference: "x",
          text: "y",
          translation: "WEB",
          intent: "draft",
        }),
      ),
      createEventAction(null, form({})),
      createMediaAction(null, form({})),
      setPrayerStatusAction(null, form({ id: "abc", status: "PRAYED" })),
    ]);
    for (const result of results) {
      expect(result).toMatchObject({
        ok: false,
        code: "UNAUTHENTICATED",
        formError: "Your session has expired. Please sign in again.",
      });
    }
    expect(await prisma.post.count()).toBe(0);
    expect(await auditCount()).toBe(0);
  });

  it("a revoked session (sessionVersion bumped) is UNAUTHENTICATED", async () => {
    const owner = await makeOwner();
    setTestSession(owner);
    await prisma.adminUser.update({
      where: { id: owner.id },
      data: { sessionVersion: { increment: 1 } },
    });
    expect(await createPostAction(null, postForm())).toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });
});

describe("AC24: posts mutations audit and revalidate", () => {
  it("create redirects only after the post and its audit row are committed", async () => {
    const owner = await makeOwner();
    setTestSession(owner);
    const slug = `committed-${Date.now()}`;
    let probe: Promise<[number, number]> | undefined;
    vi.mocked(redirect).mockImplementationOnce((location: string) => {
      probe = Promise.all([
        prisma.post.count({ where: { slug } }),
        prisma.auditLog.count({ where: { action: "post.create" } }),
      ]);
      throw new NavigationSignal("redirect", location);
    });

    const error = await caught(createPostAction(null, postForm({ slug })));
    expect(error).toBeInstanceOf(NavigationSignal);
    const post = await prisma.post.findUniqueOrThrow({ where: { slug } });
    expect((error as NavigationSignal).location).toBe(
      `/admin/posts/${post.id}?toast=created`,
    );
    expect(await probe).toEqual([1, 1]);
    expect(post.authorId).toBe(owner.id);
    expect(post.status).toBe("DRAFT");
    expect(revalidatePath).toHaveBeenCalledWith("/[locale]", "layout");
    expect(revalidatePath).toHaveBeenCalledWith("/admin", "layout");
  });

  it("update, publish and delete each write exactly one audit row", async () => {
    const owner = await makeOwner();
    setTestSession(owner);
    const post = await makePost({ status: "DRAFT", publishedAt: null });

    const steps: [string, () => Promise<unknown>][] = [
      [
        "post.update",
        () =>
          updatePostAction(
            null,
            postForm({ id: post.id, slug: post.slug, titleEn: "Updated" }),
          ),
      ],
      [
        "post.status",
        () =>
          setPostStatusAction(null, form({ id: post.id, status: "PUBLISHED" })),
      ],
      [
        "post.delete",
        () => caught(deletePostAction(null, form({ id: post.id }))),
      ],
    ];
    for (const [action, run] of steps) {
      vi.mocked(revalidatePath).mockClear();
      const before = await auditCount();
      const result = await run();
      if (action !== "post.delete") expect(result).toMatchObject({ ok: true });
      expect(await auditCount()).toBe(before + 1);
      const row = await prisma.auditLog.findFirstOrThrow({
        where: { action },
      });
      expect(row).toMatchObject({
        actorId: owner.id,
        actorEmail: owner.email,
        entityType: "Post",
        entityId: post.id,
      });
      expect(revalidatePath).toHaveBeenCalledWith("/[locale]", "layout");
    }
    expect(await prisma.post.count({ where: { id: post.id } })).toBe(0);
    const del = await caught(deletePostAction(null, form({ id: post.id })));
    expect(del).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("update audit metadata lists changed fields and the status transition", async () => {
    const owner = await makeOwner();
    setTestSession(owner);
    const post = await makePost({ status: "DRAFT", publishedAt: null });
    await updatePostAction(
      null,
      postForm({
        id: post.id,
        slug: post.slug,
        titleEn: "New title",
        excerptEn: post.excerptEn,
        intent: "publish",
      }),
    );
    const row = await prisma.auditLog.findFirstOrThrow({
      where: { action: "post.update" },
    });
    const metadata = row.metadata as {
      changed: string[];
      status: { from: string; to: string };
    };
    expect(metadata.changed).toContain("titleEn");
    expect(metadata.changed).not.toContain("excerptEn");
    expect(metadata.status).toEqual({ from: "DRAFT", to: "PUBLISHED" });
  });

  it("a validation failure writes nothing", async () => {
    setTestSession(await makeOwner());
    const result = await createPostAction(null, postForm({ titleEn: "" }));
    expect(result).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { titleEn: "Required" },
    });
    expect(await prisma.post.count()).toBe(0);
    expect(await auditCount()).toBe(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("P2002 duplicate slug -> CONFLICT with a slug field error", async () => {
    setTestSession(await makeOwner());
    const existing = await makePost();
    const result = await createPostAction(
      null,
      postForm({ slug: existing.slug }),
    );
    expect(result).toMatchObject({
      ok: false,
      code: "CONFLICT",
      fieldErrors: { slug: "This URL slug is already used. Choose another." },
    });
    expect(await auditCount()).toBe(0);
  });

  it("P2003 unknown category -> VALIDATION on categoryIds and no rows written", async () => {
    setTestSession(await makeOwner());
    const category = await makeCategory();
    const result = await createPostAction(
      null,
      postForm({ categoryIds: [category.id, "missing-category"] }),
    );
    expect(result).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: {
        categoryIds:
          "One of the selected categories no longer exists. Refresh and try again.",
      },
    });
    expect(await prisma.post.count()).toBe(0);
    expect(await prisma.postCategory.count()).toBe(0);
    expect(await auditCount()).toBe(0);
  });

  it("OWNER settings update writes one audit row with taxDeductibleVerified from/to", async () => {
    await seedDemoContent(prisma);
    setTestSession(await makeOwner());
    const result = await updateSiteSettingsAction(
      null,
      form({
        ministryName: "Renamed Ministry",
        contactEmail: "hello@example.org",
        taxDeductibleVerified: "on",
        isDemo: "on",
      }),
    );
    expect(result).toMatchObject({ ok: true, message: "Settings saved." });
    const row = await prisma.siteSettings.findUniqueOrThrow({
      where: { id: "singleton" },
    });
    expect(row.ministryName).toBe("Renamed Ministry");
    expect(row.socialLinks).toEqual([]);
    const audit = await prisma.auditLog.findMany();
    expect(audit).toHaveLength(1);
    expect(audit[0]!.metadata).toMatchObject({
      taxDeductibleVerified: { from: false, to: true },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/[locale]", "layout");
  });

  it("OWNER saves the About page fields; the audit lists them as changed", async () => {
    await seedDemoContent(prisma);
    setTestSession(await makeOwner());
    const result = await updateSiteSettingsAction(
      null,
      form({
        ministryName: "Demo Ministry",
        contactEmail: "hello@example.org",
        isDemo: "on",
        testimonyEn: "My **testimony**",
        goalsNe: "लक्ष्य",
        aboutImageUrl: "/brand/logo-full.png",
        aboutImageAltEn: "The ministry logo",
      }),
    );
    expect(result).toMatchObject({ ok: true });
    const row = await prisma.siteSettings.findUniqueOrThrow({
      where: { id: "singleton" },
    });
    expect(row.testimonyEn).toBe("My **testimony**");
    expect(row.goalsNe).toBe("लक्ष्य");
    expect(row.aboutImageAltEn).toBe("The ministry logo");
    const [audit] = await prisma.auditLog.findMany();
    const changed = (audit!.metadata as { changed: string[] }).changed;
    expect(changed).toEqual(
      expect.arrayContaining(["testimonyEn", "goalsNe", "aboutImageUrl"]),
    );
  });

  it("an About photo without alt text is a field error and saves nothing", async () => {
    await seedDemoContent(prisma);
    setTestSession(await makeOwner());
    const result = await updateSiteSettingsAction(
      null,
      form({
        ministryName: "Demo Ministry",
        contactEmail: "hello@example.org",
        aboutImageUrl: "/brand/logo-full.png",
      }),
    );
    expect(result).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { aboutImageAltEn: expect.any(String) },
    });
    expect(await auditCount()).toBe(0);
  });
});

// Phase 7: the media eventId link moved to galleries (rewritten block; the
// gallery link itself is covered in galleries.db.test.ts).
describe("media order in gallery", () => {
  const mediaForm = () =>
    form({
      type: "IMAGE",
      category: "GALLERY",
      titleEn: "Ordered photo",
      url: "/demo/gallery/sample-1.svg",
      altTextEn: "Sample placeholder",
      sortOrder: "4",
      intent: "publish",
    });

  it("sortOrder persists", async () => {
    setTestSession(await makeEditor());
    await expect(createMediaAction(null, mediaForm())).rejects.toBeInstanceOf(
      NavigationSignal,
    );
    const row = await prisma.mediaItem.findFirstOrThrow({
      where: { titleEn: "Ordered photo" },
    });
    expect(row.sortOrder).toBe(4);
    expect(row.galleryId).toBeNull();
    expect(row.status).toBe("PUBLISHED");
  });
});
