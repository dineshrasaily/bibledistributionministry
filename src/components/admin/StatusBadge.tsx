import { cn } from "@/lib/cn";

const STYLES: Record<string, string> = {
  DRAFT: "border-navy/30 bg-beige text-navy",
  PUBLISHED: "border-navy bg-navy text-white",
  UPCOMING: "border-gold-dark bg-white text-gold-dark",
  COMPLETED: "border-navy/30 bg-white text-navy",
  CANCELLED: "border-red-700 bg-white text-red-800",
  NEW: "border-gold-dark bg-white text-gold-dark",
  PRAYED: "border-navy/30 bg-beige text-navy",
  READ: "border-navy/30 bg-beige text-navy",
  ARCHIVED: "border-navy/30 bg-white text-navy/80",
  ACTIVE: "border-navy bg-navy text-white",
  INACTIVE: "border-navy/30 bg-white text-navy/80",
  PAID: "border-navy bg-navy text-white",
  PARTIALLY_REFUNDED: "border-gold-dark bg-white text-gold-dark",
  REFUNDED: "border-red-700 bg-white text-red-800",
};

const LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  UPCOMING: "Upcoming",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NEW: "New",
  PRAYED: "Prayed",
  READ: "Read",
  ARCHIVED: "Archived",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  PAID: "Paid",
  PARTIALLY_REFUNDED: "Partially refunded",
  REFUNDED: "Refunded",
};

export function statusLabel(status: string): string {
  return LABELS[status] ?? status;
}

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        STYLES[status] ?? STYLES.DRAFT,
        className,
      )}
    >
      {statusLabel(status)}
    </span>
  );
}
