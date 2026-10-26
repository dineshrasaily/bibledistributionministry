import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { buttonVariants } from "@/components/ui/Button";

export default function AdminNotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-lg border border-beige bg-white p-8 text-center">
        <Logo decorative className="size-10" />
        <h1 className="font-serif text-2xl font-semibold text-navy">
          Admin page not found
        </h1>
        <p className="text-navy/80">
          This admin page doesn&apos;t exist. Check the address or go back to
          the dashboard.
        </p>
        <Link href="/admin" className={buttonVariants({ variant: "primary" })}>
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
