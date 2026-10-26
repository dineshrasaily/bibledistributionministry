// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getDummyHash, hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("hashes with Argon2id and the OWASP parameters", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash.startsWith("$argon2id$v=19$m=19456,t=2,p=1$")).toBe(true);
  });

  it("verifies the right password only", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword(hash, "correct horse battery")).toBe(true);
    expect(await verifyPassword(hash, "wrong horse battery")).toBe(false);
  });

  it("returns false for a malformed hash", async () => {
    expect(await verifyPassword("not-a-hash", "anything")).toBe(false);
  });

  it("computes the dummy hash once", async () => {
    const a = await getDummyHash();
    expect(await getDummyHash()).toBe(a);
    expect(a.startsWith("$argon2id$")).toBe(true);
  });
});
