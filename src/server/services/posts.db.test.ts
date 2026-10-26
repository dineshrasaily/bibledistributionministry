import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { setPostStatusAction, updatePostAction } from "@/server/actions/posts";
import { resetDb, setTestSession } from "@/test/db-setup";
import { makeOwner, makePost } from "@/test/factories";
import { form, postForm } from "@/test/forms";

const stored = new Date("2026-03-01T08:00:00.000Z");

const publishedAtOf = async (id: string) =>
  (await prisma.post.findUniqueOrThrow({ where: { id } })).publishedAt;

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  setTestSession(await makeOwner());
});

describe("posts publishedAt rule (review NIT 7)", () => {
  it("update with an empty publishedAt on a PUBLISHED post keeps the date", async () => {
    const post = await makePost({ status: "PUBLISHED", publishedAt: stored });
    const result = await updatePostAction(
      null,
      postForm({
        id: post.id,
        slug: post.slug,
        publishedAt: "",
        intent: "publish",
      }),
    );
    expect(result).toMatchObject({ ok: true });
    expect(await publishedAtOf(post.id)).toEqual(stored);
  });

  it("an explicit publishedAt on update replaces the stored date", async () => {
    const post = await makePost({ status: "PUBLISHED", publishedAt: stored });
    await updatePostAction(
      null,
      postForm({
        id: post.id,
        slug: post.slug,
        publishedAt: "2026-04-02T10:00:00+00:00",
        intent: "publish",
      }),
    );
    expect(await publishedAtOf(post.id)).toEqual(
      new Date("2026-04-02T10:00:00Z"),
    );
  });

  it("unpublish never touches publishedAt; republish keeps it", async () => {
    const post = await makePost({ status: "PUBLISHED", publishedAt: stored });
    await setPostStatusAction(null, form({ id: post.id, status: "DRAFT" }));
    expect(await publishedAtOf(post.id)).toEqual(stored);
    await setPostStatusAction(null, form({ id: post.id, status: "PUBLISHED" }));
    expect(await publishedAtOf(post.id)).toEqual(stored);
  });

  it("publishing a post with no stored date sets now", async () => {
    const post = await makePost({ status: "DRAFT", publishedAt: null });
    const before = Date.now();
    await setPostStatusAction(null, form({ id: post.id, status: "PUBLISHED" }));
    const date = await publishedAtOf(post.id);
    expect(date!.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it("saving a draft without a date leaves publishedAt null", async () => {
    const post = await makePost({ status: "DRAFT", publishedAt: null });
    await updatePostAction(
      null,
      postForm({ id: post.id, slug: post.slug, intent: "draft" }),
    );
    expect(await publishedAtOf(post.id)).toBeNull();
  });
});
