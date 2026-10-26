import type { Metadata } from "next";
import { Suspense } from "react";
import { BilingualField } from "@/components/admin/BilingualField";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { EditorSection } from "@/components/admin/EditorSection";
import { FormShell } from "@/components/admin/FormShell";
import type { SearchParams } from "@/components/admin/labels";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { RecordList } from "@/components/admin/RecordList";
import { ListSkeleton } from "@/components/admin/Skeletons";
import { SlugField } from "@/components/admin/SlugField";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { parseListQuery, type ListQuery } from "@/lib/validation/list-query";
import {
  createCategoryAction,
  deleteCategoryAction,
} from "@/server/actions/categories";
import { requireAdminPage } from "@/server/auth/guards";
import { listCategories } from "@/server/services/categories";

export const metadata: Metadata = { title: "Categories" };

async function CategoryList({ query }: { query: ListQuery }) {
  const page = await listCategories(query);
  if (page.total === 0) {
    return (
      <EmptyState
        title={query.q ? "No matching categories" : "No categories yet"}
        description="Categories group posts by topic, for example Prayer or Missions."
      />
    );
  }
  return (
    <>
      <RecordList
        label="Categories"
        rows={page.items.map((c) => ({
          id: c.id,
          title: c.nameEn,
          href: `/admin/categories/${c.id}`,
          meta: `${c.slug} · ${c._count.posts} ${c._count.posts === 1 ? "post" : "posts"}`,
          actions: (
            <ConfirmDialog
              action={deleteCategoryAction}
              fields={{ id: c.id }}
              triggerLabel="Delete"
              title={`Delete "${c.nameEn}"?`}
              description="Posts keep existing but lose this category. This can't be undone."
            />
          ),
        }))}
      />
      <Pagination
        path="/admin/categories"
        query={{ q: query.q }}
        page={page.page}
        pageCount={page.pageCount}
      />
    </>
  );
}

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdminPage("/admin/categories");
  const query = parseListQuery(await searchParams);
  return (
    <>
      <PageHeader
        title="Categories"
        description="Topics you can attach to posts."
      />
      <div className="mb-8">
        <EditorSection title="Add a category">
          <FormShell
            action={createCategoryAction}
            resetOnSuccess
            label="Add a category"
          >
            <BilingualField name="name" label="Name" required maxLength={60} />
            <SlugField sourceName="nameEn" />
            <div>
              <SubmitButton>Add category</SubmitButton>
            </div>
          </FormShell>
        </EditorSection>
      </div>
      <ListToolbar action="/admin/categories" q={query.q} />
      <Suspense key={JSON.stringify(query)} fallback={<ListSkeleton />}>
        <CategoryList query={query} />
      </Suspense>
    </>
  );
}
