import { describe, expect, it } from "vitest"

import {
  DEFAULT_LOCALE,
  formatDate,
  getAlternates,
  getAnchor,
  getOpenGraphLocale,
  getPageSlug,
  isLocale,
  localizeHref,
} from "@/libs/i18n"

describe("isLocale", () => {
  it("accepts every supported locale", () => {
    expect(isLocale("en")).toBe(true)
    expect(isLocale("es")).toBe(true)
  })

  it("rejects anything else", () => {
    expect(isLocale("fr")).toBe(false)
    expect(isLocale(undefined)).toBe(false)
    expect(isLocale(42)).toBe(false)
  })
})

describe("getPageSlug", () => {
  it("reads the segment a page is served under in each locale", () => {
    expect(getPageSlug("privacy", "en")).toBe("privacy")
    expect(getPageSlug("privacy", "es")).toBe("privacidad")
  })
})

describe("getAnchor", () => {
  it("reads a section's id in the given locale", () => {
    expect(getAnchor("roadmap", "es")).toBe("hoja-de-ruta")
  })

  it("falls back to the default locale", () => {
    expect(getAnchor("roadmap")).toBe("roadmap")
    expect(getAnchor("roadmap", "fr")).toBe("roadmap")
  })
})

describe("localizeHref", () => {
  it("serves the default locale at the root, with no prefix", () => {
    expect(DEFAULT_LOCALE).toBe("en")
    expect(localizeHref("/privacy/", "en")).toBe("/privacy/")
    expect(localizeHref("/", "en")).toBe("/")
  })

  it("prefixes and translates a page for another locale", () => {
    expect(localizeHref("/privacy/", "es")).toBe("/es/privacidad/")
    expect(localizeHref("/", "es")).toBe("/es/")
  })

  it("translates a home page anchor", () => {
    expect(localizeHref("/#join", "es")).toBe("/es/#unete")
  })

  it("keeps a query string and a hash it has no translation for", () => {
    expect(localizeHref("/confirm/?token=abc", "es")).toBe(
      "/es/confirmar/?token=abc"
    )
    expect(localizeHref("/privacy/#retention", "es")).toBe(
      "/es/privacidad/#retention"
    )
  })

  it("keeps a segment it has no translation for", () => {
    expect(localizeHref("/missing/", "es")).toBe("/es/missing/")
  })

  it("leaves absolute URLs, mailto links and files alone", () => {
    expect(localizeHref("https://example.com/", "es")).toBe(
      "https://example.com/"
    )
    expect(localizeHref("mailto:hello@monetyo.com", "es")).toBe(
      "mailto:hello@monetyo.com"
    )
    expect(localizeHref("/og.png", "es")).toBe("/og.png")
  })

  it("falls back to the default locale", () => {
    expect(localizeHref("/privacy/")).toBe("/privacy/")
    expect(localizeHref("/privacy/", "fr")).toBe("/privacy/")
  })
})

describe("getAlternates", () => {
  it("lists a page's path in every locale", () => {
    expect(getAlternates("/privacy/")).toEqual({
      en: "/privacy/",
      es: "/es/privacidad/",
      ca: "/ca/privacitat/",
      it: "/it/privacy/",
    })
  })
})

describe("getOpenGraphLocale", () => {
  it("joins language and region with an underscore", () => {
    expect(getOpenGraphLocale("en")).toBe("en_GB")
    expect(getOpenGraphLocale("es")).toBe("es_ES")
  })
})

describe("formatDate", () => {
  const date = new Date("2026-11-18T00:00:00Z")

  it("writes the month out in the reader's language", () => {
    expect(formatDate(date, "en")).toBe("18 November 2026")
    expect(formatDate(date, "es")).toBe("18 de noviembre de 2026")
  })

  it("falls back to the default locale", () => {
    expect(formatDate(date)).toBe("18 November 2026")
  })
})
