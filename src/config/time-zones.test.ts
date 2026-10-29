// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  COMMON_TIME_ZONES,
  DEFAULT_SITE_TIME_ZONE,
  isValidTimeZone,
  timeZoneOptions,
} from "./time-zones";

describe("isValidTimeZone", () => {
  it("accepts IANA zones, the modern Kathmandu name, its alias and UTC", () => {
    for (const tz of [
      DEFAULT_SITE_TIME_ZONE,
      "America/Los_Angeles",
      "Asia/Kathmandu",
      "Asia/Katmandu",
      "Europe/London",
      "UTC",
    ]) {
      expect(isValidTimeZone(tz), tz).toBe(true);
    }
  });

  it("rejects empty, unknown, offset-style and markup values", () => {
    for (const tz of [
      "",
      "Mars/Base",
      "UTC+5",
      "<script>",
      "america/new_york ",
      null,
      42,
    ]) {
      expect(isValidTimeZone(tz), String(tz)).toBe(false);
    }
  });
});

describe("timeZoneOptions", () => {
  const options = timeZoneOptions();

  it("starts with the common zones (US zones, then Nepal and UTC)", () => {
    expect(options.slice(0, COMMON_TIME_ZONES.length)).toEqual(
      COMMON_TIME_ZONES,
    );
    expect(options[0]!.value).toBe("America/New_York");
    expect(options.findIndex((o) => o.value === "Asia/Kathmandu")).toBeLessThan(
      10,
    );
  });

  it("has no duplicates and every value is valid", () => {
    const values = options.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
    for (const v of values) expect(isValidTimeZone(v), v).toBe(true);
  });

  it("includes every supported zone except the hidden aliases", () => {
    const values = new Set(options.map((o) => o.value));
    for (const tz of Intl.supportedValuesOf("timeZone")) {
      if (tz === "Asia/Katmandu" || tz === "Etc/UTC") {
        expect(values.has(tz), tz).toBe(false);
      } else {
        expect(values.has(tz), tz).toBe(true);
      }
    }
  });
});
