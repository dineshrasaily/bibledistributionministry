import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

type CardProps = {
  as?: "div" | "article" | "li";
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<"div">, "className" | "children">;

export function Card({ as = "div", className, children, ...rest }: CardProps) {
  const Component = as as ElementType;
  return (
    <Component
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-beige bg-white shadow-[0_1px_2px_rgba(20,28,47,0.04),0_8px_24px_-12px_rgba(20,28,47,0.12)]",
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-1 flex-col gap-3 p-6", className)}>
      {children}
    </div>
  );
}

export function CardTitle({
  as = "h3",
  className,
  children,
}: {
  as?: "h2" | "h3" | "h4";
  className?: string;
  children: ReactNode;
}) {
  const Component = as;
  return (
    <Component
      className={cn(
        "font-serif text-xl leading-snug font-semibold text-navy",
        className,
      )}
    >
      {children}
    </Component>
  );
}

export function CardMeta({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-navy/75",
        className,
      )}
    >
      {children}
    </div>
  );
}
