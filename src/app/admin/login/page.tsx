import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { SiteLogo } from "@/components/brand/SiteLogo";
import { getSiteSettings } from "@/lib/site-settings";
import { safeNext } from "@/lib/safe-next";
import { getCurrentAdmin } from "@/server/auth/guards";

export const metadata: Metadata = { title: "Sign in" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await getCurrentAdmin()) redirect(next ?? "/admin");
  const { ministryName, logoUrl } = await getSiteSettings();
  const changed = params.changed === "1";

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-lg border border-beige bg-white p-6 shadow-[0_8px_24px_-12px_rgba(20,28,47,0.18)] sm:p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <SiteLogo
            logoUrl={logoUrl}
            className="h-14 w-auto max-w-[10rem]"
            fallbackClassName="size-11"
          />
          <p className="font-serif text-lg font-semibold text-navy">
            {ministryName} Admin
          </p>
          <span aria-hidden="true" className="gold-rule" />
          <h1 className="font-serif text-3xl font-semibold text-navy">
            Sign in
          </h1>
        </div>
        {changed ? (
          <p
            role="status"
            className="rounded-md border border-navy/30 bg-beige/40 px-4 py-3 text-sm text-navy"
          >
            Your password was changed. Please sign in again with the new
            password.
          </p>
        ) : null}
        <LoginForm next={next} />
        <p className="text-center text-sm text-navy/75">
          After 5 incorrect attempts, sign-in pauses for 15 minutes to keep the
          account safe.
        </p>
      </div>
    </main>
  );
}
