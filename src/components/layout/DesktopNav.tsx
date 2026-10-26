"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { headerNav } from "@/config/navigation";
import { cn } from "@/lib/cn";
import { localizedHref, stripLocale } from "@/lib/i18n-path";

export function DesktopNav({ className }: { className?: string }) {
  const t = useTranslations("Nav");
  const tHeader = useTranslations("Header");
  const locale = useLocale();
  const current = stripLocale(usePathname() ?? "/");

  return (
    <nav aria-label={tHeader("mainNavLabel")} className={className}>
      <ul className="flex items-center gap-0.5">
        {headerNav.map((item) => {
          const active = current === item.href;
          return (
            <li key={item.key}>
              <Link
                href={localizedHref(locale, item.href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-md px-2.5 text-[0.95rem] font-medium whitespace-nowrap transition-colors",
                  active
                    ? "text-navy underline decoration-gold decoration-2 underline-offset-[10px]"
                    : "text-navy/80 hover:text-navy",
                )}
              >
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
