"use server";

import {
  messageStatusSchema,
  prayerStatusSchema,
} from "@/lib/validation/inbox";
import { setMessageStatus, setPrayerStatus } from "@/server/services/inbox";
import {
  type ActionResult,
  formDataToObject,
  runAdminAction,
} from "./run-admin-action";

export async function setPrayerStatusAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    {
      name: "prayer.status",
      role: "ADMIN",
      schema: prayerStatusSchema,
      entityType: "PrayerRequest",
      revalidate: ["admin"],
      successMessage: "Status updated.",
      run: setPrayerStatus,
    },
    formDataToObject(formData),
  );
}

export async function setMessageStatusAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    {
      name: "message.status",
      role: "ADMIN",
      schema: messageStatusSchema,
      entityType: "ContactMessage",
      revalidate: ["admin"],
      successMessage: "Status updated.",
      run: setMessageStatus,
    },
    formDataToObject(formData),
  );
}
