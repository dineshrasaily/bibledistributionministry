import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import type { AdminActor } from "@/server/auth/guards";
import { AdminMobileNav } from "./AdminMobileNav";
import { AdminNav } from "./AdminNav";
import { FlashToast } from "./FlashToast";
import { SessionIndicator } from "./SessionIndicator";

/**
 * Admin chrome: fixed sidebar at lg+, top bar with a menu dialog below lg.
 * Server component; the nav pieces are client components.
 */
export function AdminShell({
  actor,
  siteName,
  children,
}: {
  actor: AdminActor;
  siteName: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-ivory text-navy">
      <a
        href="#admin-main"
        className="sr-only z-[70] rounded-md bg-navy px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <FlashToast />

      {/* Sidebar (lg+) */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col overflow-y-auto bg-navy-deep lg:flex">
        <Link
          href="/admin"
          className="flex items-center gap-3 border-b border-white/10 px-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gold"
        >
          <Logo decorative className="size-8" />
          <span className="min-w-0">
            <span className="block truncate font-serif text-base font-semibold text-white">
              {siteName}
            </span>
            <span className="block text-xs tracking-[0.14em] text-gold uppercase">
              Admin
            </span>
          </span>
        </Link>
        <div className="border-b border-white/10 px-5 py-3">
          <SessionIndicator name={actor.name} role={actor.role} />
        </div>
        <AdminNav role={actor.role} />
      </aside>

      {/* Top bar (< lg) */}
      <header className="sticky top-0 z-40 flex items-center gap-3 bg-navy-deep px-3 py-2 lg:hidden">
        <AdminMobileNav role={actor.role} />
        <Link
          href="/admin"
          className="flex min-w-0 items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-gold"
        >
          <Logo decorative className="size-7" />
          <span className="truncate font-serif text-base font-semibold text-white">
            {siteName} Admin
          </span>
        </Link>
      </header>
      <div className="border-b border-beige bg-white px-4 py-2 lg:hidden">
        <SessionIndicator name={actor.name} role={actor.role} tone="light" />
      </div>

      <main
        id="admin-main"
        tabIndex={-1}
        className="px-4 py-6 focus:outline-none sm:px-6 lg:ml-64 lg:px-10 lg:py-8"
      >
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
