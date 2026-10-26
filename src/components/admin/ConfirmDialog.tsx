"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import type { ActionResult } from "@/server/actions/run-admin-action";
import type { FormAction } from "./FormShell";
import { useToast } from "./ToastProvider";

type StateAction = (
  prev: ActionResult<unknown> | null,
  formData: FormData,
) => Promise<ActionResult<unknown>>;

/**
 * Confirmation for destructive actions (Radix AlertDialog: focus trap,
 * Escape closes, focus returns to the trigger, Cancel gets initial focus).
 * Confirming submits a hidden form bound to the action.
 */
export function ConfirmDialog({
  action,
  fields,
  triggerLabel,
  title,
  description = "This can't be undone.",
  confirmLabel = "Delete",
  triggerVariant = "danger",
  confirmVariant = "danger",
}: {
  action: FormAction;
  /** Hidden form fields, e.g. { id }. */
  fields: Record<string, string>;
  triggerLabel: string;
  title: string;
  description?: string;
  confirmLabel?: string;
  triggerVariant?: ButtonVariant;
  confirmVariant?: ButtonVariant;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    ActionResult<unknown> | null,
    FormData
  >(action as unknown as StateAction, null);
  const formId = useId();
  const toast = useToast();
  const router = useRouter();
  const handled = useRef<typeof state>(null);

  useEffect(() => {
    if (!state || handled.current === state) return;
    handled.current = state;
    setOpen(false);
    if (state.ok) {
      toast.show(state.message);
    } else if (state.code === "UNAUTHENTICATED") {
      router.push("/admin/login");
    } else {
      toast.show(state.formError ?? "Something went wrong.", "error");
    }
  }, [state, toast, router]);

  return (
    <>
      <form id={formId} action={formAction} hidden>
        {Object.entries(fields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      </form>
      <AlertDialog.Root open={open} onOpenChange={setOpen}>
        <AlertDialog.Trigger asChild>
          <Button variant={triggerVariant} size="sm" className="min-h-11">
            {triggerLabel}
          </Button>
        </AlertDialog.Trigger>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-navy/40" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg border border-beige bg-white p-6 shadow-2xl focus:outline-none">
            <AlertDialog.Title className="font-serif text-xl font-semibold break-words text-navy">
              {title}
            </AlertDialog.Title>
            <AlertDialog.Description className="text-navy/80">
              {description}
            </AlertDialog.Description>
            <div className="flex flex-wrap justify-end gap-3">
              <AlertDialog.Cancel asChild>
                <Button variant="secondary">Cancel</Button>
              </AlertDialog.Cancel>
              <Button
                type="submit"
                form={formId}
                variant={confirmVariant}
                disabled={pending}
              >
                {pending ? "Working…" : confirmLabel}
              </Button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
