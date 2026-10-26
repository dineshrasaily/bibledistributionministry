"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
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
  const [state, formAction, pending] = useActionState<
    ActionResult<unknown> | null,
    FormData
  >(action as unknown as StateAction, null);
  const toast = useToast();
  const router = useRouter();
  const handled = useRef<typeof state>(null);

  useEffect(() => {
    if (!state || handled.current === state) return;
    handled.current = state;
    if (state.ok) toast.show(state.message);
    else if (state.code === "UNAUTHENTICATED") router.push("/admin/login");
    else toast.show(state.formError ?? "Something went wrong.", "error");
  }, [state, toast, router]);

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
