import type { Metadata } from "next";
import { Suspense } from "react";
import { BilingualField } from "@/components/admin/BilingualField";
import { EditorSection } from "@/components/admin/EditorSection";
import { CheckboxField, TextField } from "@/components/admin/fields";
import { FormShell } from "@/components/admin/FormShell";
import { formatDateTime } from "@/components/admin/labels";
import { MarkdownEditor } from "@/components/admin/MarkdownEditor";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormSkeleton } from "@/components/admin/Skeletons";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { UPLOAD_HINT } from "@/components/admin/UploadHint";
import { SOCIAL_PLATFORMS, type SocialPlatform } from "@/config/social";
import { updateSiteSettingsAction } from "@/server/actions/settings";
import { requireOwnerPage } from "@/server/auth/guards";
import { getSettingsForEdit, socialUrlsOf } from "@/server/services/settings";

export const metadata: Metadata = { title: "Site settings" };

const PLATFORMS = Object.entries(SOCIAL_PLATFORMS) as [
  SocialPlatform,
  string,
][];

async function SettingsForm() {
  const s = await getSettingsForEdit();
  const social = socialUrlsOf(s);

  return (
    <FormShell action={updateSiteSettingsAction} label="Site settings">
      <p className="text-sm text-navy/75">
        Last saved {formatDateTime(s.updatedAt)}
      </p>

      <EditorSection title="Identity">
        <TextField
          name="ministryName"
          label="Ministry name"
          defaultValue={s.ministryName}
          maxLength={80}
          hint="Shown in the site header, footer and browser tab."
          required
        />
        {/* TODO(Phase 7): replace with a logo upload. */}
        <TextField
          name="logoUrl"
          label="Logo image link (optional)"
          type="url"
          inputMode="url"
          defaultValue={s.logoUrl ?? ""}
          placeholder="https://"
          hint={UPLOAD_HINT}
        />
        <TextField
          name="contactEmail"
          label="Contact email"
          type="email"
          defaultValue={s.contactEmail}
          required
        />
        <CheckboxField
          name="isDemo"
          label="Demo site (shows demo badges and the demo banner)"
          defaultChecked={s.isDemo}
          hint='The footer copyright still says "Demonstration site." until the About content is written.'
        />
      </EditorSection>

      <EditorSection title="Social links">
        <p className="text-sm text-navy/80">
          Leave empty to hide. While all are empty the footer shows
          placeholders.
        </p>
        <div className="grid gap-5 md:grid-cols-2">
          {PLATFORMS.map(([platform, label]) => (
            <TextField
              key={platform}
              name={`social.${platform}`}
              label={label}
              type="url"
              inputMode="url"
              placeholder="https://"
              defaultValue={social[platform] ?? ""}
            />
          ))}
        </div>
      </EditorSection>

      <EditorSection title="Messages">
        <BilingualField
          name="tagline"
          label="Tagline"
          maxLength={120}
          defaultEn={s.taglineEn}
          defaultNe={s.taglineNe}
          hint="The small line above the ministry name on the home page."
        />
        <BilingualField
          name="missionStatement"
          label="Mission statement"
          multiline
          rows={3}
          maxLength={600}
          defaultEn={s.missionStatementEn}
          defaultNe={s.missionStatementNe}
        />
        <BilingualField
          name="aboutIntro"
          label="About introduction"
          multiline
          rows={5}
          maxLength={3000}
          defaultEn={s.aboutIntroEn}
          defaultNe={s.aboutIntroNe}
          hint="Separate paragraphs with an empty line."
        />
        <MarkdownEditor
          name="visionEn"
          label="Vision (English)"
          lang="en"
          rows={5}
          defaultValue={s.visionEn}
        />
        <MarkdownEditor
          name="visionNe"
          label="Vision (नेपाली, Nepali)"
          lang="ne"
          rows={5}
          defaultValue={s.visionNe}
          hint="Leave empty to show the English text."
        />
        <MarkdownEditor
          name="valuesEn"
          label="Values (English)"
          lang="en"
          rows={5}
          defaultValue={s.valuesEn}
        />
        <MarkdownEditor
          name="valuesNe"
          label="Values (नेपाली, Nepali)"
          lang="ne"
          rows={5}
          defaultValue={s.valuesNe}
          hint="Leave empty to show the English text."
        />
        <MarkdownEditor
          name="statementOfFaithEn"
          label="Statement of faith (English)"
          lang="en"
          rows={5}
          defaultValue={s.statementOfFaithEn}
        />
        <MarkdownEditor
          name="statementOfFaithNe"
          label="Statement of faith (नेपाली, Nepali)"
          lang="ne"
          rows={5}
          defaultValue={s.statementOfFaithNe}
          hint="Leave empty to show the English text."
        />
      </EditorSection>

      <EditorSection title="Donations">
        <CheckboxField
          name="donationsEnabled"
          label="Donations are enabled"
          defaultChecked={s.donationsEnabled}
          hint="Online giving (in USD) arrives in a later update."
        />
        <CheckboxField
          name="taxDeductibleVerified"
          label="Donation tax status has been verified"
          defaultChecked={s.taxDeductibleVerified}
        />
        <div
          role="note"
          className="rounded-lg border border-gold-dark bg-beige/40 px-4 py-3 text-sm text-navy"
        >
          <p>
            <span className="font-semibold">Important: </span>
            Only check this after a qualified professional has confirmed the
            ministry&apos;s legal eligibility. The public site makes no tax
            claims either way.
          </p>
        </div>
      </EditorSection>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-beige bg-ivory/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <SubmitButton variant="gold">Save settings</SubmitButton>
      </div>
    </FormShell>
  );
}

export default async function SettingsPage() {
  await requireOwnerPage("/admin/settings");
  return (
    <>
      <PageHeader
        title="Site settings"
        description="Ministry details, social links and the text on the home page. Changes show on the public site right away."
      />
      <Suspense fallback={<FormSkeleton />}>
        <SettingsForm />
      </Suspense>
    </>
  );
}
