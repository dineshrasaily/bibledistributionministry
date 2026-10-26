"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

/** "JBSWY3DPEHPK3PXP" -> "JBSW Y3DP EHPK 3PXP" */
export function groupSecret(secret: string): string {
  return secret.replace(/(.{4})(?=.)/g, "$1 ");
}

/** QR code (server-rendered SVG) + grouped secret + copy button. */
export function QrSetup({ qrSvg, secret }: { qrSvg: string; secret: string }) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        role="img"
        aria-label="QR code for your authenticator app"
        className="size-48 rounded-md border border-beige bg-white p-2 [&_svg]:size-full"
        // SVG generated on the server by the qrcode package from the otpauth URI.
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />
      <div className="flex w-full flex-col items-center gap-2 text-center">
        <p className="text-sm text-navy/80">
          Can&apos;t scan? Enter this key in the app instead:
        </p>
        <code
          data-testid="totp-secret"
          className="rounded bg-beige/60 px-3 py-2 font-mono text-base tracking-wider break-all text-navy"
        >
          {groupSecret(secret)}
        </code>
        <Button type="button" variant="secondary" size="sm" onClick={copy}>
          Copy key
        </Button>
        <p role="status" className="min-h-5 text-sm text-navy/80">
          {copied === "done"
            ? "Key copied."
            : copied === "failed"
              ? "Copying isn't available here. Select the key above and copy it."
              : ""}
        </p>
      </div>
    </div>
  );
}
