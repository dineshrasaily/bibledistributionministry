import { cn } from "@/lib/cn";

export function FieldError({
  id,
  message,
  className,
}: {
  id: string;
  message?: string | null;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className={cn("mt-1.5 text-sm font-medium text-red-800", className)}
    >
      {message}
    </p>
  );
}
