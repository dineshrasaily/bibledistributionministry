"use client";

import Script from "next/script";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";

export const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type RenderOptions = {
  sitekey: string;
  action: string;
  size: "flexible";
  "response-field": boolean;
  language?: string;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
};

export type TurnstileApi = {
  render: (el: HTMLElement, options: RenderOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type TurnstileHandle = { reset: () => void };

type Status = "loading" | "verified" | "error";

/**
 * Cloudflare Turnstile (explicit render). The token is handed to the form
 * through `onToken` and verified server-side; an empty string means "no
 * valid token" (expired, error or reset).
 */
export function TurnstileWidget({
  siteKey,
  action,
  onToken,
  ref,
}: {
  siteKey: string;
  action: string;
  onToken: (token: string) => void;
  ref?: Ref<TurnstileHandle>;
}) {
  const t = useTranslations("Turnstile");
  const tErrors = useTranslations("FormErrors");
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  const renderWidget = useCallback(() => {
    const api = window.turnstile;
    if (!api || !containerRef.current || widgetId.current !== null) return;
    widgetId.current = api.render(containerRef.current, {
      sitekey: siteKey,
      action,
      size: "flexible",
      "response-field": false,
      language: document.documentElement.lang || undefined,
      callback: (token) => {
        setStatus("verified");
        onTokenRef.current(token);
      },
      "expired-callback": () => {
        setStatus("loading");
        onTokenRef.current("");
      },
      "error-callback": () => {
        setStatus("error");
        onTokenRef.current("");
      },
    });
  }, [siteKey, action]);

  useEffect(() => {
    renderWidget();
    return () => {
      if (widgetId.current !== null) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [renderWidget]);

  useImperativeHandle(
    ref,
    () => ({
      reset() {
        onTokenRef.current("");
        if (widgetId.current !== null && window.turnstile) {
          setStatus("loading");
          window.turnstile.reset(widgetId.current);
        }
      },
    }),
    [],
  );

  return (
    <div className="flex flex-col gap-2">
      <Script
        src={TURNSTILE_SCRIPT_SRC}
        strategy="afterInteractive"
        onReady={renderWidget}
        onError={() => setStatus("error")}
      />
      <div
        ref={containerRef}
        role="group"
        aria-label={t("label")}
        data-testid="turnstile"
        className="min-h-[65px] w-full max-w-full"
      />
      <p aria-live="polite" className="text-sm text-navy/75">
        {status === "loading" ? t("loading") : null}
        {status === "error" ? (
          <span className="font-medium text-red-800">
            {tErrors("turnstileLoadFailed")}
          </span>
        ) : null}
      </p>
    </div>
  );
}
