import type { Metadata } from "next";
import { EventEditor } from "@/components/admin/editors/EventEditor";
import { PageHeader } from "@/components/admin/PageHeader";
import { requireAdminPage } from "@/server/auth/guards";

export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage() {
  await requireAdminPage("/admin/events/new");
  return (
    <>
      <PageHeader
        title="New event"
        description="Fill in English first. Nepali fields are optional and fall back to English."
      />
      <EventEditor />
    </>
  );
}
