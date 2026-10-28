import { resolveStripeConfig } from "@/lib/donations/stripe-config";
import { log } from "@/lib/log";
import { getStripeClient } from "@/server/donations/stripe-client";
import {
  processStripeEvent,
  verifyStripeEvent,
} from "@/server/donations/webhook";

/**
 * Stripe webhook endpoint. Machine-to-machine: not localized (the proxy
 * skips /api), no session, no CSRF/origin check; authenticity comes from
 * the Stripe-Signature HMAC over the exact raw body bytes.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1024 * 1024;

const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** The raw body bytes, or null when over the cap (also for chunked bodies). */
async function readRawBody(request: Request): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function POST(request: Request): Promise<Response> {
  const config = resolveStripeConfig(process.env);
  if (!config.webhookReady) {
    log.warn("stripe.webhook.not_configured", { secretKey: config.secretKey });
    return json(503, { error: "NOT_CONFIGURED" });
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return json(413, { error: "PAYLOAD_TOO_LARGE" });
  }
  const raw = await readRawBody(request);
  if (raw === null) return json(413, { error: "PAYLOAD_TOO_LARGE" });

  let event;
  try {
    event = verifyStripeEvent(
      Buffer.from(raw),
      request.headers.get("stripe-signature"),
      process.env.STRIPE_WEBHOOK_SECRET!.trim(),
    );
  } catch {
    log.warn("stripe.webhook.invalid_signature");
    return json(400, { error: "INVALID_SIGNATURE" });
  }

  try {
    const { outcome } = await processStripeEvent(event, {
      client: getStripeClient(process.env),
    });
    return json(
      200,
      outcome === "duplicate"
        ? { received: true, duplicate: true }
        : { received: true, outcome },
    );
  } catch (error) {
    log.error("stripe.webhook.failed", {
      event: event.id,
      type: event.type,
      name: (error as Error)?.name,
    });
    return json(500, { error: "PROCESSING_FAILED" });
  }
}
