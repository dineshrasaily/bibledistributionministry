import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type {
  CategoryInput,
  UpdateCategoryInput,
} from "@/lib/validation/categories";
import { PAGE_SIZE } from "@/lib/validation/list-query";
import {
  changedFields,
  ilike,
  paginate,
  type ServiceResult,
  type Tx,
} from "./shared";

export type CategoryListQuery = { q?: string; page: number };

export function listCategories(query: CategoryListQuery) {
  const where: Prisma.CategoryWhereInput = query.q
    ? {
        OR: [
          { nameEn: ilike(query.q) },
          { nameNe: ilike(query.q) },
          { slug: ilike(query.q) },
        ],
      }
    : {};
  return paginate(
    query.page,
    PAGE_SIZE,
    () => prisma.category.count({ where }),
    ({ skip, take }) =>
      prisma.category.findMany({
        where,
        orderBy: [{ nameEn: "asc" }, { id: "asc" }],
        include: { _count: { select: { posts: true } } },
        skip,
        take,
      }),
  );
}

/** Every category, for the post editor's checkbox group. */
export function listAllCategories() {
  return prisma.category.findMany({
    orderBy: { nameEn: "asc" },
    select: { id: true, nameEn: true, nameNe: true, slug: true },
  });
}

export function getCategory(id: string) {
  return prisma.category.findUnique({ where: { id } });
}

export async function createCategory(
  tx: Tx,
  input: CategoryInput,
): Promise<ServiceResult<{ id: string }>> {
  const category = await tx.category.create({
    data: input,
    select: { id: true },
  });
  return {
    entityId: category.id,
    metadata: { slug: input.slug },
    data: { id: category.id },
  };
}

export async function updateCategory(
  tx: Tx,
  input: UpdateCategoryInput,
): Promise<ServiceResult> {
  const { id, ...data } = input;
  const existing = await tx.category.findUniqueOrThrow({ where: { id } });
  await tx.category.update({ where: { id }, data });
  return { entityId: id, metadata: { changed: changedFields(existing, data) } };
}

/** PostCategory rows cascade; posts themselves are kept. */
export async function deleteCategory(
  tx: Tx,
  input: { id: string },
): Promise<ServiceResult> {
  const category = await tx.category.delete({
    where: { id: input.id },
    select: { id: true, slug: true },
  });
  return { entityId: category.id, metadata: { slug: category.slug } };
}
