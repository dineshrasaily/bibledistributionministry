"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { headerNav } from "@/config/navigation";
import { cn } from "@/lib/cn";
import { localizedHref, stripLocale } from "@/lib/i18n-path";
import { LanguageSwitcher } from "./LanguageSwitcher";

/**
 * Accessible mobile navigation. Radix Dialog provides the focus trap,
 * Escape-to-close, aria-expanded/aria-controls on the trigger and focus
 * return to the trigger on close.
 */
export function MobileMenu({ className }: { className?: string }) {
  const t = useTranslations("Nav");
  const tHeader = useTranslations("Header");
  const locale = useLocale();
  const current = stripLocale(usePathname() ?? "/");
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className={cn(
          "inline-flex size-11 items-center justify-center rounded-md text-navy transition-colors hover:bg-beige/60",
          className,
        )}
        data-testid="mobile-menu-trigger"
      >
        <span className="sr-only">{tHeader("openMenu")}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-navy/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-50 flex w-[min(22rem,100%)] flex-col overflow-y-auto border-l border-gold/30 bg-ivory shadow-2xl focus:outline-none"
        >
          <div className="flex items-center justify-between border-b border-gold/30 px-5 py-3">
            <Dialog.Title className="font-serif text-xl font-semibold text-navy">
              {tHeader("menuTitle")}
            </Dialog.Title>
            <Dialog.Close className="inline-flex size-11 items-center justify-center rounded-md text-navy transition-colors hover:bg-beige/60">
              <span className="sr-only">{tHeader("closeMenu")}</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </Dialog.Close>
          </div>
          <nav aria-label={tHeader("mainNavLabel")} className="px-3 py-4">
            <ul className="flex flex-col">
              {headerNav.map((item) => {
                const active = current === item.href;
                return (
                  <li key={item.key}>
                    <Link
                      href={localizedHref(locale, item.href)}
                      aria-current={active ? "page" : undefined}
                      onClick={close}
                      className={cn(
                        "flex min-h-12 items-center rounded-md px-3 font-serif text-lg transition-colors",
                        active
                          ? "bg-beige font-semibold text-navy"
                          : "text-navy hover:bg-beige/60",
                      )}
                    >
                      {active ? (
                        <span
                          aria-hidden="true"
                          className="mr-3 h-5 w-0.5 rounded-full bg-gold"
                        />
                      ) : null}
                      {t(item.key)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="mt-auto flex flex-col gap-4 border-t border-gold/30 px-5 py-5">
            <LanguageSwitcher onNavigate={close} />
            <Button
              href={localizedHref(locale, "/support")}
              variant="gold"
              onClick={close}
              className="w-full"
            >
              {tHeader("supportCta")}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
