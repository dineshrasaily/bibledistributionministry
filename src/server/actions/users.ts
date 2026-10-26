"use server";

import { byIdSchema } from "@/lib/validation/common";
import {
  createEditorSchema,
  setEditorPasswordSchema,
  setUserActiveSchema,
} from "@/lib/validation/users";
import {
  createEditor,
  resetEditorTotp,
  setEditorPassword,
  setUserActive,
} from "@/server/services/users";
import {
  type ActionResult,
  formDataToObject,
  runAdminAction,
} from "./run-admin-action";

/** OWNER only; the service enforces max 3 active editors. */
export async function createEditorAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return runAdminAction(
    {
      name: "user.create",
      role: "OWNER",
      schema: createEditorSchema,
      entityType: "AdminUser",
      revalidate: ["admin"],
      successMessage:
        "Editor added. Share the temporary password privately; they set up their authenticator at first sign-in.",
      run: createEditor,
    },
    formDataToObject(formData),
  );
}

/** `active` = "true" (reactivate) or "false" (deactivate). */
export async function setUserActiveAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    {
      name: "user.active",
      role: "OWNER",
      schema: setUserActiveSchema,
      entityType: "AdminUser",
      revalidate: ["admin"],
      successMessage:
        formData.get("active") === "true"
          ? "Editor reactivated."
          : "Editor deactivated.",
      run: setUserActive,
    },
    formDataToObject(formData),
  );
}

export async function resetEditorTotpAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    {
      name: "user.totp.reset",
      role: "OWNER",
      schema: byIdSchema,
      entityType: "AdminUser",
      revalidate: ["admin"],
      successMessage:
        "Two-step sign-in was reset. The editor sets it up again at next sign-in.",
      run: resetEditorTotp,
    },
    formDataToObject(formData),
  );
}

export async function setEditorPasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    {
      name: "user.password.set",
      role: "OWNER",
      schema: setEditorPasswordSchema,
      entityType: "AdminUser",
      revalidate: ["admin"],
      successMessage: "Temporary password set. The editor was signed out.",
      run: setEditorPassword,
    },
    formDataToObject(formData),
  );
}
