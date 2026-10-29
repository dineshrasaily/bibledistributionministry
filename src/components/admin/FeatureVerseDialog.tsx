"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { setFeaturedVerseAction } from "@/server/actions/verses";
import { TextField } from "./fields";
import { FormShell } from "./FormShell";
import { SubmitButton } from "./SubmitButton";

/** "Feature on…" row action: picks the date (site time zone) this verse is the verse of the day. */
export function FeatureVerseDialog({
  id,
  reference,
  defaultDate,
  timeZone,
}: {
  id: string;
  reference: string;
  /** YYYY-MM-DD, today in the site time zone. */
  defaultDate: string;
  /** The Settings time zone, e.g. "America/New_York". */
  timeZone: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="secondary" size="sm" className="min-h-11">
          Feature on…<span className="sr-only"> {reference}</span>
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-navy/40" />
        <Dialog.Content
          aria-describedby={`feature-desc-${id}`}
          className="fixed top-1/2 left-1/2 z-50 flex w-[min(26rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg border border-beige bg-white p-6 shadow-2xl focus:outline-none"
        >
          <Dialog.Title className="font-serif text-xl font-semibold text-navy">
            Feature {reference}
          </Dialog.Title>
          <p id={`feature-desc-${id}`} className="text-sm text-navy/80">
            Choose the day ({timeZone}) this verse shows as the verse of the day
            on the home page. It replaces the automatic verse for that day.
          </p>
          <FormShell
            action={setFeaturedVerseAction}
            label={`Feature ${reference}`}
            onSuccess={() => setOpen(false)}
          >
            <input type="hidden" name="id" value={id} />
            <TextField
              name="date"
              label="Date"
              type="date"
              defaultValue={defaultDate}
              required
            />
            <div className="flex flex-wrap justify-end gap-3">
              <Dialog.Close asChild>
                <Button variant="secondary">Cancel</Button>
              </Dialog.Close>
              <SubmitButton variant="gold">Feature</SubmitButton>
            </div>
          </FormShell>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
