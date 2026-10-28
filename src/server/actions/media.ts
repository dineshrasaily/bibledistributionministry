"use server";

import { redirect } from "next/navigation";
import { byIdSchema } from "@/lib/validation/common";
import {
  mediaSchema,
  mediaStatusSchema,
  updateMediaSchema,
} from "@/lib/validation/media";
import {
  createMedia,
  deleteMedia,
  setMediaStatus,
  updateMedia,
} from "@/server/services/media";
import { removeStoredFile } from "@/server/storage";
import {
  type ActionResult,
  formDataToObject,
  runAdminAction,
} from "./run-admin-action";

export async function createMediaAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAdminAction(
    {
      name: "media.create",
      role: "ADMIN",
      schema: mediaSchema,
      entityType: "MediaItem",
      revalidate: ["public", "admin"],
      successMessage: "Media item created.",
      run: createMedia,
    },
    formDataToObject(formData),
  );
  if (result.ok && result.data?.id) {
    redirect(`/admin/media/${result.data.id}?toast=created`);
  }
  return result;
}

export async function updateMediaAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    {
      name: "media.update",
      role: "ADMIN",
      schema: updateMediaSchema,
      entityType: "MediaItem",
      revalidate: ["public", "admin"],
      successMessage:
        formData.get("intent") === "publish"
          ? "Media item saved and published."
          : "Draft saved.",
      run: updateMedia,
    },
    formDataToObject(formData),
  );
}

export async function setMediaStatusAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    {
      name: "media.status",
      role: "ADMIN",
      schema: mediaStatusSchema,
      entityType: "MediaItem",
      revalidate: ["public", "admin"],
      successMessage:
        formData.get("status") === "PUBLISHED"
          ? "Media item published."
          : "Media item unpublished.",
      run: setMediaStatus,
    },
    formDataToObject(formData),
  );
}

export async function deleteMediaAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const result = await runAdminAction(
    {
      name: "media.delete",
      role: "ADMIN",
      schema: byIdSchema,
      entityType: "MediaItem",
      revalidate: ["public", "admin"],
      successMessage: "Media item deleted.",
      run: deleteMedia,
      // The row is gone: now remove its stored file (an orphan is harmless).
      afterCommit: (r) => removeStoredFile(r.data?.stored),
    },
    formDataToObject(formData),
  );
  if (result.ok) redirect("/admin/media?toast=deleted");
  return result;
}
