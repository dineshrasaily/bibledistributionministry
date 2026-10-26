import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailList } from "@/components/admin/DetailList";
import { EditorSection } from "@/components/admin/EditorSection";
import { InboxStatusForm } from "@/components/admin/InboxStatusForm";
import {
  formatDateTime,
  optionsOf,
  PRAYER_STATUS_LABELS,
  type IdParams,
} from "@/components/admin/labels";
import { PageHeader } from "@/components/admin/PageHeader";
import { ConsentBadge, PrivacyNotice } from "@/components/admin/PrivacyNotice";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { setPrayerStatusAction } from "@/server/actions/inbox";
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
      </div>
    </>
  );
}
