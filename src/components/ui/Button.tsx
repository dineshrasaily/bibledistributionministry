import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant =
  "primary" | "secondary" | "ghost" | "gold" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-sans font-medium tracking-wide whitespace-nowrap transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-gold-dark disabled:pointer-events-none disabled:opacity-50";

export const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-navy text-white hover:bg-navy-deep",
  secondary: "border border-navy bg-transparent text-navy hover:bg-navy/5",
  ghost: "bg-transparent text-navy hover:bg-beige/60",
  gold: "bg-gold text-navy hover:bg-gold-light",
  // Destructive actions (admin deletes). red-700 on white is about 6.5:1.
  danger: "bg-red-700 text-white hover:bg-red-800",
};

export const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-9 px-4 text-sm",
  md: "min-h-11 px-6 text-base",
  lg: "min-h-12 px-8 text-lg",
};

export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return cn(base, variantClasses[variant], sizeClasses[size], className);
}

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
};

type ButtonAsButton = CommonProps &
  Omit<ComponentPropsWithoutRef<"button">, keyof CommonProps> & {
    href?: undefined;
  };

type ButtonAsLink = CommonProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, keyof CommonProps | "href"> & {
    /** Already-localized href, e.g. built with `localizedHref()`. */
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button(props: ButtonProps) {
  if (props.href !== undefined) {
    const { variant, size, className, children, href, ...rest } = props;
    return (
      <Link
        href={href}
        className={buttonVariants({ variant, size, className })}
        {...rest}
      >
        {children}
      </Link>
    );
  }

  const {
    variant,
    size,
    className,
    children,
    type = "button",
    ...rest
  } = props;
  return (
    <button
      type={type}
      className={buttonVariants({ variant, size, className })}
      {...rest}
    >
      {children}
    </button>
  );
}
