import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { CheckboxField, TextAreaField } from "./fields";
import { FormShell, type FormAction } from "./FormShell";
import { InlineAction } from "./InlineAction";
import { formatDateTime } from "./labels";
import { SubmitButton } from "./SubmitButton";

export type PublishedShare = {
  id: string;
  textEn: string | null;
  textNe: string | null;
  publishedAt: Date;
};

/**
 * Publish an admin-edited public version of a consented prayer request or
 * testimony. Only rendered when consent exists; the server enforces it too.
 */
export function PublishShareForm({
  publishAction,
  unpublishAction,
  id,
  share,
  originalText,
  originalLocale,
  kindLabel,
}: {
  publishAction: FormAction;
  unpublishAction: FormAction;
  id: string;
  share: PublishedShare | null;
  /** Prefill for a first publish (the admin must edit out personal details). */
  originalText: string;
  originalLocale: string | null;
  kindLabel: "prayer request" | "testimony";
}) {
  const isNe = originalLocale === "ne";
  const defaultEn = share ? (share.textEn ?? "") : isNe ? "" : originalText;
  const defaultNe = share ? (share.textNe ?? "") : isNe ? originalText : "";

  return (
    <div className="flex flex-col gap-5">
      {share ? (
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="navy">
            Published {formatDateTime(share.publishedAt)}
          </Badge>
          <Link
            href={`/en/prayer#share-${share.id}`}
            className="text-sm text-navy underline underline-offset-2"
          >
            View on the prayer page
          </Link>
          <InlineAction
            action={unpublishAction}
            fields={{ id }}
            label="Unpublish"
            accessibleLabel={`Unpublish the public version of this ${kindLabel}`}
          />
        </div>
      ) : null}
      <div
        role="note"
        className="rounded-lg border border-gold-dark bg-beige/40 px-4 py-3 text-sm text-navy"
      >
        <p>
          <span className="font-semibold">Before publishing: </span>
          The sender agreed that this {kindLabel} may be shared. Rewrite it as a
          short public version: remove names, places, contact details and
          anything else that could identify the person. Only this text is shown
          on the prayer page; the original stays private.
        </p>
      </div>
      <FormShell
        action={publishAction}
        label="Public version"
        className="gap-5"
      >
        <input type="hidden" name="id" value={id} />
        <TextAreaField
          name="textEn"
          label="Public text (English)"
          lang="en"
          rows={5}
          maxLength={1500}
          defaultValue={defaultEn}
        />
        <TextAreaField
          name="textNe"
          label="Public text (नेपाली, Nepali)"
          lang="ne"
          rows={5}
          maxLength={1500}
          defaultValue={defaultNe}
          hint="Optional. Fill in English, Nepali or both. Each language falls back to the other."
        />
        <CheckboxField
          name="confirmNoPersonalInfo"
          label="I removed names, contact details and anything that identifies the person."
        />
        <div>
          <SubmitButton variant="gold">
            {share ? "Update public version" : "Publish public version"}
          </SubmitButton>
        </div>
      </FormShell>
    </div>
  );
}
