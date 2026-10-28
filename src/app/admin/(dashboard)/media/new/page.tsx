import type { Metadata } from "next";
import Link from "next/link";
import { MediaEditor } from "@/components/admin/editors/MediaEditor";
import { PageHeader } from "@/components/admin/PageHeader";
import { requireAdminPage } from "@/server/auth/guards";
import { getStorageMode } from "@/server/storage";

export const metadata: Metadata = { title: "Add a link" };

export default async function NewMediaPage() {
  await requireAdminPage("/admin/media/new");
  const mode = getStorageMode();
  return (
    <>
      <PageHeader
        title="Add a link"
        description={
          <>
            Paste a link to a picture, an audio file or a YouTube video.
            {mode !== "disabled" ? (
              <>
                {" "}
                To upload a file instead, use{" "}
                <Link
                  href="/admin/media#upload-files"
                  className="font-medium text-navy underline underline-offset-2"
                >
                  Upload files in the Media library
                </Link>
                .
              </>
            ) : null}
          </>
        }
      />
      <MediaEditor mode={mode} />
    </>
  );
}
