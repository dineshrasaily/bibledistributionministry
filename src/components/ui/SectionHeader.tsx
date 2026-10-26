import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "light" | "beige" | "dark";

// Eyebrow colours follow the contrast table in README (WCAG AA).
const eyebrowTone: Record<Tone, string> = {
  light: "text-gold-dark",
  beige: "text-navy",
  dark: "text-gold",
};

const titleTone: Record<Tone, string> = {
  light: "text-navy",
  beige: "text-navy",
  dark: "text-white",
};

const descriptionTone: Record<Tone, string> = {
  light: "text-navy/80",
  beige: "text-navy/85",
  dark: "text-white/85",
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
  as = "h2",
  tone = "light",
  id,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  as?: "h1" | "h2";
  tone?: Tone;
  id?: string;
  className?: string;
}) {
  const Heading = as;
  const centered = align === "center";
  return (
    <div
      className={cn(
        "flex max-w-2xl flex-col gap-3",
        centered && "mx-auto items-center text-center",
        className,
      )}
    >
      {eyebrow ? (
        <p
          className={cn(
            "text-sm font-semibold tracking-[0.16em] uppercase",
            eyebrowTone[tone],
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <Heading
        id={id}
        className={cn(
          "font-serif leading-tight font-semibold",
          as === "h1" ? "text-4xl sm:text-5xl" : "text-3xl sm:text-4xl",
          titleTone[tone],
        )}
      >
        {title}
      </Heading>
      <span aria-hidden="true" className="mt-1 gold-rule" />
      {description ? (
        <p className={cn("mt-1 text-lg", descriptionTone[tone])}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
