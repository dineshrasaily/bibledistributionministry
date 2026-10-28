import { describe, expect, it } from "vitest";
import { fieldErrorsOf } from "./errors";
import { checkoutSchema, parseDonationListQuery } from "./donations";

const parse = (fields: Record<string, string>) =>
  checkoutSchema.safeParse({ locale: "en", interval: "ONE_TIME", ...fields });

const errorsOf = (fields: Record<string, string>) => {
  const result = parse(fields);
  expect(result.success).toBe(false);
  return fieldErrorsOf(result.error!);
};

describe("checkoutSchema (server-side amount validation)", () => {
  it.each(["25", "50", "100", "250"])("accepts preset %s", (choice) => {
    const result = parse({ amountChoice: choice });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      locale: "en",
      interval: "ONE_TIME",
      amountCents: Number(choice) * 100,
    });
  });

  it("ignores customAmount when a preset is chosen", () => {
    expect(
      parse({ amountChoice: "25", customAmount: "999999" }).data?.amountCents,
    ).toBe(2500);
  });

  it("custom amounts: required, parsed, and limited to $5-$10,000", () => {
    expect(
      parse({ amountChoice: "custom", customAmount: "$12.34" }).data
        ?.amountCents,
    ).toBe(1234);
    expect(
      parse({ amountChoice: "custom", customAmount: "10,000" }).data
        ?.amountCents,
    ).toBe(1_000_000);
    expect(parse({ amountChoice: "custom", customAmount: "5" }).success).toBe(
      true,
    );
    expect(errorsOf({ amountChoice: "custom" })).toEqual({
      customAmount: "amountRequired",
    });
    expect(errorsOf({ amountChoice: "custom", customAmount: " " })).toEqual({
      customAmount: "amountRequired",
    });
    expect(errorsOf({ amountChoice: "custom", customAmount: "abc" })).toEqual({
      customAmount: "amountInvalid",
    });
    expect(errorsOf({ amountChoice: "custom", customAmount: "1e3" })).toEqual({
      customAmount: "amountInvalid",
    });
    expect(errorsOf({ amountChoice: "custom", customAmount: "4.99" })).toEqual({
      customAmount: "amountTooSmall:5",
    });
    expect(
      errorsOf({ amountChoice: "custom", customAmount: "10000.01" }),
    ).toEqual({ customAmount: "amountTooLarge:10000" });
  });

  it("rejects tampered or missing preset choices", () => {
    for (const choice of ["1", "0", "-25", "25.00", "1000000", "", "CUSTOM"]) {
      expect(errorsOf({ amountChoice: choice }), choice).toEqual({
        amountChoice: "amountRequired",
      });
    }
    expect(errorsOf({})).toHaveProperty("amountChoice");
  });

  it("checks the interval and falls back to en for an unknown locale", () => {
    expect(errorsOf({ amountChoice: "25", interval: "WEEKLY" }).interval).toBe(
      "invalidOption",
    );
    expect(
      checkoutSchema.parse({
        locale: "fr",
        interval: "MONTHLY",
        amountChoice: "50",
      }),
    ).toEqual({ locale: "en", interval: "MONTHLY", amountCents: 5000 });
  });
});

describe("parseDonationListQuery", () => {
  it("defaults to this month and drops invalid filters", () => {
    expect(parseDonationListQuery({})).toEqual({
      page: 1,
      period: "this-month",
    });
    expect(
      parseDonationListQuery({
        period: "forever",
        interval: "WEEKLY",
        status: "LOST",
        mode: "prod",
        page: "-3",
        q: "x".repeat(101),
      }),
    ).toEqual({ page: 1, period: "this-month" });
  });

  it("keeps valid filters", () => {
    expect(
      parseDonationListQuery({
        period: "all",
        interval: "MONTHLY",
        status: "REFUNDED",
        mode: "test",
        page: "2",
        q: " Donor@Example.org ",
      }),
    ).toEqual({
      period: "all",
      interval: "MONTHLY",
      status: "REFUNDED",
      mode: "test",
      page: 2,
      q: "Donor@Example.org",
    });
  });
});
