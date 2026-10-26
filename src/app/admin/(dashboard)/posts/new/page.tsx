import type { Metadata } from "next";
import { Suspense } from "react";
import { PostEditor } from "@/components/admin/editors/PostEditor";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormSkeleton } from "@/components/admin/Skeletons";
import { requireAdminPage } from "@/server/auth/guards";

export const metadata: Metadata = { title: "New post" };

export default async function NewPostPage() {
  await requireAdminPage("/admin/posts/new");
  return (
    <>
      <PageHeader
        title="New post"
        description="Fill in English first. Nepali fields are optional and fall back to English."
      />
      <Suspense fallback={<FormSkeleton />}>
        <PostEditor />
      </Suspense>
    </>
  );
}
