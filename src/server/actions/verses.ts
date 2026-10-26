"use server";

import { redirect } from "next/navigation";
import { byIdSchema } from "@/lib/validation/common";
import {
  featureVerseSchema,
  updateVerseSchema,
  verseSchema,
  verseStatusSchema,
} from "@/lib/validation/verses";
import {
  clearFeaturedVerse,
  createVerse,
  deleteVerse,
  setFeaturedVerse,
  setVerseStatus,
  updateVerse,
} from "@/server/services/verses";
import {
  type ActionResult,
  formDataToObject,
  runAdminAction,
} from "./run-admin-action";

export async function createVerseAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAdminAction(
    {
      name: "verse.create",
      role: "ADMIN",
      schema: verseSchema,
      entityType: "BibleVerse",
      revalidate: ["public", "admin"],
      successMessage: "Verse created.",
      run: createVerse,
    },
    formDataToObject(formData),
  );
  if (result.ok && result.data?.id) {
    redirect(`/admin/verses/${result.data.id}?toast=created`);
  }
  return result;
}

export async function updateVerseAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    {
      name: "verse.update",
      role: "ADMIN",
      schema: updateVerseSchema,
      entityType: "BibleVerse",
      revalidate: ["public", "admin"],
      successMessage:
        formData.get("intent") === "publish"
          ? "Verse saved and published."
          : "Draft saved.",
      run: updateVerse,
    },
    formDataToObject(formData),
  );
}

export async function setVerseStatusAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    {
      name: "verse.status",
      role: "ADMIN",
      schema: verseStatusSchema,
      entityType: "BibleVerse",
      revalidate: ["public", "admin"],
      successMessage:
        formData.get("status") === "PUBLISHED"
          ? "Verse published."
          : "Verse unpublished.",
      run: setVerseStatus,
    },
    formDataToObject(formData),
  );
}

/** "Feature on…": moves the verse of the day for that UTC date. */
export async function setFeaturedVerseAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    {
      name: "verse.feature",
      role: "ADMIN",
      schema: featureVerseSchema,
      entityType: "BibleVerse",
      revalidate: ["public", "admin"],
      successMessage: "Verse of the day updated.",
      run: setFeaturedVerse,
    },
    formDataToObject(formData),
  );
}

export async function clearFeaturedVerseAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    {
      name: "verse.unfeature",
      role: "ADMIN",
      schema: byIdSchema,
      entityType: "BibleVerse",
      revalidate: ["public", "admin"],
      successMessage: "Verse is no longer featured.",
      run: clearFeaturedVerse,
    },
    formDataToObject(formData),
  );
}

export async function deleteVerseAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const result = await runAdminAction(
    {
      name: "verse.delete",
      role: "ADMIN",
      schema: byIdSchema,
      entityType: "BibleVerse",
      revalidate: ["public", "admin"],
      successMessage: "Verse deleted.",
      run: deleteVerse,
    },
    formDataToObject(formData),
  );
  if (result.ok) redirect("/admin/verses?toast=deleted");
  return result;
}
