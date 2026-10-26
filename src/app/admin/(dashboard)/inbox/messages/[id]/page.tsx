import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailList } from "@/components/admin/DetailList";
import { EditorSection } from "@/components/admin/EditorSection";
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
import { StatusBadge } from "@/components/admin/StatusBadge";
import { setMessageStatusAction } from "@/server/actions/inbox";
import { requireAdminPage } from "@/server/auth/guards";
import { getContactMessage } from "@/server/services/inbox";

export const metadata: Metadata = { title: "Message" };

export default async function MessagePage({ params }: { params: IdParams }) {
  const { id } = await params;
  await requireAdminPage(`/admin/inbox/messages/${id}`);
  const message = await getContactMessage(id);
  if (!message) notFound();

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
      </div>
    </>
  );
}
