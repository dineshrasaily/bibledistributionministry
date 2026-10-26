"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import type { ActionResult } from "@/server/actions/run-admin-action";
import { cn } from "@/lib/cn";
import { useToast } from "./ToastProvider";

/** Any admin server action `(prev, formData) => ActionResult`. */
export type FormAction = (
  prev: never,
  formData: FormData,
) => Promise<ActionResult<unknown>>;

type StateAction = (
  prev: ActionResult<unknown> | null,
  formData: FormData,
) => Promise<ActionResult<unknown>>;

type FormContextValue = {
  fieldErrors: Record<string, string>;
  pending: boolean;
};

const FormContext = createContext<FormContextValue>({
  fieldErrors: {},
  pending: false,
});

/** Field error for a form field name (e.g. "titleEn", "social.facebook"). */
export function useFieldError(name: string): string | undefined {
  return useContext(FormContext).fieldErrors[name];
}

export function useFormPending(): boolean {
  return useContext(FormContext).pending;
}

/** Stable DOM id for a field name ("social.facebook" -> "f-social-facebook"). */
export function fieldId(name: string): string {
  return `f-${name.replace(/[^A-Za-z0-9_-]/g, "-")}`;
}

export const errorIdFor = (name: string) => `${fieldId(name)}-error`;

type SummaryItem = { id: string; text: string };

/** "<field label>: <message>" using the field's visible label when present. */
function summaryText(id: string, message: string): string {
  const label =
    typeof document === "undefined"
      ? undefined
      : document
          .querySelector(`label[for="${id}"]`)
          ?.textContent?.replace(/\*\s*\(required\)/, "")
          .trim();
  return label ? `${label}: ${message}` : message;
}

/**
 * Client wrapper for admin forms: useActionState + submit via onSubmit and
 * startTransition (so React 19 does not reset uncontrolled inputs), a
 * focused error summary on failure and a toast on success.
 */
export function FormShell({
  action,
  children,
  className,
  resetOnSuccess = false,
  successToast = true,
  label,
  onSuccess,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  /** Clear the inputs after a successful save (inline create forms). */
  resetOnSuccess?: boolean;
  successToast?: boolean;
  /** Accessible name of the form. */
  label?: string;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult<unknown> | null,
    FormData
  >(action as unknown as StateAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const router = useRouter();
  const handled = useRef<typeof state>(null);

  useEffect(() => {
    if (!state || handled.current === state) return;
    handled.current = state;
    if (state.ok) {
      if (successToast) toast.show(state.message);
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.();
      return;
    }
    if (state.code === "UNAUTHENTICATED") {
      router.push(
        `/admin/login?next=${encodeURIComponent(window.location.pathname)}`,
      );
      return;
    }
    // The summary is rendered by now; move focus to it.
    summaryRef.current?.focus();
  }, [state, toast, router, resetOnSuccess, successToast, onSuccess]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as
      HTMLButtonElement | HTMLInputElement | null;
    const formData = new FormData(form);
    if (submitter?.name) formData.set(submitter.name, submitter.value);
    startTransition(() => formAction(formData));
  }

  const failure =
    state && !state.ok && state.code !== "UNAUTHENTICATED" ? state : null;
  // Only non-null after a client-side submit, so reading labels is safe here.
  const summary: SummaryItem[] = failure
    ? Object.entries(failure.fieldErrors ?? {}).map(([name, message]) => ({
        id: fieldId(name),
        text: summaryText(fieldId(name), message),
      }))
    : [];

  return (
    <FormContext.Provider
      value={{
        fieldErrors: state && !state.ok ? (state.fieldErrors ?? {}) : {},
        pending,
      }}
    >
      <form
        ref={formRef}
        onSubmit={onSubmit}
        aria-busy={pending || undefined}
        aria-label={label}
        noValidate
        className={cn("flex flex-col gap-6", className)}
      >
        {failure ? (
          <div
            ref={summaryRef}
            role="alert"
            tabIndex={-1}
            data-testid="form-error-summary"
            className="rounded-lg border border-red-700 bg-white p-4 text-red-800 focus:outline-2 focus:outline-offset-2 focus:outline-red-700"
          >
            <p className="font-semibold">
              {failure.formError ?? "Please fix the highlighted fields."}
            </p>
            {summary.length > 0 ? (
              <ul className="mt-2 list-disc pl-5 text-sm">
                {summary.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} className="underline">
                      {item.text}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {children}
      </form>
    </FormContext.Provider>
  );
}
