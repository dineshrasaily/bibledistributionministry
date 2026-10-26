import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { PostEditor } from "@/components/admin/editors/PostEditor";
import { RecordMeta } from "@/components/admin/RecordMeta";
import type { IdParams } from "@/components/admin/labels";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormSkeleton } from "@/components/admin/Skeletons";
import { deletePostAction } from "@/server/actions/posts";
import { requireAdminPage } from "@/server/auth/guards";
import { getPost } from "@/server/services/posts";

export const metadata: Metadata = { title: "Edit post" };

export default async function EditPostPage({ params }: { params: IdParams }) {
  const { id } = await params;
  await requireAdminPage(`/admin/posts/${id}`);
  const post = await getPost(id);
  if (!post) notFound();

  return (
    <>
      <PageHeader
        title={post.titleEn}
        description={
          <RecordMeta status={post.status} updatedAt={post.updatedAt} />
        }
      />
      <Suspense fallback={<FormSkeleton />}>
        <PostEditor post={post} />
      </Suspense>
      <div className="mt-8 flex justify-end">
        <ConfirmDialog
          action={deletePostAction}
          fields={{ id: post.id }}
          triggerLabel="Delete post"
          title={`Delete "${post.titleEn}"?`}
        />
      </div>
    </>
  );
}
