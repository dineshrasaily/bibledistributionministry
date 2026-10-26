import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { describedBy, type FieldProps } from "./Input";

export function Checkbox({
  id,
  label,
  className,
  invalid,
  errorId,
  "aria-describedby": ariaDescribedBy,
  ...rest
}: Omit<ComponentPropsWithoutRef<"input">, "type"> &
  FieldProps & { id: string; label: ReactNode }) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 cursor-pointer rounded border-navy/40 accent-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-dark"
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy(ariaDescribedBy, invalid, errorId)}
        {...rest}
      />
      <label htmlFor={id} className="cursor-pointer text-base text-navy">
        {label}
      </label>
    </div>
  );
}
