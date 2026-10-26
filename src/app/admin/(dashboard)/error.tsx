"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/Button";

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-4 rounded-lg border border-red-700 bg-white p-6"
    >
      <h1 className="font-serif text-2xl font-semibold text-navy">
        Something went wrong
      </h1>
      <p className="text-navy/80">
        This page couldn&apos;t load. Your saved content is safe. Try again, or
        go back to the dashboard.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={reset}>Retry</Button>
        <Link
          href="/admin"
          className={buttonVariants({ variant: "secondary" })}
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
