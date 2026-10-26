import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";
import { requireAdminPage } from "@/server/auth/guards";

export const metadata: Metadata = { title: "No access" };

export default async function ForbiddenPage() {
  await requireAdminPage("/admin/forbidden");
  return (
    <div className="flex flex-col items-start gap-4 rounded-lg border border-beige bg-white p-6">
      <h1 className="font-serif text-3xl font-semibold text-navy">
        You don&apos;t have access to this page
      </h1>
      <p className="text-navy/80">
        Only the site owner can open this section. If you need a change here,
        ask the owner.
      </p>
      <Link href="/admin" className={buttonVariants({ variant: "primary" })}>
        Back to dashboard
      </Link>
    </div>
  );
}
