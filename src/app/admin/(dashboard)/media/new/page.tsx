import type { Metadata } from "next";
import { MediaEditor } from "@/components/admin/editors/MediaEditor";
import { PageHeader } from "@/components/admin/PageHeader";
import { requireAdminPage } from "@/server/auth/guards";

export const metadata: Metadata = { title: "New media" };

export default async function NewMediaPage() {
  await requireAdminPage("/admin/media/new");
  return (
    <>
      <PageHeader title="New media" />
      <MediaEditor />
    </>
  );
}
