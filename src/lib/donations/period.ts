/**
 * Admin donation report periods, computed in UTC as half-open ranges
 * [from, to). Pure module.
 */
export const DONATION_PERIODS = [
  "this-month",
  "last-month",
  "last-30-days",
  "this-year",
  "last-year",
  "all",
] as const;

export type DonationPeriod = (typeof DONATION_PERIODS)[number];

export const PERIOD_LABELS: Record<DonationPeriod, string> = {
  "this-month": "This month",
  "last-month": "Last month",
  "last-30-days": "Last 30 days",
  "this-year": "This year",
  "last-year": "Last year",
  all: "All time",
};

export type PeriodRange = { from?: Date; to?: Date };

const DAY_MS = 86_400_000;

export function periodRange(period: DonationPeriod, now: Date): PeriodRange {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  switch (period) {
    case "this-month":
      return {
        from: new Date(Date.UTC(y, m, 1)),
        to: new Date(Date.UTC(y, m + 1, 1)),
      };
    case "last-month":
      return {
        from: new Date(Date.UTC(y, m - 1, 1)),
        to: new Date(Date.UTC(y, m, 1)),
      };
    case "last-30-days":
      return {
        from: new Date(now.getTime() - 30 * DAY_MS),
        to: new Date(now.getTime() + 1),
      };
    case "this-year":
      return {
        from: new Date(Date.UTC(y, 0, 1)),
        to: new Date(Date.UTC(y + 1, 0, 1)),
      };
    case "last-year":
      return {
        from: new Date(Date.UTC(y - 1, 0, 1)),
        to: new Date(Date.UTC(y, 0, 1)),
      };
    case "all":
      return {};
  }
}
