import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { EditorSection } from "@/components/admin/EditorSection";
import { TextField } from "@/components/admin/fields";
import { FormShell } from "@/components/admin/FormShell";
import { InlineAction } from "@/components/admin/InlineAction";
import { formatDateTime } from "@/components/admin/labels";
import { PageHeader } from "@/components/admin/PageHeader";
import { roleLabel } from "@/components/admin/SessionIndicator";
import { SetPasswordDialog } from "@/components/admin/SetPasswordDialog";
import { ListSkeleton } from "@/components/admin/Skeletons";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Badge } from "@/components/ui/Badge";
import {
  createEditorAction,
  resetEditorTotpAction,
  setUserActiveAction,
} from "@/server/actions/users";
import { requireOwnerPage } from "@/server/auth/guards";
import { EDITOR_LIMIT_MSG, MAX_ACTIVE_EDITORS } from "@/server/errors";
import { countActiveEditors, listAdmins } from "@/server/services/users";

export const metadata: Metadata = { title: "Users" };

async function UsersContent() {
  const [admins, activeEditors] = await Promise.all([
    listAdmins(),
    countActiveEditors(),
  ]);
  const atLimit = activeEditors >= MAX_ACTIVE_EDITORS;

  return (
    <>
      <ul aria-label="Admins" className="mb-8 flex flex-col gap-3">
        {admins.map((user) => {
          const isOwner = user.role === "OWNER";
          return (
            <li
              key={user.id}
              className="flex flex-col gap-3 rounded-lg border border-beige bg-white p-4 md:flex-row md:items-center md:gap-6"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <p className="font-serif text-lg font-semibold break-words text-navy">
                  {user.name}
                </p>
                <p className="text-sm break-all text-navy/80">{user.email}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={isOwner ? "navy" : "neutral"}>
                    {roleLabel(user.role)}
                  </Badge>
                  <StatusBadge status={user.isActive ? "ACTIVE" : "INACTIVE"} />
                  <Badge variant={user.totpEnabled ? "neutral" : "gold"}>
                    2FA: {user.totpEnabled ? "Set up" : "Pending"}
                  </Badge>
                </div>
                <p className="text-sm text-navy/75">
                  Last sign-in: {formatDateTime(user.lastLoginAt)}
                </p>
              </div>
              {isOwner ? (
                <p className="text-sm text-navy/75 md:max-w-48">
                  The owner account is managed with the setup command.
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <InlineAction
                    action={setUserActiveAction}
                    fields={{
                      id: user.id,
                      active: user.isActive ? "false" : "true",
                    }}
                    label={user.isActive ? "Deactivate" : "Reactivate"}
                    accessibleLabel={`${user.isActive ? "Deactivate" : "Reactivate"} ${user.name}`}
                  />
                  <ConfirmDialog
                    action={resetEditorTotpAction}
                    fields={{ id: user.id }}
                    triggerLabel="Reset 2FA"
                    triggerVariant="secondary"
                    title={`Reset 2FA for ${user.name}?`}
                    description="They are signed out now and will set up their authenticator app again at their next sign-in."
                    confirmLabel="Reset 2FA"
                  />
                  <SetPasswordDialog id={user.id} name={user.name} />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <EditorSection title="Add editor">
        <p className="text-sm font-medium text-navy" data-testid="editor-count">
          {activeEditors} of {MAX_ACTIVE_EDITORS} editors
        </p>
        {atLimit ? (
          <p
            role="note"
            className="rounded-md border border-gold-dark bg-beige/40 px-4 py-3 text-sm text-navy"
          >
            {EDITOR_LIMIT_MSG}
          </p>
        ) : null}
        <FormShell
          action={createEditorAction}
          resetOnSuccess
          label="Add editor"
        >
          <fieldset disabled={atLimit} className="flex flex-col gap-5">
            <legend className="sr-only">New editor details</legend>
            <TextField name="name" label="Name" maxLength={80} required />
            <TextField
              name="email"
              label="Email"
              type="email"
              autoComplete="off"
              required
            />
            <TextField
              name="password"
              label="Temporary password"
              type="password"
              autoComplete="new-password"
              hint="At least 12 characters. They set up their authenticator app at first sign-in."
              required
            />
            <TextField
              name="confirmPassword"
              label="Repeat password"
              type="password"
              autoComplete="new-password"
              required
            />
            <div>
              <SubmitButton disabled={atLimit}>Add editor</SubmitButton>
            </div>
          </fieldset>
        </FormShell>
      </EditorSection>
    </>
  );
}

export default async function UsersPage() {
  await requireOwnerPage("/admin/users");
  return (
    <>
      <PageHeader
        title="Users"
        description="The owner and up to 3 editors. Editors manage content; only the owner can change settings and users."
      />
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <UsersContent />
      </Suspense>
    </>
  );
}
