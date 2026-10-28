"use server";

import { redirect } from "next/navigation";
import { byIdSchema } from "@/lib/validation/common";
import {
  galleryAddItemsSchema,
  galleryMoveSchema,
  galleryRemoveItemSchema,
  gallerySchema,
  galleryStatusSchema,
  updateGallerySchema,
} from "@/lib/validation/galleries";
import {
  addGalleryItems,
  createGallery,
  deleteGallery,
  moveGalleryItem,
  removeGalleryItem,
  setGalleryStatus,
  updateGallery,
} from "@/server/services/galleries";
import {
  type ActionResult,
  formDataToObject,
  runAdminAction,
} from "./run-admin-action";

const common = {
  role: "ADMIN",
  entityType: "Gallery",
  revalidate: ["public", "admin"],
} as const;

export async function createGalleryAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAdminAction(
    {
      ...common,
      revalidate: [...common.revalidate],
      name: "gallery.create",
      schema: gallerySchema,
      successMessage: "Gallery created.",
      run: createGallery,
    },
    formDataToObject(formData),
  );
  if (result.ok && result.data?.id) {
    redirect(`/admin/galleries/${result.data.id}?toast=created`);
  }
  return result;
}

export async function updateGalleryAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    {
      ...common,
      revalidate: [...common.revalidate],
      name: "gallery.update",
      schema: updateGallerySchema,
      successMessage:
        formData.get("intent") === "publish"
          ? "Gallery saved and published."
          : "Draft saved.",
      run: updateGallery,
    },
    formDataToObject(formData),
  );
}

export async function setGalleryStatusAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    {
      ...common,
      revalidate: [...common.revalidate],
      name: "gallery.status",
      schema: galleryStatusSchema,
      successMessage:
        formData.get("status") === "PUBLISHED"
          ? "Gallery published."
          : "Gallery unpublished.",
      run: setGalleryStatus,
    },
    formDataToObject(formData),
  );
}

export async function deleteGalleryAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const result = await runAdminAction(
    {
      ...common,
      revalidate: [...common.revalidate],
      name: "gallery.delete",
      schema: byIdSchema,
      successMessage: "Gallery deleted.",
      run: deleteGallery,
    },
    formDataToObject(formData),
  );
  if (result.ok) redirect("/admin/galleries?toast=deleted");
  return result;
}

export async function addGalleryItemsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    {
      ...common,
      revalidate: [...common.revalidate],
      name: "gallery.items.add",
      schema: galleryAddItemsSchema,
      successMessage: "Pictures added to the gallery.",
      run: addGalleryItems,
    },
    formDataToObject(formData, { arrays: ["mediaIds"] }),
  );
}

export async function moveGalleryItemAction(
  _prev: ActionResult<{ moved: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ moved: boolean }>> {
  return runAdminAction(
    {
      ...common,
      revalidate: [...common.revalidate],
      name: "gallery.items.move",
      schema: galleryMoveSchema,
      successMessage: "Order saved.",
      run: moveGalleryItem,
    },
    formDataToObject(formData),
  );
}

export async function removeGalleryItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    {
      ...common,
      revalidate: [...common.revalidate],
      name: "gallery.items.remove",
      schema: galleryRemoveItemSchema,
      successMessage: "Picture removed from the gallery.",
      run: removeGalleryItem,
    },
    formDataToObject(formData),
  );
}
