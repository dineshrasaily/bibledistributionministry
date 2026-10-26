"use client";

import type { ReactNode } from "react";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { useFormPending } from "./FormShell";

/** Submit button for a FormShell form; shows "Saving…" while pending. */
export function SubmitButton({
  children,
  variant = "primary",
  disabled,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  disabled?: boolean;
}) {
  const pending = useFormPending();
  return (
    <Button type="submit" variant={variant} disabled={pending || disabled}>
      {pending ? "Saving…" : children}
    </Button>
  );
}
