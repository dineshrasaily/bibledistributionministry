import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { VerseEditor } from "@/components/admin/editors/VerseEditor";
import type { IdParams } from "@/components/admin/labels";
import { PageHeader } from "@/components/admin/PageHeader";
import { RecordMeta } from "@/components/admin/RecordMeta";
import { deleteVerseAction } from "@/server/actions/verses";
import { requireAdminPage } from "@/server/auth/guards";
import { getVerse } from "@/server/services/verses";

export const metadata: Metadata = { title: "Edit verse" };

export default async function EditVersePage({ params }: { params: IdParams }) {
  const { id } = await params;
  await requireAdminPage(`/admin/verses/${id}`);
  const verse = await getVerse(id);
  if (!verse) notFound();

  return (
    <>
      <PageHeader
        title={verse.reference}
        description={
          <RecordMeta status={verse.status} updatedAt={verse.updatedAt} />
        }
      />
      <VerseEditor verse={verse} />
      <div className="mt-8 flex justify-end">
        <ConfirmDialog
          action={deleteVerseAction}
          fields={{ id: verse.id }}
          triggerLabel="Delete verse"
          title={`Delete ${verse.reference}?`}
        />
      </div>
    </>
  );
}
