// @vitest-environment node
import { describe, expect, it } from "vitest";
import { LocalDbGuardError, assertLocalDbUrls } from "./assert-local-db";

const LOCAL = "postgresql://postgres:postgres@127.0.0.1:54329/mission_dev";
const NEON = "postgresql://u:p@ep-x.neon.tech/db";

describe("assertLocalDbUrls", () => {
  it("accepts a local DATABASE_URL and DIRECT_URL pair", () => {
    expect(() =>
      assertLocalDbUrls({ DATABASE_URL: LOCAL, DIRECT_URL: LOCAL }),
    ).not.toThrow();
  });

  it("accepts localhost", () => {
    expect(() =>
      assertLocalDbUrls({
        DATABASE_URL: "postgresql://postgres:postgres@localhost:54329/x",
      }),
    ).not.toThrow();
  });

  it("rejects a Neon host in DATABASE_URL without leaking the URL", () => {
    expect(() => assertLocalDbUrls({ DATABASE_URL: NEON })).toThrow(
      LocalDbGuardError,
    );
    expect(() => assertLocalDbUrls({ DATABASE_URL: NEON })).toThrow(
      /DATABASE_URL/,
    );
    expect(() => assertLocalDbUrls({ DATABASE_URL: NEON })).not.toThrow(
      /neon\.tech/,
    );
  });

  it("rejects a Neon host in DIRECT_URL", () => {
    expect(() =>
      assertLocalDbUrls({ DATABASE_URL: LOCAL, DIRECT_URL: NEON }),
    ).toThrow(/Refusing to run: DIRECT_URL points to a non-local database/);
  });

  it("rejects an empty DATABASE_URL", () => {
    expect(() => assertLocalDbUrls({ DATABASE_URL: "" })).toThrow(
      LocalDbGuardError,
    );
    expect(() => assertLocalDbUrls({})).toThrow(LocalDbGuardError);
  });

  it("rejects garbage", () => {
    expect(() => assertLocalDbUrls({ DATABASE_URL: "not a url" })).toThrow(
      LocalDbGuardError,
    );
    expect(() =>
      assertLocalDbUrls({ DATABASE_URL: LOCAL, DIRECT_URL: "::::" }),
    ).toThrow(LocalDbGuardError);
  });

  it("accepts an empty DIRECT_URL with a local DATABASE_URL", () => {
    expect(() =>
      assertLocalDbUrls({ DATABASE_URL: LOCAL, DIRECT_URL: "" }),
    ).not.toThrow();
  });
});
