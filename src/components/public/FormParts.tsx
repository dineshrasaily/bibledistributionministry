"use client";

import { useTranslations } from "next-intl";
import type { ReactNode, Ref } from "react";
import { Button } from "@/components/ui/Button";

/** Off-screen trap field. Real people never see or fill it. */
export function Honeypot({ idPrefix }: { idPrefix: string }) {
  const t = useTranslations("Forms");
  return (
    <div
      aria-hidden="true"
      className="absolute -left-[10000px] h-px w-px overflow-hidden"
    >
      <label htmlFor={`${idPrefix}-website`}>{t("honeypotLabel")}</label>
      <input
        id={`${idPrefix}-website`}
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        defaultValue=""
      />
    </div>
  );
}

/** Small muted hint under a field. */
export function FieldHint({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return (
    <p id={id} className="mt-1.5 text-sm text-navy/75">
      {children}
    </p>
  );
}

/** Form-level error (focus target when no single field is to blame). */
export function FormAlert({
  message,
  ref,
}: {
  message: string;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      data-testid="form-alert"
      className="rounded-lg border border-red-700 bg-white px-4 py-3 font-medium text-red-800 focus:outline-2 focus:outline-offset-2 focus:outline-red-700"
    >
      {message}
    </div>
  );
}

/** Success panel that replaces the form; its heading receives focus. */
export function SuccessPanel({
  title,
  body,
  onReset,
  headingRef,
}: {
  title: string;
  body: string;
  onReset: () => void;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const t = useTranslations("Forms");
  return (
    <div
      data-testid="form-success"
      className="flex flex-col items-start gap-4 rounded-lg border border-gold/60 bg-ivory px-6 py-8"
    >
      <span aria-hidden="true" className="gold-rule" />
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="font-serif text-2xl font-semibold text-navy focus:outline-none"
      >
        {title}
      </h2>
      <p className="text-lg text-navy/85">{body}</p>
      <Button variant="secondary" onClick={onReset}>
        {t("sendAnother")}
      </Button>
    </div>
  );
}
