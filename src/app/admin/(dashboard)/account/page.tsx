import type { Metadata } from "next";
import { FormShell } from "@/components/admin/FormShell";
import { PageHeader } from "@/components/admin/PageHeader";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { TextField } from "@/components/admin/fields";
import { Card, CardBody } from "@/components/ui/Card";
import { changePasswordAction } from "@/server/actions/account";
import { requireAdminPage } from "@/server/auth/guards";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const actor = await requireAdminPage("/admin/account");
  return (
    <>
      <PageHeader
        title="Account"
        description={`${actor.name} · ${actor.email}`}
      />
      <Card>
        <CardBody className="gap-5">
          <h2 className="font-serif text-xl font-semibold text-navy">
            Change password
          </h2>
          <p className="text-sm text-navy/80">
            After the change you will be signed out on all devices and can sign
            in with the new password. Five incorrect current passwords will sign
            you out and pause sign-in for 15 minutes.
          </p>
          <FormShell action={changePasswordAction} label="Change password">
            <TextField
              name="currentPassword"
              label="Current password"
              type="password"
              autoComplete="current-password"
              required
            />
            <TextField
              name="newPassword"
              label="New password"
              type="password"
              autoComplete="new-password"
              hint="At least 12 characters. A short sentence works well."
              required
            />
            <TextField
              name="confirmPassword"
              label="Repeat new password"
              type="password"
              autoComplete="new-password"
              required
            />
            <div>
              <SubmitButton>Change password</SubmitButton>
            </div>
          </FormShell>
        </CardBody>
      </Card>
    </>
  );
}
