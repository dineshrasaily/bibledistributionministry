"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import type { AppLocale } from "@/i18n/routing";
import {
  DONATION_PRESETS_USD,
  formatPresetUsd,
  MAX_USD,
  MIN_USD,
} from "@/lib/donations/amount";
import { cn } from "@/lib/cn";
import {
  CUSTOM_AMOUNT,
  type DonationFormState,
} from "@/lib/validation/donations";
import { startCheckoutAction } from "@/server/actions/public-donations";
import { useDonationErrorText } from "./form-messages";
import { FieldHint, FormAlert, Honeypot } from "./FormParts";

type Interval = "ONE_TIME" | "MONTHLY";

const PREFIX = "donation";
const errId = (field: string) => `${PREFIX}-${field}-error`;
const CUSTOM_ID = `${PREFIX}-customAmount`;
const CUSTOM_HINT_ID = `${PREFIX}-customAmount-hint`;
const MONTHLY_HINT_ID = `${PREFIX}-monthly-hint`;
const amountId = (value: string) => `${PREFIX}-amount-${value}`;

/** Pill-styled radio: the native input stays in the a11y tree (sr-only). */
function Pill({
  id,
  name,
  value,
  checked,
  onChange,
  describedBy,
  children,
}: {
  id: string;
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  describedBy?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={id} className="relative cursor-pointer">
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        aria-describedby={describedBy}
        className="peer sr-only"
      />
      <span
        className={cn(
          "flex min-h-12 items-center justify-center rounded-full border px-5 text-lg font-semibold transition-colors motion-reduce:transition-none",
          "border-navy/30 bg-white text-navy hover:border-navy",
          "peer-checked:border-navy peer-checked:bg-navy peer-checked:text-white",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-gold-dark",
        )}
      >
        {children}
      </span>
    </label>
  );
}

/** Public giving form: picks frequency + amount, then opens Stripe Checkout. */
export function DonationForm() {
  const t = useTranslations("DonationForm");
  const errors = useDonationErrorText();
  const locale = useLocale() as AppLocale;
  const [state, formAction, pending] = useActionState<
    DonationFormState,
    FormData
  >(startCheckoutAction, { status: "idle" });

  const [interval, setFrequency] = useState<Interval>("ONE_TIME");
  const [choice, setChoice] = useState<string>("");
  const [custom, setCustom] = useState("");

  const alertRef = useRef<HTMLDivElement>(null);
  const handled = useRef<DonationFormState | null>(null);
  const focusCustom = useRef(false);

  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const fieldError = (field: string) => errors.field(fieldErrors[field]);
  const isCustom = choice === CUSTOM_AMOUNT;

  useEffect(() => {
    if (handled.current === state || state.status === "idle") return;
    handled.current = state;
    if (state.fieldErrors?.customAmount) {
      document.getElementById(CUSTOM_ID)?.focus();
    } else if (state.fieldErrors?.amountChoice) {
      document
        .getElementById(amountId(String(DONATION_PRESETS_USD[0])))
        ?.focus();
    } else if (state.fieldErrors?.interval) {
      document.getElementById(`${PREFIX}-interval-ONE_TIME`)?.focus();
    } else {
      alertRef.current?.focus();
    }
  }, [state]);

  // Choosing "Other amount" moves focus to the amount input.
  useEffect(() => {
    if (isCustom && focusCustom.current) {
      focusCustom.current = false;
      document.getElementById(CUSTOM_ID)?.focus();
    }
  }, [isCustom]);

  function onChoice(value: string) {
    if (value === CUSTOM_AMOUNT) focusCustom.current = true;
    setChoice(value);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const alert = state.status === "error" ? errors.form(state.code) : null;
  const amountError = fieldError("amountChoice");
  const customError = fieldError("customAmount");
  const intervalError = fieldError("interval");
  const monthly = interval === "MONTHLY";

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label={t("formLabel")}
      aria-busy={pending || undefined}
      className="relative flex flex-col gap-7"
    >
      {alert ? <FormAlert ref={alertRef} message={alert} /> : null}

      <input type="hidden" name="locale" value={locale} />
      <Honeypot idPrefix={PREFIX} />

      <fieldset
        aria-describedby={
          [
            monthly ? MONTHLY_HINT_ID : null,
            intervalError ? errId("interval") : null,
          ]
            .filter(Boolean)
            .join(" ") || undefined
        }
      >
        <legend className="mb-3 text-base font-semibold text-navy">
          {t("frequencyLegend")}
        </legend>
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          {(["ONE_TIME", "MONTHLY"] as const).map((value) => (
            <Pill
              key={value}
              id={`${PREFIX}-interval-${value}`}
              name="interval"
              value={value}
              checked={interval === value}
              onChange={(v) => setFrequency(v as Interval)}
            >
              {value === "ONE_TIME" ? t("oneTime") : t("monthly")}
            </Pill>
          ))}
        </div>
        {monthly ? (
          <FieldHint id={MONTHLY_HINT_ID}>{t("monthlyHint")}</FieldHint>
        ) : null}
        <FieldError id={errId("interval")} message={intervalError} />
      </fieldset>

      <fieldset
        aria-describedby={amountError ? errId("amountChoice") : undefined}
      >
        <legend className="mb-3 text-base font-semibold text-navy">
          {t("amountLegend")}
        </legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {DONATION_PRESETS_USD.map((usd) => (
            <Pill
              key={usd}
              id={amountId(String(usd))}
              name="amountChoice"
              value={String(usd)}
              checked={choice === String(usd)}
              onChange={onChoice}
            >
              {formatPresetUsd(usd, locale)}
            </Pill>
          ))}
          <div className="col-span-2 sm:col-span-2">
            <Pill
              id={amountId(CUSTOM_AMOUNT)}
              name="amountChoice"
              value={CUSTOM_AMOUNT}
              checked={isCustom}
              onChange={onChoice}
            >
              {t("otherAmount")}
            </Pill>
          </div>
        </div>
        <FieldError id={errId("amountChoice")} message={amountError} />

        {/* Hidden (not removed) when a preset is chosen, so the value is kept. */}
        <div hidden={!isCustom} className="mt-5 sm:max-w-xs">
          <Label htmlFor={CUSTOM_ID}>{t("otherAmountLabel")}</Label>
          <div className="relative mt-1.5">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-lg text-navy/75"
            >
              $
            </span>
            <Input
              id={CUSTOM_ID}
              name="customAmount"
              inputMode="decimal"
              autoComplete="off"
              maxLength={12}
              className="pl-8 text-lg"
              value={custom}
              onChange={(e) => setCustom(e.currentTarget.value)}
              invalid={!!customError}
              errorId={errId("customAmount")}
              aria-describedby={CUSTOM_HINT_ID}
            />
          </div>
          <FieldHint id={CUSTOM_HINT_ID}>
            {t("amountHint", {
              min: formatPresetUsd(MIN_USD, locale),
              max: formatPresetUsd(MAX_USD, locale),
            })}
          </FieldHint>
          <FieldError id={errId("customAmount")} message={customError} />
        </div>
      </fieldset>

      <div className="flex flex-col gap-3">
        <Button
          type="submit"
          size="lg"
          variant="gold"
          aria-disabled={pending || undefined}
          disabled={pending}
          className="w-full sm:w-auto sm:self-start"
        >
          {pending
            ? t("opening")
            : monthly
              ? t("submitMonthly")
              : t("submitOneTime")}
        </Button>
        <p className="text-sm text-navy/75">{t("finishOnStripe")}</p>
      </div>
    </form>
  );
}
