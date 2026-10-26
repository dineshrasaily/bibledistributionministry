import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BilingualField } from "@/components/admin/BilingualField";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { EditorSection } from "@/components/admin/EditorSection";
import { FormShell } from "@/components/admin/FormShell";
import type { IdParams } from "@/components/admin/labels";
import { PageHeader } from "@/components/admin/PageHeader";
import { SlugField } from "@/components/admin/SlugField";
import { SubmitButton } from "@/components/admin/SubmitButton";
import {
  deleteCategoryAction,
  updateCategoryAction,
} from "@/server/actions/categories";
import { requireAdminPage } from "@/server/auth/guards";
import { getCategory } from "@/server/services/categories";

export const metadata: Metadata = { title: "Edit category" };

export default async function EditCategoryPage({
  params,
}: {
  params: IdParams;
}) {
  const { id } = await params;
  await requireAdminPage(`/admin/categories/${id}`);
  const category = await getCategory(id);
  if (!category) notFound();

  return (
    <>
      <PageHeader title={category.nameEn} description="Edit category" />
      <EditorSection title="Category">
        <FormShell action={updateCategoryAction} label="Edit category">
          <input type="hidden" name="id" value={category.id} />
          <BilingualField
            name="name"
            label="Name"
            required
            maxLength={60}
            defaultEn={category.nameEn}
            defaultNe={category.nameNe}
          />
          <SlugField sourceName="nameEn" defaultValue={category.slug} />
          <div>
            <SubmitButton>Save</SubmitButton>
          </div>
        </FormShell>
      </EditorSection>
      <div className="mt-8 flex justify-end">
        <ConfirmDialog
          action={deleteCategoryAction}
          fields={{ id: category.id }}
          triggerLabel="Delete category"
          title={`Delete "${category.nameEn}"?`}
        />
      </div>
    </>
  );
}
