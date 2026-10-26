"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useToast } from "./ToastProvider";

/** Allow-listed `?toast=` keys set by redirect-based successes. */
const MESSAGES: Record<string, string> = {
  created: "Created.",
  deleted: "Deleted.",
  published: "Published.",
};

/**
 * Turns `?toast=created|deleted|published` into a toast, then strips the
 * parameter. Reads window.location (not useSearchParams) so it never needs a
 * Suspense boundary.
 */
export function FlashToast() {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    const url = new URL(window.location.href);
    const key = url.searchParams.get("toast");
    if (!key) return;
    const message = MESSAGES[key];
    if (message) toast.show(message);
    url.searchParams.delete("toast");
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }, [pathname, router, toast]);

  return null;
}
