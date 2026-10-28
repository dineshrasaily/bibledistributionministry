import type { NextRequest } from "next/server";
import { requireAdminRoute } from "@/server/auth/route-guard";
import { recordAdminAudit } from "@/server/services/audit";
import { buildDonationCsv } from "@/server/services/donations";

/**
 * CSV export of the donations list (same filters as /admin/donations).
 * OWNER only: donor emails and amounts are financial personal data.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute(request, {
    mutation: false,
    role: "OWNER",
  });
  if (guard instanceof Response) return guard;

  const { csv, query, rows, truncated } = await buildDonationCsv(
    request.nextUrl.searchParams,
  );
  // Audit: filters and the row count only (no emails, no search text).
  await recordAdminAudit({
    actor: guard,
    action: "donation.export",
    entityType: "Donation",
    metadata: {
      period: query.period,
      interval: query.interval ?? null,
      status: query.status ?? null,
      mode: query.mode ?? null,
      hasQuery: Boolean(query.q),
      rows,
      truncated,
    },
  });

  const day = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="donations-${query.period}-${day}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
