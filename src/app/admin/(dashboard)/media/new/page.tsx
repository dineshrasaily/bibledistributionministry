import type { Metadata } from "next";
import { MediaEditor } from "@/components/admin/editors/MediaEditor";
import { formatDate } from "@/components/admin/labels";
import { PageHeader } from "@/components/admin/PageHeader";
import { requireAdminPage } from "@/server/auth/guards";
import { listEventOptions } from "@/server/services/events";

export const metadata: Metadata = { title: "New media" };

export default async function NewMediaPage() {
  await requireAdminPage("/admin/media/new");
  const events = await listEventOptions();
  return (
    <>
      <PageHeader title="New media" />
      <MediaEditor
        events={events.map((e) => ({
          id: e.id,
          label: `${e.titleEn} (${formatDate(e.startsAt)})`,
        }))}
      />
    </>
  );
}
