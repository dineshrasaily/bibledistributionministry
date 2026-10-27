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
  MESSAGE_KIND_LABELS,
  MESSAGE_STATUS_LABELS,
  optionsOf,
  type IdParams,
} from "@/components/admin/labels";
import { PageHeader } from "@/components/admin/PageHeader";
import { ConsentBadge, PrivacyNotice } from "@/components/admin/PrivacyNotice";
import { PublishShareForm } from "@/components/admin/PublishShareForm";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { NO_CONSENT_MSG, NOT_TESTIMONY_MSG } from "@/lib/validation/inbox";
import {
  deleteMessageAction,
  publishTestimonyAction,
  setMessageNoteAction,
  setMessageStatusAction,
  unpublishTestimonyAction,
} from "@/server/actions/inbox";
import { requireAdminPage } from "@/server/auth/guards";
import { getContactMessage } from "@/server/services/inbox";

export const metadata: Metadata = { title: "Message" };

export default async function MessagePage({ params }: { params: IdParams }) {
  const { id } = await params;
  await requireAdminPage(`/admin/inbox/messages/${id}`);
  const message = await getContactMessage(id);
  if (!message) notFound();
  const canPublish = message.kind === "TESTIMONY" && message.shareConsent;

  return (
    <>
      <PageHeader
        title={message.subject}
        action={
          <Link
            href="/admin/inbox/messages"
            className="text-sm text-navy underline underline-offset-2"
          >
            Back to messages
          </Link>
        }
      />
      <PrivacyNotice />
      <div className="flex flex-col gap-6">
        <EditorSection title="Message">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={message.status} />
            <ConsentBadge consent={message.shareConsent} />
          </div>
          <DetailList
            items={[
              { label: "Received", value: formatDateTime(message.createdAt) },
              { label: "From", value: message.name },
              { label: "Email", value: message.email },
              { label: "Kind", value: MESSAGE_KIND_LABELS[message.kind] },
              { label: "Language", value: message.locale ?? "—" },
            ]}
          />
          <p
            lang={message.locale ?? undefined}
            data-testid="inbox-body"
            className="rounded-md bg-beige/40 p-4 whitespace-pre-wrap text-navy"
          >
            {message.body}
          </p>
        </EditorSection>
        <EditorSection title="Status">
          <InboxStatusForm
            action={setMessageStatusAction}
            id={message.id}
            status={message.status}
            options={optionsOf(MESSAGE_STATUS_LABELS)}
          />
        </EditorSection>
        <EditorSection title="Private note">
          <InboxNoteForm
            action={setMessageNoteAction}
            id={message.id}
            note={message.adminNote}
          />
        </EditorSection>
        <EditorSection title="Public version">
          {canPublish ? (
            <PublishShareForm
              publishAction={publishTestimonyAction}
              unpublishAction={unpublishTestimonyAction}
              id={message.id}
              share={message.publicShare}
              originalText={message.body}
              originalLocale={message.locale}
              kindLabel="testimony"
            />
          ) : (
            <p
              role="note"
              data-testid="no-consent-note"
              className="rounded-md border border-beige bg-ivory px-4 py-3 text-navy"
            >
              {message.kind === "TESTIMONY"
                ? NO_CONSENT_MSG
                : NOT_TESTIMONY_MSG}
            </p>
          )}
        </EditorSection>
      </div>
      <div className="mt-8 flex justify-end">
        <ConfirmDialog
          action={deleteMessageAction}
          fields={{ id: message.id }}
          triggerLabel="Delete this message"
          title="Delete this message?"
          description="This permanently deletes the message and any public version. This can't be undone."
        />
      </div>
    </>
  );
}
