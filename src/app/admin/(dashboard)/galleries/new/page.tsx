import type { Metadata } from "next";
import { Suspense } from "react";
import { GalleryEditor } from "@/components/admin/editors/GalleryEditor";
import type { SearchParams } from "@/components/admin/labels";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormSkeleton } from "@/components/admin/Skeletons";
import { idSchema } from "@/lib/validation/common";
import { requireAdminPage } from "@/server/auth/guards";

export const metadata: Metadata = { title: "New gallery" };

export default async function NewGalleryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdminPage("/admin/galleries/new");
  const raw = (await searchParams).eventId;
  const parsed = idSchema.safeParse(Array.isArray(raw) ? raw[0] : raw);
  return (
    <>
      <PageHeader
        title="New gallery"
        description="Save the gallery first, then add pictures from the library or upload new ones."
      />
      <Suspense fallback={<FormSkeleton />}>
        <GalleryEditor defaultEventId={parsed.success ? parsed.data : null} />
      </Suspense>
    </>
  );
}
