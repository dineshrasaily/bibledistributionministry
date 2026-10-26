// @vitest-environment node
import { describe, expect, it } from "vitest";
import { totpCodeSchema } from "@/lib/validation/auth";
import { generateTotp, newTotpSecret, otpauthUri, verifyTotp } from "./totp";

const now = new Date("2026-05-01T12:00:10Z");

describe("totp", () => {
  it("creates 32-char base32 secrets and an otpauth URI", () => {
    const secret = newTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    const uri = otpauthUri({
      secret,
      email: "owner@example.org",
      issuer: "Demo Ministry Admin",
    });
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain(`secret=${secret}`);
    expect(uri).toContain("issuer=Demo");
  });

  it("verifies a generated code and returns its time step", async () => {
    const secret = newTotpSecret();
    const code = await generateTotp(secret, now);
    const result = await verifyTotp(secret, code, null, now);
    expect(result).toEqual({
      valid: true,
      timeStep: Math.floor(now.getTime() / 30_000),
    });
  });

  it("rejects a replay with afterTimeStep = accepted step", async () => {
    const secret = newTotpSecret();
    const code = await generateTotp(secret, now);
    const first = await verifyTotp(secret, code, null, now);
    if (!first.valid) throw new Error("expected valid");
    expect(await verifyTotp(secret, code, first.timeStep, now)).toEqual({
      valid: false,
    });
  });

  it("tolerates +-30 s but not 90 s of drift", async () => {
    const secret = newTotpSecret();
    const code = await generateTotp(secret, now);
    const later = new Date(now.getTime() + 30_000);
    const earlier = new Date(now.getTime() - 30_000);
    expect((await verifyTotp(secret, code, null, later)).valid).toBe(true);
    expect((await verifyTotp(secret, code, null, earlier)).valid).toBe(true);
    const far = new Date(now.getTime() + 90_000);
    expect((await verifyTotp(secret, code, null, far)).valid).toBe(false);
  });

  it("returns invalid (not a throw) for malformed codes", async () => {
    const secret = newTotpSecret();
    expect((await verifyTotp(secret, "abc", null, now)).valid).toBe(false);
  });

  it("non-numeric codes are rejected by the schema", () => {
    expect(totpCodeSchema.safeParse("12a456").success).toBe(false);
  });
});
