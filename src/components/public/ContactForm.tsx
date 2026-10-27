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
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { AppLocale } from "@/i18n/routing";
import { localizedHref } from "@/lib/i18n-path";
import {
  CONTACT_LIMITS,
  type PublicFormState,
} from "@/lib/validation/public-forms";
import { submitContactAction } from "@/server/actions/public-forms";
import { useFormErrorText } from "./form-messages";
import { FieldHint, FormAlert, Honeypot, SuccessPanel } from "./FormParts";
import { TurnstileWidget, type TurnstileHandle } from "./TurnstileWidget";

const KINDS = ["GENERAL", "TESTIMONY", "VOLUNTEER"] as const;
type Kind = (typeof KINDS)[number];

const FIELD_ORDER = ["name", "email", "kind", "subject", "message"] as const;
const id = (field: string) => `contact-${field}`;
const errId = (field: string) => `contact-${field}-error`;
const hintId = (field: string) => `contact-${field}-hint`;

/** Public contact form (remounted by "Send another"). */
export function ContactForm({ siteKey }: { siteKey: string }) {
  const [generation, setGeneration] = useState(0);
  return (
    <ContactFormInner
      key={generation}
      siteKey={siteKey}
      onReset={() => setGeneration((n) => n + 1)}
    />
  );
}

function ContactFormInner({
  siteKey,
  onReset,
}: {
  siteKey: string;
  onReset: () => void;
}) {
  const t = useTranslations("ContactForm");
  const tForms = useTranslations("Forms");
  const errors = useFormErrorText();
  const locale = useLocale() as AppLocale;
  const [state, formAction, pending] = useActionState<
    PublicFormState,
    FormData
  >(submitContactAction, { status: "idle" });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [kind, setKind] = useState<Kind>("GENERAL");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
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
    turnstileRef.current?.reset();
    const first = FIELD_ORDER.find((f) => state.fieldErrors?.[f]);
    if (first) document.getElementById(id(first))?.focus();
    else alertRef.current?.focus();
  }, [state]);

  function onKindChange(value: Kind) {
    setKind(value);
    // Consent is only offered for testimonies and never carried over.
    if (value !== "TESTIMONY") setConsent(false);
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
  const required = tForms("required");

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
      <Honeypot idPrefix="contact" />

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <Label htmlFor={id("name")} required requiredText={required}>
            {t("nameLabel")}
          </Label>
          <Input
            id={id("name")}
            name="name"
            autoComplete="name"
            required
            aria-required
            maxLength={CONTACT_LIMITS.name}
            className="mt-1.5"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            invalid={!!fieldErrors.name}
            errorId={errId("name")}
          />
          <FieldError id={errId("name")} message={fieldError("name")} />
        </div>
        <div>
          <Label htmlFor={id("email")} required requiredText={required}>
            {t("emailLabel")}
          </Label>
          <Input
            id={id("email")}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            aria-required
            maxLength={CONTACT_LIMITS.email}
            className="mt-1.5"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            invalid={!!fieldErrors.email}
            errorId={errId("email")}
            aria-describedby={hintId("email")}
          />
          <FieldHint id={hintId("email")}>{t("emailHint")}</FieldHint>
          <FieldError id={errId("email")} message={fieldError("email")} />
        </div>
      </div>

      <div>
        <Label htmlFor={id("kind")}>{t("kindLabel")}</Label>
        <Select
          id={id("kind")}
          name="kind"
          className="mt-1.5 sm:max-w-xs"
          value={kind}
          onChange={(e) => onKindChange(e.currentTarget.value as Kind)}
          invalid={!!fieldErrors.kind}
          errorId={errId("kind")}
          aria-describedby={kind === "VOLUNTEER" ? hintId("kind") : undefined}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`kinds.${k}`)}
            </option>
          ))}
        </Select>
        {kind === "VOLUNTEER" ? (
          <FieldHint id={hintId("kind")}>
            {t.rich("volunteerHint", {
              link: (chunks) => (
                <Link
                  href={localizedHref(locale, "/missions")}
                  className="font-medium underline decoration-gold-dark underline-offset-2"
                >
                  {chunks}
                </Link>
              ),
            })}
          </FieldHint>
        ) : null}
        <FieldError id={errId("kind")} message={fieldError("kind")} />
      </div>

      <div>
        <Label htmlFor={id("subject")} required requiredText={required}>
          {t("subjectLabel")}
        </Label>
        <Input
          id={id("subject")}
          name="subject"
          required
          aria-required
          maxLength={CONTACT_LIMITS.subject}
          className="mt-1.5"
          value={subject}
          onChange={(e) => setSubject(e.currentTarget.value)}
          invalid={!!fieldErrors.subject}
          errorId={errId("subject")}
        />
        <FieldError id={errId("subject")} message={fieldError("subject")} />
      </div>

      <div>
        <Label htmlFor={id("message")} required requiredText={required}>
          {t("messageLabel")}
        </Label>
        <Textarea
          id={id("message")}
          name="message"
          rows={7}
          required
          aria-required
          maxLength={CONTACT_LIMITS.message}
          className="mt-1.5"
          value={message}
          onChange={(e) => setMessage(e.currentTarget.value)}
          invalid={!!fieldErrors.message}
          errorId={errId("message")}
          aria-describedby={hintId("message")}
        />
        <FieldHint id={hintId("message")}>
          {t("messageHint", { max: CONTACT_LIMITS.message })}
        </FieldHint>
        <FieldError id={errId("message")} message={fieldError("message")} />
      </div>

      {kind === "TESTIMONY" ? (
        <div data-testid="testimony-consent">
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
      ) : null}

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
          action="contact"
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
