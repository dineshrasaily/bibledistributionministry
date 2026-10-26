"use client";

import { Button } from "@/components/ui/Button";
import { useFormPending } from "./FormShell";

const UNPUBLISH_HINT_ID = "unpublish-hint";

/**
 * Sticky save bar. New/DRAFT: "Save draft" + "Publish". PUBLISHED: "Update"
 * (stays live) + "Unpublish". A published record never shows "Save draft".
 */
export function PublishControls({
  status,
}: {
  /** null for a record that doesn't exist yet. */
  status: "DRAFT" | "PUBLISHED" | null;
}) {
  const pending = useFormPending();
  const published = status === "PUBLISHED";

  return (
    <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 border-t border-beige bg-ivory/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
      <div className="flex flex-wrap items-center gap-3">
        {published ? (
          <>
            <Button
              type="submit"
              name="intent"
              value="publish"
              variant="gold"
              disabled={pending}
            >
              {pending ? "Saving…" : "Update"}
            </Button>
            <Button
              type="submit"
              name="intent"
              value="draft"
              variant="secondary"
              disabled={pending}
              aria-describedby={UNPUBLISH_HINT_ID}
            >
              Unpublish
            </Button>
          </>
        ) : (
          <>
            <Button
              type="submit"
              name="intent"
              value="draft"
              variant="secondary"
              disabled={pending}
            >
              {pending ? "Saving…" : "Save draft"}
            </Button>
            <Button
              type="submit"
              name="intent"
              value="publish"
              variant="gold"
              disabled={pending}
            >
              Publish
            </Button>
          </>
        )}
      </div>
      {published ? (
        <p id={UNPUBLISH_HINT_ID} className="text-sm text-navy/75">
          Unpublish removes it from the public site
        </p>
      ) : null}
    </div>
  );
}
