/**
 * Inbox retention helpers. Pure module.
 */
export const RETENTION_MIN = 1;
export const RETENTION_MAX = 60;

/**
 * `now` minus `months` calendar months in UTC. The day is clamped to the
 * target month's length (Mar 31 - 1 month -> Feb 28/29).
 */
export function retentionCutoff(now: Date, months: number): Date {
  const total = now.getUTCFullYear() * 12 + now.getUTCMonth() - months;
  const year = Math.floor(total / 12);
  const month = total - year * 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(now.getUTCDate(), lastDay),
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds(),
      now.getUTCMilliseconds(),
    ),
  );
}
