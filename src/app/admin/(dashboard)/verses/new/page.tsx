import type { Metadata } from "next";
import { VerseEditor } from "@/components/admin/editors/VerseEditor";
import { PageHeader } from "@/components/admin/PageHeader";
import { requireAdminPage } from "@/server/auth/guards";

export const metadata: Metadata = { title: "New verse" };

export default async function NewVersePage() {
  await requireAdminPage("/admin/verses/new");
  return (
    <>
      <PageHeader title="New verse" />
      <VerseEditor />
    </>
  );
}
