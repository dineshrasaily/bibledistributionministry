"use server";

import { redirect } from "next/navigation";
import {
  categorySchema,
  updateCategorySchema,
} from "@/lib/validation/categories";
import { byIdSchema } from "@/lib/validation/common";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/server/services/categories";
import {
  type ActionResult,
  formDataToObject,
  runAdminAction,
} from "./run-admin-action";

/** Inline create on the list page: no redirect, the list revalidates. */
export async function createCategoryAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return runAdminAction(
    {
      name: "category.create",
      role: "ADMIN",
      schema: categorySchema,
      entityType: "Category",
      revalidate: ["public", "admin"],
      successMessage: "Category created.",
      run: createCategory,
    },
    formDataToObject(formData),
  );
}

export async function updateCategoryAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    {
      name: "category.update",
      role: "ADMIN",
      schema: updateCategorySchema,
      entityType: "Category",
      revalidate: ["public", "admin"],
      successMessage: "Category saved.",
      run: updateCategory,
    },
    formDataToObject(formData),
  );
}

export async function deleteCategoryAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const result = await runAdminAction(
    {
      name: "category.delete",
      role: "ADMIN",
      schema: byIdSchema,
      entityType: "Category",
      revalidate: ["public", "admin"],
      successMessage: "Category deleted.",
      run: deleteCategory,
    },
    formDataToObject(formData),
  );
  if (result.ok) redirect("/admin/categories?toast=deleted");
  return result;
}
