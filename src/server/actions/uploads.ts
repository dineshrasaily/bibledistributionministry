"use server";

import { registerUploadSchema } from "@/lib/validation/uploads";
import {
  createUploadedMedia,
  prepareUpload,
  type UploadedMedia,
} from "@/server/services/uploads";
import {
  type ActionResult,
  formDataToObject,
  runAdminAction,
} from "./run-admin-action";

/**
 * Registers a file the browser already uploaded (local route or Vercel Blob
 * client upload) as a MediaItem, after re-inspecting it server-side.
 */
export async function registerUploadAction(
  _prev: ActionResult<UploadedMedia> | null,
  formData: FormData,
): Promise<ActionResult<UploadedMedia>> {
  return runAdminAction(
    {
      name: "media.upload",
      role: "ADMIN",
      schema: registerUploadSchema,
      entityType: "MediaItem",
      revalidate: ["admin", "public"],
      successMessage: "File uploaded.",
      prepare: prepareUpload,
      run: createUploadedMedia,
    },
    formDataToObject(formData),
  );
}
