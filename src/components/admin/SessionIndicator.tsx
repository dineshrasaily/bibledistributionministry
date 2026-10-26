import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import type { AdminRole } from "@/generated/prisma/enums";

export const roleLabel = (role: AdminRole) =>
  role === "OWNER" ? "Owner" : "Editor";

export function SessionIndicator({
  name,
  role,
  tone = "dark",
  className,
}: {
  name: string;
  role: AdminRole;
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <div
      data-testid="session-indicator"
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-2 text-sm",
        tone === "dark" ? "text-white/85" : "text-navy",
        className,
      )}
    >
      <span className="min-w-0 truncate">
        Signed in as <span className="font-semibold">{name}</span>
      </span>
      <Badge variant={tone === "dark" ? "gold" : "navy"}>
        {roleLabel(role)}
      </Badge>
    </div>
  );
}
