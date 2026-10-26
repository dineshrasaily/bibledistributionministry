/**
 * Structured server logging: one JSON line per event.
 * Never log passwords, codes, TOTP secrets, tokens, raw IPs, prayer/message
 * bodies or email addresses of the public.
 */
type Fields = Record<string, unknown>;
type Level = "info" | "warn" | "error";

function write(level: Level, event: string, fields: Fields): void {
  console[level](JSON.stringify({ level, event, ...fields }));
}

export const log = {
  info: (event: string, fields: Fields = {}) => write("info", event, fields),
  warn: (event: string, fields: Fields = {}) => write("warn", event, fields),
  error: (event: string, fields: Fields = {}) => write("error", event, fields),
};
