/**
 * Site time zone options (Admin -> Settings -> Verse of the day).
 * Pure module: no server-only / next imports.
 */

export const DEFAULT_SITE_TIME_ZONE = "America/New_York";

/** Shown first in the select, with friendly labels. */
export const COMMON_TIME_ZONES: readonly { value: string; label: string }[] = [
  { value: "America/New_York", label: "Eastern Time (America/New_York)" },
  { value: "America/Chicago", label: "Central Time (America/Chicago)" },
  { value: "America/Denver", label: "Mountain Time (America/Denver)" },
  { value: "America/Phoenix", label: "Arizona (America/Phoenix)" },
  { value: "America/Los_Angeles", label: "Pacific Time (America/Los_Angeles)" },
  { value: "America/Anchorage", label: "Alaska (America/Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii (Pacific/Honolulu)" },
  { value: "Asia/Kathmandu", label: "Nepal (Asia/Kathmandu)" },
  { value: "UTC", label: "UTC" },
];

/** Legacy aliases that duplicate a common zone above. */
const HIDDEN_ALIASES = new Set(["Asia/Katmandu", "Etc/UTC"]);

function supportedZones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [];
  }
}

/**
 * True for IANA zones the runtime knows. Node's
 * `Intl.supportedValuesOf("timeZone")` lists legacy names ("Asia/Katmandu")
 * and leaves out "UTC", so the common list and a formatter probe count too.
 */
export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value === "" || value.length > 64) {
    return false;
  }
  const listed =
    supportedZones().includes(value) ||
    COMMON_TIME_ZONES.some((z) => z.value === value);
  if (!listed) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Common zones first, then every other supported zone alphabetically. */
export function timeZoneOptions(): { value: string; label: string }[] {
  const common = new Set(COMMON_TIME_ZONES.map((z) => z.value));
  const rest = supportedZones()
    .filter((z) => !common.has(z) && !HIDDEN_ALIASES.has(z))
    .toSorted((a, b) => a.localeCompare(b))
    .map((z) => ({ value: z, label: z.replaceAll("_", " ") }));
  return [...COMMON_TIME_ZONES, ...rest];
}
