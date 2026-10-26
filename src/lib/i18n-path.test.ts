import { describe, expect, it } from "vitest";
import { localizedHref, stripLocale, switchLocalePath } from "./i18n-path";

describe("stripLocale", () => {
  it.each([
    ["/en", "/"],
    ["/ne/", "/"],
    ["/en/about", "/about"],
    ["/ne/missions/trips", "/missions/trips"],
    ["/about", "/about"],
    ["/", "/"],
    ["", "/"],
    ["/english-page", "/english-page"],
  ])("%s -> %s", (input, expected) => {
    expect(stripLocale(input)).toBe(expected);
  });
});

describe("switchLocalePath", () => {
  it.each([
    ["/en", "ne", "/ne"],
    ["/ne", "en", "/en"],
    ["/en/about", "ne", "/ne/about"],
    ["/ne/missions/", "en", "/en/missions"],
    ["/", "ne", "/ne"],
    ["", "ne", "/ne"],
    ["/about", "ne", "/ne/about"],
    ["/english-page", "ne", "/ne/english-page"],
    ["/en/media", "en", "/en/media"],
  ] as const)("%s to %s -> %s", (input, target, expected) => {
    expect(switchLocalePath(input, target)).toBe(expected);
  });
});

describe("localizedHref", () => {
  it.each([
    ["en", "/", "/en"],
    ["ne", "/", "/ne"],
    ["en", "/about", "/en/about"],
    ["ne", "/support", "/ne/support"],
  ] as const)("(%s, %s) -> %s", (locale, href, expected) => {
    expect(localizedHref(locale, href)).toBe(expected);
  });
});
