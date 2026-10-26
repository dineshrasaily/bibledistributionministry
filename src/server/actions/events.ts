"use server";

import { redirect } from "next/navigation";
import { byIdSchema } from "@/lib/validation/common";
import {
  eventPublishSchema,
  eventSchema,
  updateEventSchema,
} from "@/lib/validation/events";
import {
  createEvent,
  deleteEvent,
  setEventPublishStatus,
  updateEvent,
} from "@/server/services/events";
import {
  type ActionResult,
  formDataToObject,
  runAdminAction,
} from "./run-admin-action";

export async function createEventAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAdminAction(
    {
      name: "event.create",
      role: "ADMIN",
      schema: eventSchema,
      entityType: "Event",
      revalidate: ["public", "admin"],
      successMessage: "Event created.",
      run: createEvent,
    },
    formDataToObject(formData),
  );
  if (result.ok && result.data?.id) {
    redirect(`/admin/events/${result.data.id}?toast=created`);
  }
  return result;
}

export async function updateEventAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    {
      name: "event.update",
      role: "ADMIN",
      schema: updateEventSchema,
      entityType: "Event",
      revalidate: ["public", "admin"],
      successMessage:
        formData.get("intent") === "publish"
          ? "Event saved and published."
          : "Draft saved.",
      run: updateEvent,
    },
    formDataToObject(formData),
  );
}

/** Publish / unpublish (visibility); `status` is a ContentStatus. */
export async function setEventStatusAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    {
      name: "event.status",
      role: "ADMIN",
      schema: eventPublishSchema,
      entityType: "Event",
      revalidate: ["public", "admin"],
      successMessage:
        formData.get("status") === "PUBLISHED"
          ? "Event published."
          : "Event unpublished.",
      run: setEventPublishStatus,
    },
    formDataToObject(formData),
  );
}

export async function deleteEventAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const result = await runAdminAction(
    {
      name: "event.delete",
      role: "ADMIN",
      schema: byIdSchema,
      entityType: "Event",
      revalidate: ["public", "admin"],
      successMessage: "Event deleted.",
      run: deleteEvent,
    },
    formDataToObject(formData),
  );
  if (result.ok) redirect("/admin/events?toast=deleted");
  return result;
}
