import { describe, expect, it } from "vitest";
import { retentionCutoff } from "./retention";

const d = (iso: string) => new Date(iso);

describe("retentionCutoff", () => {
  it("subtracts calendar months in UTC", () => {
    expect(retentionCutoff(d("2026-10-27T12:30:00.000Z"), 6)).toEqual(
      d("2026-04-27T12:30:00.000Z"),
    );
  });

  it("clamps month-end days", () => {
    expect(retentionCutoff(d("2026-03-31T00:00:00.000Z"), 1)).toEqual(
      d("2026-02-28T00:00:00.000Z"),
    );
    expect(retentionCutoff(d("2028-03-31T00:00:00.000Z"), 1)).toEqual(
      d("2028-02-29T00:00:00.000Z"),
    );
  });

  it("handles 12 and 60 months across years", () => {
    expect(retentionCutoff(d("2026-01-15T08:00:00.000Z"), 12)).toEqual(
      d("2025-01-15T08:00:00.000Z"),
    );
    expect(retentionCutoff(d("2026-02-28T08:00:00.000Z"), 60)).toEqual(
      d("2021-02-28T08:00:00.000Z"),
    );
    expect(retentionCutoff(d("2026-01-31T00:00:00.000Z"), 2)).toEqual(
      d("2025-11-30T00:00:00.000Z"),
    );
  });
});
