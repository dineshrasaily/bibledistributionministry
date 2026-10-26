// @vitest-environment node
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ConfigError, readAuthSecret, readTotpKey } from "./keys";
import { open, seal } from "./secret-box";

const key = randomBytes(32);

function flip(sealed: string, part: 1 | 2 | 3): string {
  const parts = sealed.split(":");
  const bytes = Buffer.from(parts[part]!, "base64url");
  bytes[0] = bytes[0]! ^ 0xff;
  parts[part] = bytes.toString("base64url");
  return parts.join(":");
}

describe("secret-box", () => {
  it("round-trips with the v1 format", () => {
    const sealed = seal("JBSWY3DPEHPK3PXP", "totp:user-1", key);
    expect(sealed).toMatch(/^v1:[\w-]+:[\w-]+:[\w-]+$/);
    expect(open(sealed, "totp:user-1", key)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("uses a fresh IV each time", () => {
    expect(seal("x", "a", key)).not.toBe(seal("x", "a", key));
  });

  it.each([1, 2, 3] as const)("throws when part %i is tampered", (part) => {
    const sealed = seal("secret", "totp:user-1", key);
    expect(() => open(flip(sealed, part), "totp:user-1", key)).toThrow();
  });

  it("throws on wrong AAD (ciphertexts can't be swapped between users)", () => {
    const sealed = seal("secret", "totp:user-1", key);
    expect(() => open(sealed, "totp:user-2", key)).toThrow();
  });

  it("throws on a wrong key", () => {
    const sealed = seal("secret", "totp:user-1", key);
    expect(() => open(sealed, "totp:user-1", randomBytes(32))).toThrow();
  });

  it("throws on unknown version / malformed input", () => {
    expect(() => open("v2:a:b:c", "x", key)).toThrow();
    expect(() => open("garbage", "x", key)).toThrow();
  });

  it("rejects keys that are not 32 bytes", () => {
    expect(() => seal("x", "a", randomBytes(16))).toThrow(ConfigError);
  });
});

describe("keys", () => {
  it("readTotpKey requires base64 of exactly 32 bytes", () => {
    const good = randomBytes(32).toString("base64");
    expect(readTotpKey({ TOTP_ENCRYPTION_KEY: good })).toHaveLength(32);
    for (const bad of [
      undefined,
      "",
      randomBytes(16).toString("base64"),
      "not base64!!",
    ]) {
      expect(() => readTotpKey({ TOTP_ENCRYPTION_KEY: bad })).toThrow(
        "TOTP_ENCRYPTION_KEY must be base64 for 32 bytes",
      );
    }
  });

  it("readAuthSecret requires at least 32 characters", () => {
    expect(readAuthSecret({ AUTH_SECRET: "x".repeat(32) })).toHaveLength(32);
    expect(() => readAuthSecret({ AUTH_SECRET: "short" })).toThrow(ConfigError);
  });
});
