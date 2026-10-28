import { beforeEach, describe, expect, it } from "vitest";
import { getPublishedEventBySlug } from "@/lib/content";
import { prisma } from "@/lib/db";
import { NavigationSignal, resetDb, setTestSession } from "@/test/db-setup";
import {
  makeEditor,
  makeEvent,
  makeGallery,
  makeMedia,
  makeOwner,
} from "@/test/factories";
import { form } from "@/test/forms";
import {
  addGalleryItemsAction,
  createGalleryAction,
  deleteGalleryAction,
  moveGalleryItemAction,
  removeGalleryItemAction,
  setGalleryStatusAction,
  updateGalleryAction,
} from "@/server/actions/galleries";

const photo = (title: string, extra: Parameters<typeof makeMedia>[0] = {}) =>
  makeMedia({
    type: "IMAGE",
    category: "GENERAL",
    titleEn: title,
    url: `/demo/gallery/${title}.svg`,
    altTextEn: `Alt ${title}`,
    embedUrl: null,
    isFeatured: false,
    ...extra,
  });

async function order(galleryId: string) {
  const rows = await prisma.mediaItem.findMany({
    where: { galleryId },
    orderBy: { sortOrder: "asc" },
    select: { titleEn: true, sortOrder: true },
  });
  return rows.map((r) => `${r.sortOrder}:${r.titleEn}`);
}

async function created(fields: Record<string, string>) {
  try {
    await createGalleryAction(null, form(fields));
  } catch (error) {
    if (!(error instanceof NavigationSignal)) throw error;
    return error.location!.match(/galleries\/([^?]+)/)![1]!;
  }
  throw new Error("expected a redirect");
}

beforeEach(async () => {
  await resetDb();
});

describe("gallery actions", () => {
  it("every gallery action needs a session", async () => {
    const g = await makeGallery();
    const results = await Promise.all([
      createGalleryAction(null, form({ titleEn: "x", intent: "draft" })),
      updateGalleryAction(
        null,
        form({ id: g.id, titleEn: "x", intent: "draft" }),
      ),
      setGalleryStatusAction(null, form({ id: g.id, status: "DRAFT" })),
      deleteGalleryAction(null, form({ id: g.id })),
      addGalleryItemsAction(null, form({ galleryId: g.id, mediaIds: ["a"] })),
      moveGalleryItemAction(
        null,
        form({ galleryId: g.id, mediaId: "a", direction: "up" }),
      ),
      removeGalleryItemAction(null, form({ galleryId: g.id, mediaId: "a" })),
    ]);
    for (const r of results)
      expect(r).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(await prisma.auditLog.count()).toBe(0);
    expect(await prisma.gallery.count()).toBe(1);
  });

  it("create + link + add 3 photos -> ordered; move renumbers; edges are no-ops", async () => {
    setTestSession(await makeEditor());
    const event = await makeEvent({ slug: "trip-x" });
    const id = await created({
      titleEn: "Trip photos",
      eventId: event.id,
      intent: "publish",
    });
    const gallery = await prisma.gallery.findUniqueOrThrow({ where: { id } });
    expect(gallery).toMatchObject({ eventId: event.id, status: "PUBLISHED" });
    expect(gallery.publishedAt).not.toBeNull();

    const [a, b, c] = [await photo("a"), await photo("b"), await photo("c")];
    expect(
      await addGalleryItemsAction(
        null,
        form({ galleryId: id, mediaIds: [a.id, b.id, c.id] }),
      ),
    ).toMatchObject({ ok: true });
    expect(await order(id)).toEqual(["0:a", "1:b", "2:c"]);
    expect(
      (await prisma.mediaItem.findUniqueOrThrow({ where: { id: a.id } }))
        .category,
    ).toBe("GALLERY");

    await moveGalleryItemAction(
      null,
      form({ galleryId: id, mediaId: c.id, direction: "up" }),
    );
    expect(await order(id)).toEqual(["0:a", "1:c", "2:b"]);
    const edge = await moveGalleryItemAction(
      null,
      form({ galleryId: id, mediaId: a.id, direction: "up" }),
    );
    expect(edge).toMatchObject({ ok: true, data: { moved: false } });
    await moveGalleryItemAction(
      null,
      form({ galleryId: id, mediaId: b.id, direction: "down" }),
    );
    expect(await order(id)).toEqual(["0:a", "1:c", "2:b"]);

    // Public: published photos in order; unpublishing the gallery hides them.
    expect(
      (await getPublishedEventBySlug("trip-x", "en"))!.gallery.map(
        (m) => m.title,
      ),
    ).toEqual(["a", "c", "b"]);
    await setGalleryStatusAction(null, form({ id, status: "DRAFT" }));
    expect((await getPublishedEventBySlug("trip-x", "en"))!.gallery).toEqual(
      [],
    );

    await removeGalleryItemAction(null, form({ galleryId: id, mediaId: c.id }));
    expect(await order(id)).toEqual(["0:a", "1:b"]);
  });

  it("only pictures with alt text can be added", async () => {
    setTestSession(await makeOwner());
    const g = await makeGallery();
    const video = await makeMedia({ isFeatured: false });
    const noAlt = await photo("n", { altTextEn: null });
    for (const m of [video, noAlt]) {
      expect(
        await addGalleryItemsAction(
          null,
          form({ galleryId: g.id, mediaIds: [m.id] }),
        ),
      ).toMatchObject({
        ok: false,
        code: "VALIDATION",
        fieldErrors: {
          mediaIds: "Only pictures with a description can be added.",
        },
      });
    }
    expect(await prisma.mediaItem.count({ where: { galleryId: g.id } })).toBe(
      0,
    );
  });

  it("adding a photo from another gallery moves it", async () => {
    setTestSession(await makeOwner());
    const [g1, g2] = [await makeGallery(), await makeGallery()];
    const p = await photo("p", { galleryId: g1.id });
    await addGalleryItemsAction(
      null,
      form({ galleryId: g2.id, mediaIds: [p.id] }),
    );
    expect(
      (await prisma.mediaItem.findUniqueOrThrow({ where: { id: p.id } }))
        .galleryId,
    ).toBe(g2.id);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "gallery.items.add" },
    });
    expect(audit.metadata).toEqual({ added: 1, moved: 1 });
  });

  it("deleting a gallery keeps its photos (unlinked)", async () => {
    setTestSession(await makeOwner());
    const g = await makeGallery();
    const p = await photo("p", { galleryId: g.id });
    await expect(
      deleteGalleryAction(null, form({ id: g.id })),
    ).rejects.toBeInstanceOf(NavigationSignal);
    expect(
      (await prisma.mediaItem.findUniqueOrThrow({ where: { id: p.id } }))
        .galleryId,
    ).toBeNull();
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "gallery.delete" },
    });
    expect(audit.metadata).toEqual({ items: 1 });
  });

  it("an unknown event is a field error", async () => {
    setTestSession(await makeOwner());
    expect(
      await createGalleryAction(
        null,
        form({ titleEn: "x", eventId: "no-such-event", intent: "draft" }),
      ),
    ).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { eventId: expect.stringMatching(/no longer exists/) },
    });
    expect(await prisma.gallery.count()).toBe(0);
  });

  it("audit metadata holds ids and counts, never titles", async () => {
    setTestSession(await makeOwner());
    const id = await created({
      titleEn: "Secret title",
      descriptionEn: "Secret description",
      intent: "draft",
    });
    await updateGalleryAction(
      null,
      form({ id, titleEn: "Another secret", intent: "publish" }),
    );
    const metas = (await prisma.auditLog.findMany()).map((a) =>
      JSON.stringify(a.metadata),
    );
    expect(metas.join(" ")).not.toMatch(/[Ss]ecret/);
  });
});
