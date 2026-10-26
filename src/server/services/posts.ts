import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ContentStatus, PostType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { PAGE_SIZE } from "@/lib/validation/list-query";
import type {
  PostInput,
  PostStatusInput,
  UpdatePostInput,
} from "@/lib/validation/posts";
import type { AdminActor } from "@/server/auth/guards";
import {
  changedFields,
  ilike,
  paginate,
  type ServiceResult,
  type Tx,
} from "./shared";

export type PostListQuery = {
  q?: string;
  page: number;
  type?: PostType;
  status?: ContentStatus;
};

const listSelect = {
  id: true,
  type: true,
  slug: true,
  titleEn: true,
  titleNe: true,
  status: true,
  isFeatured: true,
  isDemo: true,
  publishedAt: true,
  updatedAt: true,
} satisfies Prisma.PostSelect;

export type PostListItem = Prisma.PostGetPayload<{ select: typeof listSelect }>;

export function listPosts(query: PostListQuery) {
  const where: Prisma.PostWhereInput = {
    ...(query.type ? { type: query.type } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { titleEn: ilike(query.q) },
            { titleNe: ilike(query.q) },
            { slug: ilike(query.q) },
          ],
        }
      : {}),
  };
  return paginate<PostListItem>(
    query.page,
    PAGE_SIZE,
    () => prisma.post.count({ where }),
    ({ skip, take }) =>
      prisma.post.findMany({
        where,
        select: listSelect,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip,
        take,
      }),
  );
}

/** Edit form data: the row plus its category ids (null when missing). */
export async function getPost(id: string) {
  const post = await prisma.post.findUnique({
    where: { id },
    include: { categories: { select: { categoryId: true } } },
  });
  if (!post) return null;
  const { categories, ...rest } = post;
  return { ...rest, categoryIds: categories.map((c) => c.categoryId) };
}

function statusFor(intent: PostInput["intent"]): ContentStatus {
  return intent === "publish" ? "PUBLISHED" : "DRAFT";
}

export async function createPost(
  tx: Tx,
  input: PostInput,
  actor: AdminActor,
): Promise<ServiceResult<{ id: string }>> {
  const { intent, categoryIds, publishedAt, ...fields } = input;
  const status = statusFor(intent);
  const post = await tx.post.create({
    data: {
      ...fields,
      status,
      publishedAt: publishedAt ?? (status === "PUBLISHED" ? new Date() : null),
      authorId: actor.id,
      categories: {
        createMany: { data: categoryIds.map((categoryId) => ({ categoryId })) },
      },
    },
    select: { id: true },
  });
  return {
    entityId: post.id,
    metadata: { status, categories: categoryIds.length },
    data: { id: post.id },
  };
}

/**
 * publishedAt rule (review NIT 7): an empty value keeps the stored date;
 * publishing sets now only when nothing is stored.
 */
export async function updatePost(
  tx: Tx,
  input: UpdatePostInput,
): Promise<ServiceResult> {
  const { id, intent, categoryIds, publishedAt, ...fields } = input;
  const existing = await tx.post.findUniqueOrThrow({
    where: { id },
    include: { categories: { select: { categoryId: true } } },
  });
  const status = statusFor(intent);
  const keptDate = publishedAt ?? existing.publishedAt;
  const data = {
    ...fields,
    status,
    publishedAt: keptDate ?? (status === "PUBLISHED" ? new Date() : null),
  };
  const changed = changedFields(existing, data);
  const before = existing.categories.map((c) => c.categoryId).toSorted();
  if (JSON.stringify(before) !== JSON.stringify(categoryIds.toSorted())) {
    changed.push("categoryIds");
  }

  await tx.post.update({ where: { id }, data });
  await tx.postCategory.deleteMany({ where: { postId: id } });
  if (categoryIds.length > 0) {
    await tx.postCategory.createMany({
      data: categoryIds.map((categoryId) => ({ postId: id, categoryId })),
    });
  }
  return {
    entityId: id,
    metadata: {
      changed,
      ...(existing.status !== status
        ? { status: { from: existing.status, to: status } }
        : {}),
    },
  };
}

/** Publish keeps an existing publishedAt (now only if null); unpublish never touches it. */
export async function setPostStatus(
  tx: Tx,
  input: PostStatusInput,
): Promise<ServiceResult> {
  const existing = await tx.post.findUniqueOrThrow({
    where: { id: input.id },
    select: { status: true, publishedAt: true },
  });
  await tx.post.update({
    where: { id: input.id },
    data:
      input.status === "PUBLISHED"
        ? {
            status: input.status,
            publishedAt: existing.publishedAt ?? new Date(),
          }
        : { status: input.status },
  });
  return {
    entityId: input.id,
    metadata: { status: { from: existing.status, to: input.status } },
  };
}

export async function deletePost(
  tx: Tx,
  input: { id: string },
): Promise<ServiceResult> {
  const post = await tx.post.delete({
    where: { id: input.id },
    select: { id: true, slug: true },
  });
  return { entityId: post.id, metadata: { slug: post.slug } };
}
