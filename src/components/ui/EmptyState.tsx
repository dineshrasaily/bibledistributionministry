import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed border-gold/60 bg-white/70 px-6 py-12 text-center",
        className,
      )}
    >
      <span aria-hidden="true" className="text-gold">
        {icon ?? (
          <svg viewBox="0 0 24 24" className="size-8" fill="none">
            <path
              d="M12 3v18M7 8h10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        )}
      </span>
      <p className="font-serif text-xl font-semibold text-navy">{title}</p>
      {description ? (
        <p className="max-w-md text-navy/75">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
