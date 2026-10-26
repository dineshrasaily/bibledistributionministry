"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import type { AdminRole } from "@/generated/prisma/enums";
import { AdminNav } from "./AdminNav";

/** Below lg: menu button opening the admin nav in a Radix Dialog (like MobileMenu). */
export function AdminMobileNav({ role }: { role: AdminRole }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-gold"
        data-testid="admin-menu-trigger"
      >
        <span className="sr-only">Open admin menu</span>
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
          className="fixed inset-y-0 left-0 z-50 flex w-[min(18rem,100%)] flex-col overflow-y-auto bg-navy-deep shadow-2xl focus:outline-none"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <Dialog.Title className="font-serif text-lg font-semibold text-white">
              Admin menu
            </Dialog.Title>
            <Dialog.Close className="inline-flex size-11 items-center justify-center rounded-md text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-gold">
              <span className="sr-only">Close admin menu</span>
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
          <AdminNav role={role} onNavigate={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
