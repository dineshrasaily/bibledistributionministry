"use server";

import { settingsSchema } from "@/lib/validation/settings";
import { updateSiteSettings } from "@/server/services/settings";
import {
  type ActionResult,
  formDataToObject,
  runAdminAction,
} from "./run-admin-action";

/** OWNER only. */
export async function updateSiteSettingsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    {
      name: "settings.update",
      role: "OWNER",
      schema: settingsSchema,
      entityType: "SiteSettings",
      revalidate: ["public", "admin"],
      successMessage: "Settings saved.",
      run: updateSiteSettings,
    },
    formDataToObject(formData),
  );
}
