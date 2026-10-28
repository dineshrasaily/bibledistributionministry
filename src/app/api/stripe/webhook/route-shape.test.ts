// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Static guard for the Stripe webhook route's security-relevant shape. */
const source = readFileSync(
  path.join(process.cwd(), "src/app/api/stripe/webhook/route.ts"),
  "utf8",
);

describe("Stripe webhook route shape", () => {
  it("reads the raw body and never parses JSON before verifying", () => {
    expect(source).not.toMatch(/request\.json\(|req\.json\(|\.formData\(/);
    expect(source).toContain("request.body.getReader()");
    expect(source).toContain("verifyStripeEvent(");
  });

  it("exports only POST (no GET/PUT/DELETE handlers)", () => {
    const handlers = [
      ...source.matchAll(/^export (?:async )?function (\w+)/gm),
    ].map((m) => m[1]);
    expect(handlers).toEqual(["POST"]);
    expect(source).not.toMatch(/export const \{/);
  });

  it("is a Node.js, dynamic route with no session or origin check", () => {
    expect(source).toMatch(/export const runtime = "nodejs"/);
    expect(source).toMatch(/export const dynamic = "force-dynamic"/);
    expect(source).not.toContain("requireAdmin");
    expect(source).not.toContain("isSameOrigin");
  });
});
