"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FieldError } from "@/components/ui/FieldError";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import type { AppLocale } from "@/i18n/routing";
import { localizedHref } from "@/lib/i18n-path";
import {
  PRAYER_LIMITS,
  type PublicFormState,
} from "@/lib/validation/public-forms";
import { submitPrayerAction } from "@/server/actions/public-forms";
import { useFormErrorText } from "./form-messages";
import { FieldHint, FormAlert, Honeypot, SuccessPanel } from "./FormParts";
import { TurnstileWidget, type TurnstileHandle } from "./TurnstileWidget";

const FIELD_ORDER = ["name", "email", "body"] as const;
const id = (field: string) => `prayer-${field}`;
const errId = (field: string) => `prayer-${field}-error`;
const hintId = (field: string) => `prayer-${field}-hint`;

/** Public prayer request form (remounted by "Send another"). */
export function PrayerForm({ siteKey }: { siteKey: string }) {
  const [generation, setGeneration] = useState(0);
  return (
    <PrayerFormInner
      key={generation}
      siteKey={siteKey}
      onReset={() => setGeneration((n) => n + 1)}
    />
  );
}

function PrayerFormInner({
  siteKey,
  onReset,
}: {
  siteKey: string;
  onReset: () => void;
}) {
  const t = useTranslations("PrayerForm");
  const tForms = useTranslations("Forms");
  const errors = useFormErrorText();
  const locale = useLocale() as AppLocale;
  const [state, formAction, pending] = useActionState<
    PublicFormState,
    FormData
  >(submitPrayerAction, { status: "idle" });

  const [anonymous, setAnonymous] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState("");

  const alertRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);
  const handled = useRef<PublicFormState | null>(null);

  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const fieldError = (field: string) => errors.field(fieldErrors[field]);

  useEffect(() => {
    if (handled.current === state || state.status === "idle") return;
    handled.current = state;
    if (state.status === "success") {
      successRef.current?.focus();
      return;
    }
    // A token is single use: get a fresh one for the next attempt.
    turnstileRef.current?.reset();
    const first = FIELD_ORDER.find((f) => state.fieldErrors?.[f]);
    if (first) document.getElementById(id(first))?.focus();
    else alertRef.current?.focus();
  }, [state]);

  function onAnonymousChange(checked: boolean) {
    setAnonymous(checked);
    // Anonymous: the name and email are cleared, not just hidden.
    setName("");
    setEmail("");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  if (state.status === "success") {
    return (
      <SuccessPanel
        title={t("successTitle")}
        body={t("successBody")}
        onReset={onReset}
        headingRef={successRef}
      />
    );
  }

  const alert = state.status === "error" ? errors.form(state.code) : null;
  const optional = tForms("optional");

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label={t("formLabel")}
      aria-busy={pending || undefined}
      className="relative flex flex-col gap-6"
    >
      {alert ? <FormAlert ref={alertRef} message={alert} /> : null}

      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="turnstileToken" value={token} />
      <Honeypot idPrefix="prayer" />

      <div>
        <Checkbox
          id={id("anonymous")}
          name="isAnonymous"
          checked={anonymous}
          onChange={(e) => onAnonymousChange(e.currentTarget.checked)}
          label={t("anonymousLabel")}
          aria-describedby={hintId("anonymous")}
        />
        <div className="pl-8">
          <FieldHint id={hintId("anonymous")}>{t("anonymousHint")}</FieldHint>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <Label htmlFor={id("name")}>
            {t("nameLabel")}{" "}
            <span className="font-normal text-navy/75">({optional})</span>
          </Label>
          <Input
            id={id("name")}
            name="name"
            autoComplete="name"
            maxLength={PRAYER_LIMITS.name}
            className="mt-1.5 disabled:cursor-not-allowed disabled:border-dashed disabled:bg-beige/40"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            disabled={anonymous}
            invalid={!!fieldErrors.name}
            errorId={errId("name")}
            aria-describedby={anonymous ? hintId("anonymous") : undefined}
          />
          <FieldError id={errId("name")} message={fieldError("name")} />
        </div>
        <div>
          <Label htmlFor={id("email")}>
            {t("emailLabel")}{" "}
            <span className="font-normal text-navy/75">({optional})</span>
          </Label>
          <Input
            id={id("email")}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            maxLength={PRAYER_LIMITS.email}
            className="mt-1.5 disabled:cursor-not-allowed disabled:border-dashed disabled:bg-beige/40"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            disabled={anonymous}
            invalid={!!fieldErrors.email}
            errorId={errId("email")}
            aria-describedby={anonymous ? hintId("anonymous") : hintId("email")}
          />
          {anonymous ? null : (
            <FieldHint id={hintId("email")}>{t("emailHint")}</FieldHint>
          )}
          <FieldError id={errId("email")} message={fieldError("email")} />
        </div>
      </div>

      <div>
        <Label htmlFor={id("body")} required requiredText={tForms("required")}>
          {t("bodyLabel")}
        </Label>
        <Textarea
          id={id("body")}
          name="body"
          rows={7}
          required
          aria-required
          maxLength={PRAYER_LIMITS.body}
          className="mt-1.5"
          value={body}
          onChange={(e) => setBody(e.currentTarget.value)}
          invalid={!!fieldErrors.body}
          errorId={errId("body")}
          aria-describedby={hintId("body")}
        />
        <FieldHint id={hintId("body")}>
          {t("bodyHint", { max: PRAYER_LIMITS.body })}
        </FieldHint>
        <FieldError id={errId("body")} message={fieldError("body")} />
      </div>

      <div>
        <Checkbox
          id={id("consent")}
          name="shareConsent"
          checked={consent}
          onChange={(e) => setConsent(e.currentTarget.checked)}
          label={t("consentLabel")}
          aria-describedby={hintId("consent")}
        />
        <div className="pl-8">
          <FieldHint id={hintId("consent")}>{t("consentHint")}</FieldHint>
        </div>
      </div>

      <p className="rounded-md bg-beige/40 px-4 py-3 text-sm text-navy">
        {t.rich("privacyNotice", {
          link: (chunks) => (
            <Link
              href={localizedHref(locale, "/privacy")}
              className="font-medium underline decoration-gold-dark underline-offset-2"
            >
              {chunks}
            </Link>
          ),
        })}
      </p>

      <div>
        <TurnstileWidget
          ref={turnstileRef}
          siteKey={siteKey}
          action="prayer"
          onToken={setToken}
        />
        <FieldError
          id={errId("turnstile")}
          message={fieldError("turnstileToken")}
        />
      </div>

      <div>
        <Button
          type="submit"
          size="lg"
          aria-disabled={pending || undefined}
          disabled={pending}
          className="w-full sm:w-auto"
        >
          {pending ? tForms("sending") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
