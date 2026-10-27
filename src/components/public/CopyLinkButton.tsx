"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

type Status = "idle" | "copied" | "failed";

/** Copies `url` to the clipboard and announces the result politely. */
export function CopyLinkButton({
  url,
  labels,
  className,
}: {
  url: string;
  labels: { copy: string; copied: string; failed: string };
  className?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={copy}
        className={cn(className, "cursor-pointer")}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h8" />
        </svg>
        {labels.copy}
      </button>
      <p
        role="status"
        aria-live="polite"
        className={cn(
          "basis-full text-sm",
          status === "failed" ? "text-red-700" : "text-navy/80",
        )}
      >
        {status === "copied"
          ? labels.copied
          : status === "failed"
            ? labels.failed
            : ""}
      </p>
    </>
  );
}
