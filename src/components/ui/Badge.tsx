import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant = "neutral" | "gold" | "navy";

const variants: Record<BadgeVariant, string> = {
  neutral: "border-beige bg-beige/60 text-navy",
  gold: "border-gold-dark bg-white text-gold-dark",
  navy: "border-navy bg-navy text-white",
};

export function Badge({
  variant = "neutral",
  className,
  children,
}: {
  variant?: BadgeVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export type DemoBadgeTone = "light" | "dark";

const demoTones: Record<DemoBadgeTone, { badge: string; dot: string }> = {
  // Light surfaces: dark gold text for AA contrast.
  light: {
    badge: "border-gold-dark bg-white text-gold-dark",
    dot: "bg-gold-dark",
  },
  // Navy surfaces (e.g. the footer): gold text reads well on dark.
  dark: { badge: "border-gold bg-transparent text-gold", dot: "bg-gold" },
};

/** Visible marker for sample content. Pass the translated label. */
export function DemoBadge({
  label,
  tone = "light",
  className,
}: {
  label: string;
  tone?: DemoBadgeTone;
  className?: string;
}) {
  return (
    <span
      data-demo-badge=""
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.7rem] font-semibold tracking-[0.08em] uppercase",
        demoTones[tone].badge,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", demoTones[tone].dot)}
      />
      {label}
    </span>
  );
}
