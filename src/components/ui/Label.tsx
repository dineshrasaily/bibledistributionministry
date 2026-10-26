import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

export function Label({
  className,
  children,
  required,
  requiredText = "required",
  ...rest
}: ComponentPropsWithoutRef<"label"> & {
  required?: boolean;
  /** Screen-reader text for the required marker (pass a translated string). */
  requiredText?: string;
}) {
  return (
    <label
      className={cn("block text-sm font-medium text-navy", className)}
      {...rest}
    >
      {children}
      {required ? (
        <>
          <span aria-hidden="true" className="ml-0.5 text-gold-dark">
            *
          </span>
          <span className="sr-only"> ({requiredText})</span>
        </>
      ) : null}
    </label>
  );
}
