import { describe, expect, it } from "vitest";
import { fieldErrorsOf } from "./errors";
import {
  CONFIRM_NO_PII_MSG,
  inboxNoteSchema,
  PUBLIC_TEXT_REQUIRED_MSG,
  publishShareSchema,
  purgeSchema,
  retentionSchema,
} from "./inbox";

describe("publishShareSchema", () => {
  it("accepts English, Nepali or both with the confirmation", () => {
    expect(
      publishShareSchema.parse({
        id: "abc123",
        textEn: "  Pray for peace.\r\n",
        textNe: "",
        confirmNoPersonalInfo: "on",
      }),
    ).toEqual({
      id: "abc123",
      textEn: "Pray for peace.",
      textNe: null,
      confirmNoPersonalInfo: true,
    });
    expect(
      publishShareSchema.safeParse({
        id: "abc123",
        textNe: "शान्ति",
        confirmNoPersonalInfo: "on",
      }).success,
    ).toBe(true);
  });

  it("needs at least one text and the confirmation", () => {
    const r = publishShareSchema.safeParse({ id: "abc123", textEn: " " });
    expect(r.success).toBe(false);
    expect(r.success ? {} : fieldErrorsOf(r.error)).toEqual({
      textEn: PUBLIC_TEXT_REQUIRED_MSG,
      confirmNoPersonalInfo: CONFIRM_NO_PII_MSG,
    });
  });

  it("limits each text to 1500 characters", () => {
    const r = publishShareSchema.safeParse({
      id: "abc123",
      textNe: "a".repeat(1501),
      confirmNoPersonalInfo: "on",
    });
    expect(r.success ? {} : fieldErrorsOf(r.error)).toMatchObject({
      textNe: "Use at most 1500 characters",
    });
  });
});

describe("inboxNoteSchema", () => {
  it("blank note becomes null; long note is rejected", () => {
    expect(inboxNoteSchema.parse({ id: "abc", adminNote: "  " })).toEqual({
      id: "abc",
      adminNote: null,
    });
    expect(
      inboxNoteSchema.safeParse({ id: "abc", adminNote: "x".repeat(2001) })
        .success,
    ).toBe(false);
  });
});

describe("retentionSchema", () => {
  it("accepts 1..60 whole months", () => {
    expect(retentionSchema.parse({ inboxRetentionMonths: "6" })).toEqual({
      inboxRetentionMonths: 6,
    });
    for (const bad of ["0", "61", "2.5", "abc", ""]) {
      expect(
        retentionSchema.safeParse({ inboxRetentionMonths: bad }).success,
        bad,
      ).toBe(false);
    }
  });
});

describe("purgeSchema", () => {
  it("requires the literal confirm value", () => {
    expect(purgeSchema.safeParse({ confirm: "purge" }).success).toBe(true);
    expect(purgeSchema.safeParse({ confirm: "yes" }).success).toBe(false);
    expect(purgeSchema.safeParse({}).success).toBe(false);
  });
});
