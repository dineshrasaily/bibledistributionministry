import type { NextRequest } from "next/server";
import { libraryQuerySchema } from "@/lib/validation/uploads";
import { requireAdminRoute } from "@/server/auth/route-guard";
import { listLibrary } from "@/server/services/media";

/** JSON page of the media library for the pickers (a read, so a route). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute(request, { mutation: false });
  if (guard instanceof Response) return guard;
  const params = request.nextUrl.searchParams;
  const query = libraryQuerySchema.parse({
    kind: params.get("kind") ?? undefined,
    q: params.get("q") ?? undefined,
    page: params.get("page") ?? undefined,
  });
  const page = await listLibrary(query);
  return Response.json(page, { headers: { "Cache-Control": "no-store" } });
}
