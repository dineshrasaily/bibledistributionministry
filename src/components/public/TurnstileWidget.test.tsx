import { act, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import { TurnstileWidget, type TurnstileHandle } from "./TurnstileWidget";

vi.mock("next/script", () => ({ default: () => null }));

type Opts = Parameters<NonNullable<Window["turnstile"]>["render"]>[1];

function fakeTurnstile() {
  let opts: Opts | undefined;
  const api = {
    render: vi.fn((_el: HTMLElement, o: Opts) => {
      opts = o;
      return "widget-1";
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  };
  window.turnstile = api;
  return { api, opts: () => opts! };
}

afterEach(() => {
  window.turnstile = undefined;
});

function renderWidget(onToken: (t: string) => void) {
  const ref = createRef<TurnstileHandle>();
  const utils = render(
    <NextIntlClientProvider locale="en" messages={en}>
      <TurnstileWidget
        ref={ref}
        siteKey="site-key"
        action="prayer"
        onToken={onToken}
      />
    </NextIntlClientProvider>,
  );
  return { ...utils, ref };
}

describe("TurnstileWidget", () => {
  it("renders with the site key and action and forwards the token", () => {
    const { api, opts } = fakeTurnstile();
    const onToken = vi.fn();
    renderWidget(onToken);
    expect(api.render).toHaveBeenCalledTimes(1);
    expect(opts()).toMatchObject({
      sitekey: "site-key",
      action: "prayer",
      "response-field": false,
    });
    expect(screen.getByText("Checking that you're not a robot…")).toBeVisible();
    act(() => opts().callback("tok"));
    expect(onToken).toHaveBeenLastCalledWith("tok");
    expect(screen.queryByText("Checking that you're not a robot…")).toBeNull();
  });

  it("clears the token on expiry and shows an error on failure", () => {
    const { opts } = fakeTurnstile();
    const onToken = vi.fn();
    renderWidget(onToken);
    act(() => opts()["expired-callback"]());
    expect(onToken).toHaveBeenLastCalledWith("");
    act(() => opts()["error-callback"]());
    expect(
      screen.getByText(/The spam check could not load/),
    ).toBeInTheDocument();
  });

  it("reset() resets the widget and clears the token; unmount removes it", () => {
    const { api } = fakeTurnstile();
    const onToken = vi.fn();
    const { ref, unmount } = renderWidget(onToken);
    act(() => ref.current!.reset());
    expect(api.reset).toHaveBeenCalledWith("widget-1");
    expect(onToken).toHaveBeenLastCalledWith("");
    unmount();
    expect(api.remove).toHaveBeenCalledWith("widget-1");
  });

  it("labels the widget container", () => {
    fakeTurnstile();
    renderWidget(vi.fn());
    expect(screen.getByRole("group", { name: "Spam check" })).toBeVisible();
  });
});
