import { describe, expect, it } from "vitest";
import { DONATION_PERIODS, PERIOD_LABELS, periodRange } from "./period";

const iso = (d?: Date) => d?.toISOString();

describe("periodRange (UTC, half-open)", () => {
  const now = new Date("2026-10-15T12:00:00.000Z");

  it("this month / last month", () => {
    expect(periodRange("this-month", now)).toEqual({
      from: new Date("2026-10-01T00:00:00.000Z"),
      to: new Date("2026-11-01T00:00:00.000Z"),
    });
    expect(periodRange("last-month", now)).toEqual({
      from: new Date("2026-09-01T00:00:00.000Z"),
      to: new Date("2026-10-01T00:00:00.000Z"),
    });
  });

  it("1 January: last month is December of the previous year", () => {
    const jan1 = new Date("2027-01-01T00:00:00.000Z");
    expect(iso(periodRange("last-month", jan1).from)).toBe(
      "2026-12-01T00:00:00.000Z",
    );
    expect(iso(periodRange("this-month", jan1).from)).toBe(
      "2027-01-01T00:00:00.000Z",
    );
    expect(iso(periodRange("last-year", jan1).from)).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("31 December 23:59 UTC is still this month and this year", () => {
    const dec31 = new Date("2026-12-31T23:59:59.999Z");
    expect(periodRange("this-month", dec31)).toEqual({
      from: new Date("2026-12-01T00:00:00.000Z"),
      to: new Date("2027-01-01T00:00:00.000Z"),
    });
    expect(periodRange("this-year", dec31)).toEqual({
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2027-01-01T00:00:00.000Z"),
    });
  });

  it("leap day", () => {
    const leap = new Date("2028-02-29T10:00:00.000Z");
    expect(iso(periodRange("this-month", leap).to)).toBe(
      "2028-03-01T00:00:00.000Z",
    );
  });

  it("last 30 days ends just after now", () => {
    const range = periodRange("last-30-days", now);
    expect(iso(range.from)).toBe("2026-09-15T12:00:00.000Z");
    expect(range.to!.getTime()).toBe(now.getTime() + 1);
  });

  it("all has no bounds", () => {
    expect(periodRange("all", now)).toEqual({});
  });

  it("every period has a label", () => {
    for (const p of DONATION_PERIODS) expect(PERIOD_LABELS[p]).toBeTruthy();
  });
});
