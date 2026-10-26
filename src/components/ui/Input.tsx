import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

export const fieldClasses =
  "block w-full rounded-md border border-navy/25 bg-white px-3.5 py-2.5 text-base text-navy placeholder:text-navy/50 transition-colors focus-visible:border-gold-dark focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:outline-none aria-invalid:border-red-700";

export type FieldProps = {
  invalid?: boolean;
  /** id of the FieldError element describing the error. */
  errorId?: string;
};

export function describedBy(
  existing: string | undefined,
  invalid: boolean | undefined,
  errorId: string | undefined,
): string | undefined {
  const ids = [existing, invalid ? errorId : undefined].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

export function Input({
  className,
  invalid,
  errorId,
  "aria-describedby": ariaDescribedBy,
  ...rest
}: ComponentPropsWithoutRef<"input"> & FieldProps) {
  return (
    <input
      className={cn(fieldClasses, "min-h-11", className)}
      aria-invalid={invalid ? true : undefined}
      aria-describedby={describedBy(ariaDescribedBy, invalid, errorId)}
      {...rest}
    />
  );
}
