import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { CSV_BOM } from "@/lib/donations/csv";
import { requireAdminRoute } from "@/server/auth/route-guard";
import { resetDb, setTestSession } from "@/test/db-setup";
import { makeDonation, makeEditor, makeOwner } from "@/test/factories";
import { GET } from "./route";

const BASE = "http://localhost/api/admin/donations/export";
const HEADER_ROW =
  '"Paid at (UTC)","Amount (USD)","Currency","Frequency","Status","Refunded (USD)","Donor email","Test mode","Stripe payment intent","Stripe invoice","Stripe subscription"';

const exportRequest = (qs = "") => new NextRequest(`${BASE}${qs}`);

let warnings: string[];

beforeEach(async () => {
  await resetDb();
  warnings = [];
  vi.spyOn(console, "warn").mockImplementation((line: unknown) => {
    warnings.push(String(line));
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("requireAdminRoute role OWNER", () => {
  it("anonymous -> 401, editor -> 403 FORBIDDEN, owner -> actor", async () => {
    const req = new Request(BASE);
    const anon = await requireAdminRoute(req, {
      mutation: false,
      role: "OWNER",
    });
    expect((anon as Response).status).toBe(401);

    setTestSession(await makeEditor());
    const editor = await requireAdminRoute(req, {
      mutation: false,
      role: "OWNER",
    });
    expect((editor as Response).status).toBe(403);
    expect(await (editor as Response).json()).toEqual({ error: "FORBIDDEN" });
    // Without the role option editors still pass (existing routes unchanged).
    expect(
      await requireAdminRoute(req, { mutation: false }),
    ).not.toBeInstanceOf(Response);

    const owner = await makeOwner();
    setTestSession(owner);
    expect(
      await requireAdminRoute(req, { mutation: false, role: "OWNER" }),
    ).toMatchObject({ id: owner.id, role: "OWNER" });
  });
});

describe("GET /api/admin/donations/export", () => {
  it("401 without a session", async () => {
    const res = await GET(exportRequest());
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("403 for an editor, logged as admin.route.denied", async () => {
    await makeDonation({ donorEmail: "secret@example.org" });
    setTestSession(await makeEditor());
    const res = await GET(exportRequest("?period=all"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "FORBIDDEN" });
    expect(warnings.join("\n")).toMatch(/admin\.route\.denied.*FORBIDDEN/);
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it("401 for a deactivated owner", async () => {
    setTestSession(await makeOwner({ isActive: false }));
    expect((await GET(exportRequest())).status).toBe(401);
  });

  it("owner: CSV with headers, BOM, header row and filters applied", async () => {
    setTestSession(await makeOwner());
    await makeDonation({
      amountCents: 5000,
      donorEmail: "one@example.org",
      paidAt: new Date(),
    });
    await makeDonation({
      amountCents: 1234,
      interval: "MONTHLY",
      paidAt: new Date(),
    });
    const res = await GET(exportRequest("?period=all&interval=ONE_TIME"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="donations-all-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const bytes = new Uint8Array(await res.clone().arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = (await res.text()).replace(CSV_BOM, "");
    const lines = text.split("\r\n").filter(Boolean);
    expect(lines[0]).toBe(HEADER_ROW);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"50.00","USD","One-time","Paid"');
    expect(lines[1]).toContain('"one@example.org"');
  });

  it("escapes a formula-like donor email (CSV injection)", async () => {
    setTestSession(await makeOwner());
    await makeDonation({ donorEmail: '=HYPERLINK("x")@example.org' });
    const text = await (await GET(exportRequest("?period=all"))).text();
    expect(text).toContain(`"'=HYPERLINK(""x"")@example.org"`);
    expect(text).not.toMatch(/,"=HYPERLINK/);
  });

  it("writes exactly one donation.export audit row without emails or search text", async () => {
    const owner = await makeOwner();
    setTestSession(owner);
    await makeDonation({ donorEmail: "donor@example.org" });
    await GET(exportRequest("?period=all&q=donor%40example.org&mode=test"));
    const rows = await prisma.auditLog.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: "donation.export",
      entityType: "Donation",
      actorId: owner.id,
    });
    expect(rows[0]!.metadata).toEqual({
      period: "all",
      interval: null,
      status: null,
      mode: "test",
      hasQuery: true,
      rows: 1,
      truncated: false,
    });
    expect(JSON.stringify(rows[0]!.metadata)).not.toContain("@");
  });

  it("an empty export has only the header row", async () => {
    setTestSession(await makeOwner());
    const text = (await (await GET(exportRequest())).text()).replace(
      CSV_BOM,
      "",
    );
    expect(text).toBe(`${HEADER_ROW}\r\n`);
  });
});
