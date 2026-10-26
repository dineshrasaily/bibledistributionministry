"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { setEditorPasswordAction } from "@/server/actions/users";
import { TextField } from "./fields";
import { FormShell } from "./FormShell";
import { SubmitButton } from "./SubmitButton";

/** Owner sets a temporary password for an editor (signs them out everywhere). */
export function SetPasswordDialog({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="secondary" size="sm" className="min-h-11">
          Set temporary password<span className="sr-only"> for {name}</span>
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-navy/40" />
        <Dialog.Content
          aria-describedby={`pw-desc-${id}`}
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg border border-beige bg-white p-6 shadow-2xl focus:outline-none"
        >
          <Dialog.Title className="font-serif text-xl font-semibold break-words text-navy">
            Temporary password for {name}
          </Dialog.Title>
          <p id={`pw-desc-${id}`} className="text-sm text-navy/80">
            Share it with them in person or by phone. They are signed out now
            and can change it under Account after signing in.
          </p>
          <FormShell
            action={setEditorPasswordAction}
            label={`Temporary password for ${name}`}
            onSuccess={() => setOpen(false)}
          >
            <input type="hidden" name="id" value={id} />
            <TextField
              name="password"
              label="Temporary password"
              type="password"
              autoComplete="new-password"
              hint="At least 12 characters."
              required
            />
            <TextField
              name="confirmPassword"
              label="Repeat password"
              type="password"
              autoComplete="new-password"
              required
            />
            <div className="flex flex-wrap justify-end gap-3">
              <Dialog.Close asChild>
                <Button variant="secondary">Cancel</Button>
              </Dialog.Close>
              <SubmitButton>Set password</SubmitButton>
            </div>
          </FormShell>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
