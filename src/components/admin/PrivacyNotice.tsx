import { Badge } from "@/components/ui/Badge";

export const PRIVACY_TEXT =
  "Prayer requests and messages are private. Only share them with people the sender has agreed to. Never copy them into public posts unless the sender gave sharing consent.";

export function PrivacyNotice() {
  return (
    <div
      role="note"
      className="mb-6 rounded-lg border border-gold/60 bg-beige/40 px-4 py-3 text-sm text-navy"
    >
      <p>
        <span className="font-semibold">Private: </span>
        {PRIVACY_TEXT}
      </p>
    </div>
  );
}

export function ConsentBadge({ consent }: { consent: boolean }) {
  return (
    <Badge variant={consent ? "navy" : "neutral"}>
      Sharing consent: {consent ? "yes" : "no"}
    </Badge>
  );
}
