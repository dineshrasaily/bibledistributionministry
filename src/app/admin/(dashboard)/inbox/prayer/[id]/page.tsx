import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { DetailList } from "@/components/admin/DetailList";
import { EditorSection } from "@/components/admin/EditorSection";
import { InboxNoteForm } from "@/components/admin/InboxNoteForm";
import { InboxStatusForm } from "@/components/admin/InboxStatusForm";
import {
  formatDateTime,
  optionsOf,
  PRAYER_STATUS_LABELS,
  type IdParams,
} from "@/components/admin/labels";
import { PageHeader } from "@/components/admin/PageHeader";
import { ConsentBadge, PrivacyNotice } from "@/components/admin/PrivacyNotice";
import { PublishShareForm } from "@/components/admin/PublishShareForm";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { NO_CONSENT_MSG } from "@/lib/validation/inbox";
import {
  deletePrayerAction,
  publishPrayerAction,
  setPrayerNoteAction,
  setPrayerStatusAction,
  unpublishPrayerAction,
} from "@/server/actions/inbox";
import { requireAdminPage } from "@/server/auth/guards";
import { getPrayerRequest } from "@/server/services/inbox";

export const metadata: Metadata = { title: "Prayer request" };

export default async function PrayerRequestPage({
  params,
}: {
  params: IdParams;
}) {
  const { id } = await params;
  await requireAdminPage(`/admin/inbox/prayer/${id}`);
  const request = await getPrayerRequest(id);
  if (!request) notFound();
  const from =
    request.isAnonymous || !request.name ? "Anonymous" : request.name;

  return (
    <>
      <PageHeader
        title={`Prayer request from ${from}`}
        action={
          <Link
            href="/admin/inbox/prayer"
            className="text-sm text-navy underline underline-offset-2"
          >
            Back to prayer requests
          </Link>
        }
      />
      <PrivacyNotice />
      <div className="flex flex-col gap-6">
        <EditorSection title="Request">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={request.status} />
            <ConsentBadge consent={request.shareConsent} />
          </div>
          <DetailList
            items={[
              { label: "Received", value: formatDateTime(request.createdAt) },
              { label: "Name", value: from },
              {
                label: "Email",
                value: request.isAnonymous
                  ? "Hidden (anonymous)"
                  : (request.email ?? "—"),
              },
              { label: "Language", value: request.locale ?? "—" },
            ]}
          />
          <p
            lang={request.locale ?? undefined}
            data-testid="inbox-body"
            className="rounded-md bg-beige/40 p-4 whitespace-pre-wrap text-navy"
          >
            {request.body}
          </p>
        </EditorSection>
        <EditorSection title="Status">
          <InboxStatusForm
            action={setPrayerStatusAction}
            id={request.id}
            status={request.status}
            options={optionsOf(PRAYER_STATUS_LABELS)}
          />
        </EditorSection>
        <EditorSection title="Private note">
          <InboxNoteForm
            action={setPrayerNoteAction}
            id={request.id}
            note={request.adminNote}
          />
        </EditorSection>
        <EditorSection title="Public version">
          {request.shareConsent ? (
            <PublishShareForm
              publishAction={publishPrayerAction}
              unpublishAction={unpublishPrayerAction}
              id={request.id}
              share={request.publicShare}
              originalText={request.body}
              originalLocale={request.locale}
              kindLabel="prayer request"
            />
          ) : (
            <p
              role="note"
              data-testid="no-consent-note"
              className="rounded-md border border-beige bg-ivory px-4 py-3 text-navy"
            >
              {NO_CONSENT_MSG}
            </p>
          )}
        </EditorSection>
      </div>
      <div className="mt-8 flex justify-end">
        <ConfirmDialog
          action={deletePrayerAction}
          fields={{ id: request.id }}
          triggerLabel="Delete this prayer request"
          title="Delete this prayer request?"
          description="This permanently deletes the request and any public version. This can't be undone."
        />
      </div>
    </>
  );
}
