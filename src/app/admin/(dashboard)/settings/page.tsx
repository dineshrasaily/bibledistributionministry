import type { Metadata } from "next";
import { Suspense } from "react";
import { BilingualField } from "@/components/admin/BilingualField";
import { EditorSection } from "@/components/admin/EditorSection";
import {
  CheckboxField,
  TextAreaField,
  TextField,
} from "@/components/admin/fields";
import { FormShell } from "@/components/admin/FormShell";
import { formatDateTime } from "@/components/admin/labels";
import { MarkdownEditor } from "@/components/admin/MarkdownEditor";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormSkeleton } from "@/components/admin/Skeletons";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { IMAGE_FIELD_HINT } from "@/components/admin/UploadHint";
import { MediaPickerField } from "@/components/admin/MediaPickerField";
import { getStorageMode } from "@/server/storage";
import { SOCIAL_PLATFORMS, type SocialPlatform } from "@/config/social";
import { updateSiteSettingsAction } from "@/server/actions/settings";
import { requireOwnerPage } from "@/server/auth/guards";
import { getSettingsForEdit, socialUrlsOf } from "@/server/services/settings";

export const metadata: Metadata = { title: "Site settings" };

const ABOUT_HINT =
  "Empty sections are hidden on the public site (sample text is shown while Demo site is on).";

const PLATFORMS = Object.entries(SOCIAL_PLATFORMS) as [
  SocialPlatform,
  string,
][];

async function SettingsForm() {
  const s = await getSettingsForEdit();
  const social = socialUrlsOf(s);
  const mode = getStorageMode();

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
        <MediaPickerField
          name="logoUrl"
          label="Logo picture (optional)"
          defaultValue={s.logoUrl}
          hint={`${IMAGE_FIELD_HINT} A transparent PNG works best.`}
          mode={mode}
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
          hint='While this is on, the footer copyright says "Demonstration site." and empty About sections show sample text.'
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

      <EditorSection title="Home page">
        <BilingualField
          name="tagline"
          label="Tagline"
          maxLength={120}
          defaultEn={s.taglineEn}
          defaultNe={s.taglineNe}
          hint="The small line above the ministry name on the home page. Also shown under the About page title."
        />
        <BilingualField
          name="missionStatement"
          label="Mission statement"
          multiline
          rows={3}
          maxLength={600}
          defaultEn={s.missionStatementEn}
          defaultNe={s.missionStatementNe}
          hint="Shown on the home page and as a large quote on the About page."
        />
      </EditorSection>

      <EditorSection title="About page">
        <p className="text-sm text-navy/80">{ABOUT_HINT}</p>
        <BilingualField
          name="aboutIntro"
          label="About introduction / our story"
          multiline
          rows={5}
          maxLength={3000}
          defaultEn={s.aboutIntroEn}
          defaultNe={s.aboutIntroNe}
          hint="Shown on the home page and in the About page story section. Separate paragraphs with an empty line."
        />
        <MediaPickerField
          name="aboutImageUrl"
          label="Your photo (optional, shown on the Home and About pages)"
          defaultValue={s.aboutImageUrl}
          hint={`${IMAGE_FIELD_HINT} Choosing a library picture fills an empty photo description below.`}
          mode={mode}
          altFields={{ en: "aboutImageAltEn", ne: "aboutImageAltNe" }}
        />
        <BilingualField
          name="aboutImageAlt"
          label="Photo description"
          maxLength={300}
          defaultEn={s.aboutImageAltEn}
          defaultNe={s.aboutImageAltNe}
          hint="Required when a photo is set: describe the photo for people who can't see it."
        />
        <MarkdownEditor
          name="testimonyEn"
          label="Testimony / faith journey (English)"
          lang="en"
          rows={6}
          defaultValue={s.testimonyEn}
        />
        <MarkdownEditor
          name="testimonyNe"
          label="Testimony / faith journey (नेपाली, Nepali)"
          lang="ne"
          rows={6}
          defaultValue={s.testimonyNe}
          hint="Leave empty to show the English text."
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
        <MarkdownEditor
          name="goalsEn"
          label="Goals and outreach (English)"
          lang="en"
          rows={5}
          defaultValue={s.goalsEn}
        />
        <MarkdownEditor
          name="goalsNe"
          label="Goals and outreach (नेपाली, Nepali)"
          lang="ne"
          rows={5}
          defaultValue={s.goalsNe}
          hint="Leave empty to show the English text."
        />
      </EditorSection>

      <EditorSection title="Donations">
        <CheckboxField
          name="donationsEnabled"
          label="Donations are enabled"
          defaultChecked={s.donationsEnabled}
          hint="Shows the giving form on the Support page. Online giving also needs the Stripe keys (see Donations)."
        />
        <MarkdownEditor
          name="givingInfoEn"
          label="How gifts are used (English)"
          lang="en"
          rows={5}
          defaultValue={s.givingInfoEn}
          hint="Shown on the Support page. Leave empty to show the sample text."
        />
        <MarkdownEditor
          name="givingInfoNe"
          label="How gifts are used (नेपाली, Nepali)"
          lang="ne"
          rows={5}
          defaultValue={s.givingInfoNe}
          hint="Leave empty to show the English text."
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
            ministry&apos;s legal eligibility. Until it is checked, the Support
            page and the Terms say gifts are not deductible for tax. After it is
            checked they only say gifts may be, and to ask a tax advisor.
          </p>
        </div>
      </EditorSection>

      <EditorSection title="Zelle and bank transfer">
        <p className="text-sm text-navy/80">
          Let donors give straight from their bank. The section shows on the
          Support page only when it&apos;s turned on and at least one Zelle or
          bank detail is filled in.
        </p>
        <CheckboxField
          name="offlineGivingEnabled"
          label="Show Zelle and bank transfer on the Support page"
          defaultChecked={s.offlineGivingEnabled}
          hint="Turn this off to hide the whole section. Your details stay saved."
        />

        <h3 className="font-serif text-lg font-semibold text-navy">Zelle</h3>
        <TextField
          name="zelleRecipientName"
          label="Zelle recipient name"
          defaultValue={s.zelleRecipientName ?? ""}
          maxLength={100}
          hint="Exactly as your bank app shows it to people who send you money. Donors are asked to check this name before sending."
        />
        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            name="zelleEmail"
            label="Zelle email (optional)"
            type="email"
            defaultValue={s.zelleEmail ?? ""}
            maxLength={254}
          />
          <TextField
            name="zellePhone"
            label="Zelle phone (optional)"
            type="tel"
            inputMode="tel"
            defaultValue={s.zellePhone ?? ""}
            maxLength={20}
            hint="US number, for example (555) 123-4567."
          />
        </div>
        <MediaPickerField
          name="zelleQrUrl"
          label="Zelle QR code picture (optional)"
          defaultValue={s.zelleQrUrl}
          hint={`${IMAGE_FIELD_HINT} In your bank app, open Zelle, find "My QR code", save it as a picture and upload it here.`}
          mode={mode}
          altFields={{ en: "zelleQrAltEn", ne: "zelleQrAltNe" }}
        />
        <BilingualField
          name="zelleQrAlt"
          label="QR code description"
          maxLength={300}
          defaultEn={s.zelleQrAltEn}
          defaultNe={s.zelleQrAltNe}
          hint='Leave empty to use "Zelle QR code for <recipient name>".'
        />

        <h3 className="font-serif text-lg font-semibold text-navy">
          Bank transfer
        </h3>
        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            name="bankName"
            label="Bank name"
            defaultValue={s.bankName ?? ""}
            maxLength={100}
          />
          <TextField
            name="bankAccountName"
            label="Account holder name"
            defaultValue={s.bankAccountName ?? ""}
            maxLength={100}
          />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            name="bankAccountNumber"
            label="Account number"
            inputMode="numeric"
            autoComplete="off"
            defaultValue={s.bankAccountNumber ?? ""}
            maxLength={40}
          />
          <TextField
            name="bankRoutingNumber"
            label="Routing number (ABA, 9 digits)"
            inputMode="numeric"
            autoComplete="off"
            defaultValue={s.bankRoutingNumber ?? ""}
            maxLength={40}
          />
        </div>
        <TextField
          name="bankSwiftCode"
          label="SWIFT/BIC code (optional, for gifts from outside the US)"
          autoComplete="off"
          defaultValue={s.bankSwiftCode ?? ""}
          maxLength={20}
        />
        <TextAreaField
          name="bankAddress"
          label="Bank address (optional)"
          rows={3}
          maxLength={300}
          defaultValue={s.bankAddress ?? ""}
          hint="Usually only needed for international transfers."
        />
        <div
          role="note"
          id="bank-details-warning"
          className="rounded-lg border-2 border-gold-dark bg-beige/60 px-4 py-3 text-sm text-navy"
        >
          <p>
            <span className="font-semibold">Warning: </span>
            Anyone can see your full account and routing numbers when this is
            on, and they can be misused for check or ACH fraud. Leave it off and
            donors will see &apos;Contact us for bank transfer details&apos;
            instead, or use Zelle.
          </p>
        </div>
        <CheckboxField
          name="bankShowAccountDetails"
          label="Show the account, routing and SWIFT numbers on the Support page"
          defaultChecked={s.bankShowAccountDetails}
          hint="Off is safer. Read the warning above before turning this on."
          aria-describedby="bank-details-warning f-bankShowAccountDetails-hint"
        />
        <BilingualField
          name="offlineGivingNote"
          label="Note for donors"
          multiline
          rows={3}
          maxLength={500}
          defaultEn={s.offlineGivingNoteEn}
          defaultNe={s.offlineGivingNoteNe}
          hint="Optional. For example: Please write 'Bibles' in the memo."
        />
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
