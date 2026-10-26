import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";
import { describedBy, fieldClasses, type FieldProps } from "./Input";

/** Native <select> styled like Input, with the same invalid/errorId props. */
export function Select({
  className,
  invalid,
  errorId,
  "aria-describedby": ariaDescribedBy,
  children,
  ...rest
}: ComponentPropsWithoutRef<"select"> & FieldProps) {
  return (
    <select
      className={cn(fieldClasses, "min-h-11 cursor-pointer pr-8", className)}
      aria-invalid={invalid ? true : undefined}
      aria-describedby={describedBy(ariaDescribedBy, invalid, errorId)}
      {...rest}
    >
      {children}
    </select>
  );
}
