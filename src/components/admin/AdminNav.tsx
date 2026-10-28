"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminRole } from "@/generated/prisma/enums";
import { cn } from "@/lib/cn";

type NavItem = { href: string; label: string };

const CONTENT: NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/posts", label: "Posts" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/verses", label: "Bible verses" },
  { href: "/admin/events", label: "Events & missions" },
  { href: "/admin/media", label: "Media library" },
  { href: "/admin/galleries", label: "Galleries" },
];
const INBOX: NavItem[] = [
  { href: "/admin/inbox/prayer", label: "Prayer requests" },
  { href: "/admin/inbox/messages", label: "Messages" },
];
// Hiding these for editors is cosmetic; the pages enforce requireOwnerPage.
const OWNER: NavItem[] = [
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/donations", label: "Donations" },
  { href: "/admin/inbox/settings", label: "Inbox settings" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/audit", label: "Audit log" },
];
const ACCOUNT: NavItem[] = [{ href: "/admin/account", label: "Account" }];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Section({
  title,
  items,
  pathname,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="px-3 pt-4 pb-1 text-xs font-semibold tracking-[0.14em] text-gold uppercase">
        {title}
      </p>
      <ul className="flex flex-col">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
                className={cn(
                  "relative flex min-h-11 items-center rounded-md px-3 text-[0.95rem] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                  active
                    ? "bg-white/10 font-semibold text-white"
                    : "text-white/80 hover:bg-white/5 hover:text-white",
                )}
              >
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-gold"
                  />
                ) : null}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Sidebar navigation (also used inside the mobile dialog). */
export function AdminNav({
  role,
  onNavigate,
}: {
  role: AdminRole;
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "/admin";
  return (
    <nav aria-label="Admin" className="flex flex-col gap-2 px-3 pb-6">
      <Section
        title="Content"
        items={CONTENT}
        pathname={pathname}
        onNavigate={onNavigate}
      />
      <Section
        title="Inbox"
        items={INBOX}
        pathname={pathname}
        onNavigate={onNavigate}
      />
      {role === "OWNER" ? (
        <Section
          title="Owner"
          items={OWNER}
          pathname={pathname}
          onNavigate={onNavigate}
        />
      ) : null}
      <Section
        title="You"
        items={ACCOUNT}
        pathname={pathname}
        onNavigate={onNavigate}
      />
    </nav>
  );
}
