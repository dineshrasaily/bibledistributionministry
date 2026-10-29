"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

type Status = "idle" | "copied" | "failed";

const RESET_MS = 2000;

/** Old-browser fallback: copy through a temporary off-screen textarea. */
function legacyCopy(value: string): boolean {
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "-1000px";
  area.style.opacity = "0";
  document.body.appendChild(area);
  try {
    area.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

/**
 * Copies `value` (Zelle email, account number, ...) and announces
 * "Copied" / the failure text in a polite live region.
 */
export function CopyButton({
  value,
  label,
  labels,
}: {
  value: string;
  /** Accessible name, e.g. "Copy Zelle email". */
  label: string;
  labels: { copy: string; copied: string; failed: string };
}) {
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function show(next: Status) {
    setStatus(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), RESET_MS);
  }

  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
      await navigator.clipboard.writeText(value);
      show("copied");
    } catch {
      show(legacyCopy(value) ? "copied" : "failed");
    }
  }

  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-label={label}
        onClick={copy}
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
        {/* Visible text stays "Copy" so it always matches the accessible name;
            the status next to it shows and announces "Copied". */}
        {labels.copy}
      </Button>
      <span
        role="status"
        aria-live="polite"
        className={
          status === "failed"
            ? "text-sm text-red-700"
            : "text-sm text-gold-dark"
        }
      >
        {status === "copied"
          ? labels.copied
          : status === "failed"
            ? labels.failed
            : ""}
      </span>
    </span>
  );
}
