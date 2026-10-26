"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  cancelLoginAction,
  completeLoginAction,
  startLoginAction,
} from "@/server/actions/auth";
import type { LoginState } from "@/server/auth/login";
import { QrSetup } from "./QrSetup";

type State = LoginState & { email?: string };

/** Routes each submit to the matching login action; keeps enrolment data. */
async function loginReducer(
  prev: State | null,
  formData: FormData,
): Promise<State> {
  const kind = formData.get("_kind");
  if (kind === "cancel") {
    return { ...(await cancelLoginAction()), email: prev?.email };
  }
  if (kind === "start") {
    const result = await startLoginAction(prev, formData);
    return { ...result, email: String(formData.get("email") ?? "") };
  }
  const result = await completeLoginAction(prev, formData);
  return {
    ...result,
    // An invalid code returns no enrolment data: keep the QR on screen.
    enrollment:
      result.enrollment ??
      (result.step === "enroll" ? prev?.enrollment : undefined),
    email: prev?.email,
  };
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-red-700 bg-white px-4 py-3 text-sm font-medium text-red-800"
    >
      {message}
    </div>
  );
}

export function LoginForm({ next }: { next: string | null }) {
  const [state, dispatch, pending] = useActionState(loginReducer, null);
  const step = state?.step ?? "credentials";

  if (step === "credentials") {
    const emailError = state?.fieldErrors?.email;
    const passwordError = state?.fieldErrors?.password;
    return (
      <form action={dispatch} className="flex flex-col gap-5" noValidate>
        <input type="hidden" name="_kind" value="start" />
        <input type="hidden" name="next" value={next ?? ""} />
        <FormError message={state?.formError} />
        <div>
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            defaultValue={state?.email ?? ""}
            required
            invalid={!!emailError}
            errorId="login-email-error"
            className="mt-1.5"
          />
          <FieldError id="login-email-error" message={emailError} />
        </div>
        <div>
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            invalid={!!passwordError}
            errorId="login-password-error"
            className="mt-1.5"
          />
          <FieldError id="login-password-error" message={passwordError} />
        </div>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    );
  }

  const enrolling = step === "enroll";
  const codeError = state?.fieldErrors?.code;

  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-serif text-xl font-semibold text-navy">
        {enrolling
          ? "Set up your authenticator app"
          : "Enter your authenticator code"}
      </h2>
      {enrolling ? (
        <div className="flex flex-col gap-4 text-sm text-navy/85">
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Install an authenticator app on your phone, such as Google
              Authenticator, Microsoft Authenticator or 1Password.
            </li>
            <li>In the app, add an account and scan this QR code.</li>
            <li>Type the 6-digit code the app shows below.</li>
          </ol>
          {state?.enrollment ? (
            <QrSetup
              qrSvg={state.enrollment.qrSvg}
              secret={state.enrollment.secret}
            />
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-navy/85">
          Open your authenticator app and type the 6-digit code for this site.
        </p>
      )}
      <form action={dispatch} className="flex flex-col gap-5" noValidate>
        <input type="hidden" name="_kind" value="complete" />
        <input
          type="hidden"
          name="step"
          value={enrolling ? "enroll" : "verify"}
        />
        <input type="hidden" name="next" value={next ?? ""} />
        <FormError message={state?.formError} />
        <div>
          <Label htmlFor="login-code">Authenticator code</Label>
          <Input
            id="login-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            autoFocus
            required
            invalid={!!codeError}
            errorId="login-code-error"
            className="mt-1.5 text-center font-mono text-xl tracking-[0.3em]"
          />
          <FieldError id="login-code-error" message={codeError} />
        </div>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Checking…" : "Verify"}
        </Button>
      </form>
      <form action={dispatch}>
        <input type="hidden" name="_kind" value="cancel" />
        <Button
          type="submit"
          variant="ghost"
          disabled={pending}
          className="w-full"
        >
          Start over
        </Button>
      </form>
    </div>
  );
}
