import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";
import { describedBy, fieldClasses, type FieldProps } from "./Input";

export function Textarea({
  className,
  invalid,
  errorId,
  rows = 5,
  "aria-describedby": ariaDescribedBy,
  ...rest
}: ComponentPropsWithoutRef<"textarea"> & FieldProps) {
  return (
    <textarea
      rows={rows}
      className={cn(fieldClasses, "resize-y", className)}
      aria-invalid={invalid ? true : undefined}
      aria-describedby={describedBy(ariaDescribedBy, invalid, errorId)}
      {...rest}
    />
  );
}
