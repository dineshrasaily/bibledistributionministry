"use server";

import { redirect } from "next/navigation";
import { byIdSchema } from "@/lib/validation/common";
import {
  inboxNoteSchema,
  messageStatusSchema,
  prayerStatusSchema,
  publishShareSchema,
  purgeSchema,
  retentionSchema,
} from "@/lib/validation/inbox";
import {
  deleteContactMessage,
  deletePrayerRequest,
  publishPrayer,
  publishTestimony,
  purgeOldInbox,
  setMessageNote,
  setMessageStatus,
  setPrayerNote,
  setPrayerStatus,
  unpublishPrayer,
  unpublishTestimony,
} from "@/server/services/inbox";
import { updateInboxRetention } from "@/server/services/settings";
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

export async function setPrayerNoteAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    {
      name: "prayer.note",
      role: "ADMIN",
      schema: inboxNoteSchema,
      entityType: "PrayerRequest",
      revalidate: ["admin"],
      successMessage: "Note saved.",
      run: setPrayerNote,
    },
    formDataToObject(formData),
  );
}

export async function setMessageNoteAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    {
      name: "message.note",
      role: "ADMIN",
      schema: inboxNoteSchema,
      entityType: "ContactMessage",
      revalidate: ["admin"],
      successMessage: "Note saved.",
      run: setMessageNote,
    },
    formDataToObject(formData),
  );
}

export async function deletePrayerAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const result = await runAdminAction(
    {
      name: "prayer.delete",
      role: "ADMIN",
      schema: byIdSchema,
      entityType: "PrayerRequest",
      revalidate: ["public", "admin"],
      successMessage: "Prayer request deleted.",
      run: deletePrayerRequest,
    },
    formDataToObject(formData),
  );
  if (result.ok) redirect("/admin/inbox/prayer?toast=deleted");
  return result;
}

export async function deleteMessageAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const result = await runAdminAction(
    {
      name: "message.delete",
      role: "ADMIN",
      schema: byIdSchema,
      entityType: "ContactMessage",
      revalidate: ["public", "admin"],
      successMessage: "Message deleted.",
      run: deleteContactMessage,
    },
    formDataToObject(formData),
  );
  if (result.ok) redirect("/admin/inbox/messages?toast=deleted");
  return result;
}

export async function publishPrayerAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    {
      name: "prayer.publish",
      role: "ADMIN",
      schema: publishShareSchema,
      entityType: "PrayerRequest",
      revalidate: ["public", "admin"],
      successMessage: "Public version published.",
      run: publishPrayer,
    },
    formDataToObject(formData),
  );
}

export async function unpublishPrayerAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    {
      name: "prayer.unpublish",
      role: "ADMIN",
      schema: byIdSchema,
      entityType: "PrayerRequest",
      revalidate: ["public", "admin"],
      successMessage: "Public version removed.",
      run: unpublishPrayer,
    },
    formDataToObject(formData),
  );
}

export async function publishTestimonyAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    {
      name: "message.publish",
      role: "ADMIN",
      schema: publishShareSchema,
      entityType: "ContactMessage",
      revalidate: ["public", "admin"],
      successMessage: "Public version published.",
      run: publishTestimony,
    },
    formDataToObject(formData),
  );
}

export async function unpublishTestimonyAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    {
      name: "message.unpublish",
      role: "ADMIN",
      schema: byIdSchema,
      entityType: "ContactMessage",
      revalidate: ["public", "admin"],
      successMessage: "Public version removed.",
      run: unpublishTestimony,
    },
    formDataToObject(formData),
  );
}

/** OWNER only. */
export async function setInboxRetentionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    {
      name: "settings.retention",
      role: "OWNER",
      schema: retentionSchema,
      entityType: "SiteSettings",
      revalidate: ["admin"],
      successMessage: "Retention saved.",
      run: updateInboxRetention,
    },
    formDataToObject(formData),
  );
}

/** OWNER only: deletes inbox items older than the retention period. */
export async function purgeOldInboxAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const result = await runAdminAction(
    {
      name: "inbox.purge",
      role: "OWNER",
      schema: purgeSchema,
      entityType: "Inbox",
      revalidate: ["public", "admin"],
      successMessage: "Old items deleted.",
      run: purgeOldInbox,
    },
    formDataToObject(formData),
  );
  if (!result.ok) return result;
  const { prayerDeleted = 0, messagesDeleted = 0 } = result.data ?? {};
  return {
    ok: true,
    message: `Deleted ${prayerDeleted} prayer request${prayerDeleted === 1 ? "" : "s"} and ${messagesDeleted} message${messagesDeleted === 1 ? "" : "s"}.`,
  };
}
