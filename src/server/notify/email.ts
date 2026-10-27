import "server-only";
import { getSiteConfig } from "@/config/site";
import { log } from "@/lib/log";
import { getSiteSettings } from "@/lib/site-settings";

export const RESEND_URL = "https://api.resend.com/emails";

export type SubmissionKind = "prayer" | "contact";

const SUBJECTS: Record<SubmissionKind, string> = {
  prayer: "New prayer request",
  contact: "New contact message",
};
const NOUNS: Record<SubmissionKind, string> = {
  prayer: "prayer request",
  contact: "contact message",
};
const PATHS: Record<SubmissionKind, string> = {
  prayer: "/admin/inbox/prayer",
  contact: "/admin/inbox/messages",
};

/** Admin link for a new submission (the email carries nothing else). */
export function inboxLink(kind: SubmissionKind, id: string): string {
  const base = getSiteConfig().siteUrl.replace(/\/+$/, "");
  return `${base}${PATHS[kind]}/${encodeURIComponent(id)}`;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Notifies the admin about a new prayer request / contact message via
 * Resend. The email contains a link only: never the name, email, subject or
 * body. Without RESEND_API_KEY / RESEND_FROM_EMAIL it logs a redacted notice
 * and returns. Never throws; never logs the recipient or the key.
 */
export async function notifyNewSubmission(
  { kind, id }: { kind: SubmissionKind; id: string },
  {
    fetchImpl = fetch,
    env = process.env,
  }: {
    fetchImpl?: typeof fetch;
    env?: Record<string, string | undefined>;
  } = {},
): Promise<void> {
  try {
    const apiKey = env.RESEND_API_KEY?.trim();
    const from = env.RESEND_FROM_EMAIL?.trim();
    if (!apiKey || !from) {
      log.info("notify.email.skipped", {
        kind,
        id,
        reason: !apiKey
          ? "RESEND_API_KEY missing"
          : "RESEND_FROM_EMAIL missing",
      });
      return;
    }
    const to =
      env.CONTACT_TO_EMAIL?.trim() || (await getSiteSettings()).contactEmail;
    const link = inboxLink(kind, id);
    const text = `A new ${NOUNS[kind]} was received. Open the admin inbox to read it: ${link}`;
    const html = `<p>A new ${NOUNS[kind]} was received.</p><p><a href="${escapeHtml(link)}">Open the admin inbox to read it</a></p>`;

    const response = await fetchImpl(RESEND_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: SUBJECTS[kind],
        text,
        html,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      log.warn("notify.email.failed", { kind, id, status: response.status });
      return;
    }
    log.info("notify.email.sent", { kind, id });
  } catch (error) {
    log.warn("notify.email.error", { kind, id, name: (error as Error)?.name });
  }
}
