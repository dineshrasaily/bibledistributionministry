"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import type { ActionResult } from "@/server/actions/run-admin-action";
import type { FormAction } from "./FormShell";
import { useToast } from "./ToastProvider";

type StateAction = (
  prev: ActionResult<unknown> | null,
  formData: FormData,
) => Promise<ActionResult<unknown>>;

/** One-button form for row actions (publish/unpublish, activate, …) with a toast. */
export function InlineAction({
  action,
  fields,
  label,
  accessibleLabel,
  variant = "secondary",
}: {
  action: FormAction;
  fields: Record<string, string>;
  label: string;
  /** Longer name for screen readers, e.g. "Publish My post". */
  accessibleLabel?: string;
  variant?: ButtonVariant;
}) {
  const toast = useToast();
  const router = useRouter();
  // The toast is shown from the action wrapper, not an effect: a successful
  // action may unmount this button (e.g. "Unpublish" disappears once the
  // refreshed page has nothing to unpublish), and the toast must still show.
  const [, formAction, pending] = useActionState<
    ActionResult<unknown> | null,
    FormData
  >(async (prev, formData) => {
    const result = await (action as unknown as StateAction)(prev, formData);
    if (result.ok) toast.show(result.message);
    else if (result.code === "UNAUTHENTICATED") router.push("/admin/login");
    else toast.show(result.formError ?? "Something went wrong.", "error");
    return result;
  }, null);

  return (
    <form action={formAction}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button
        type="submit"
        variant={variant}
        size="sm"
        className="min-h-11"
        disabled={pending}
        aria-label={accessibleLabel}
      >
        {pending ? "Saving…" : label}
      </Button>
    </form>
  );
}
