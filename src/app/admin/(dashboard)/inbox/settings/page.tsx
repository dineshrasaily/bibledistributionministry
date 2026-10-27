import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { DetailList } from "@/components/admin/DetailList";
import { EditorSection } from "@/components/admin/EditorSection";
import { TextField } from "@/components/admin/fields";
import { FormShell } from "@/components/admin/FormShell";
import { formatDateTime } from "@/components/admin/labels";
import { PageHeader } from "@/components/admin/PageHeader";
import { PrivacyNotice } from "@/components/admin/PrivacyNotice";
import { FormSkeleton } from "@/components/admin/Skeletons";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { getFormServicesStatus } from "@/lib/form-services-status";
import { RETENTION_MAX, RETENTION_MIN } from "@/lib/retention";
import {
  purgeOldInboxAction,
  setInboxRetentionAction,
} from "@/server/actions/inbox";
import { requireOwnerPage } from "@/server/auth/guards";
import { previewPurge } from "@/server/services/inbox";

export const metadata: Metadata = { title: "Inbox settings" };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

async function InboxSettings() {
  const preview = await previewPurge();
  const status = getFormServicesStatus();
  const total = preview.prayer + preview.messages;
  const summary = `${plural(preview.prayer, "prayer request")} and ${plural(preview.messages, "message")}`;

  return (
    <div className="flex flex-col gap-6">
      <EditorSection title="Retention">
        <FormShell
          action={setInboxRetentionAction}
          label="Retention"
          className="gap-4"
        >
          <TextField
            name="inboxRetentionMonths"
            label="Keep prayer requests and messages for (months)"
            type="number"
            inputMode="numeric"
            min={RETENTION_MIN}
            max={RETENTION_MAX}
            step={1}
            defaultValue={preview.months}
            className="max-w-xs"
            hint={`From ${RETENTION_MIN} to ${RETENTION_MAX} months. Older items are deleted when you press "Delete old items" below.`}
            required
          />
          <div>
            <SubmitButton>Save retention</SubmitButton>
          </div>
        </FormShell>
      </EditorSection>

      <EditorSection title="Delete old items">
        <DetailList
          items={[
            {
              label: "Older than",
              value: formatDateTime(preview.cutoff),
            },
            {
              label: "Would delete",
              value: <span data-testid="purge-preview">{summary}</span>,
            },
            {
              label: "Last purge",
              value: preview.lastPurgeAt
                ? formatDateTime(preview.lastPurgeAt)
                : "Never",
            },
          ]}
        />
        <p className="text-sm text-navy/80">
          There is no automatic deletion. Purge regularly, for example once a
          month. Public versions of deleted items are removed too.
        </p>
        <div>
          <ConfirmDialog
            action={purgeOldInboxAction}
            fields={{ confirm: "purge" }}
            triggerLabel="Delete old items"
            title="Delete old inbox items?"
            description={
              total > 0
                ? `This permanently deletes ${summary} received before ${formatDateTime(preview.cutoff)}, and any public versions of them. This can't be undone.`
                : `Nothing is older than ${plural(preview.months, "month")} right now. Old spam-protection records are still cleaned up.`
            }
            confirmLabel="Delete old items"
          />
        </div>
      </EditorSection>

      <EditorSection title="Form services">
        <DetailList
          items={[
            {
              label: "Spam protection",
              value: (
                <span data-testid="turnstile-status">
                  {status.turnstile === "live"
                    ? "Cloudflare Turnstile (live keys)"
                    : "Cloudflare Turnstile (test keys – not configured)"}
                </span>
              ),
            },
            {
              label: "Email notifications",
              value: (
                <span data-testid="email-status">
                  {status.email === "configured"
                    ? "Resend configured"
                    : "Resend not configured (notices are logged)"}
                </span>
              ),
            },
          ]}
        />
        <p className="text-sm text-navy/80">
          Keys are set as environment variables in Vercel (see the README).
          Their values are never shown here.
        </p>
      </EditorSection>
    </div>
  );
}

export default async function InboxSettingsPage() {
  await requireOwnerPage("/admin/inbox/settings");
  return (
    <>
      <PageHeader
        title="Inbox settings"
        description="How long prayer requests and messages are kept, and the status of the form services."
      />
      <PrivacyNotice />
      <Suspense fallback={<FormSkeleton />}>
        <InboxSettings />
      </Suspense>
    </>
  );
}
