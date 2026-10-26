"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { switchLocalePath } from "@/lib/i18n-path";

export function LanguageSwitcher({
  tone = "light",
  onNavigate,
  className,
}: {
  tone?: "light" | "dark";
  onNavigate?: () => void;
  className?: string;
}) {
  const t = useTranslations("LanguageSwitcher");
  const locale = useLocale();
  const pathname = usePathname() ?? "/";

  return (
    <nav aria-label={t("label")} className={className}>
      <ul className="flex items-center gap-1 text-sm">
        {routing.locales.map((l, i) => {
          const active = l === locale;
          return (
            <li key={l} className="flex items-center gap-1">
              {i > 0 ? (
                <span aria-hidden="true" className="h-4 w-px bg-gold/60" />
              ) : null}
              <Link
                href={switchLocalePath(pathname, l)}
                hrefLang={l}
                lang={l}
                aria-current={active ? "true" : undefined}
                onClick={onNavigate}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-md px-2.5 font-medium transition-colors",
                  tone === "light"
                    ? active
                      ? "text-navy underline decoration-gold decoration-2 underline-offset-[6px]"
                      : "text-navy/75 hover:text-navy"
                    : active
                      ? "text-white underline decoration-gold decoration-2 underline-offset-[6px]"
                      : "text-white/80 hover:text-white",
                )}
              >
                {t(l)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
