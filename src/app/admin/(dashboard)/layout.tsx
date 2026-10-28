import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { getSiteSettings } from "@/lib/site-settings";
import { getCurrentAdmin } from "@/server/auth/guards";

/**
 * Shell only. It never redirects: every page awaits its own guard
 * (requireAdminPage / requireOwnerPage) before rendering anything, so a
 * missing session still yields a real 307 from the page.
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const actor = await getCurrentAdmin();
  if (!actor) return children;
  const { ministryName, logoUrl } = await getSiteSettings();
  return (
    <AdminShell actor={actor} siteName={ministryName} logoUrl={logoUrl || null}>
      {children}
    </AdminShell>
  );
}
