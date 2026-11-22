import { beforeEach, describe, expect, it, vi } from "vitest"

import { getLocalizedStaticPaths, getSettings } from "@/libs/content"

import { collections, resetContent } from "../support/astro-content"

vi.mock("astro:content", () => import("../support/astro-content"))

/**
 * Fills a collection with one entry per locale.
 *
 * @param name - The collection.
 * @param ids - The entries' ids, usually locales.
 */
function fill(name: string, ids: string[]): void {
  collections[name] = ids.map((id) => ({ data: { id }, id }))
}

describe("getLocalizedStaticPaths", () => {
  beforeEach(resetContent)

  it("builds one route per locale, the default one without a prefix", async () => {
    fill("home", ["en", "es", "ca", "it"])

    const paths = await getLocalizedStaticPaths("home")

    expect(paths.map(({ params }) => params)).toEqual([
      { locale: undefined },
      { locale: "es" },
      { locale: "ca" },
      { locale: "it" },
    ])
    expect(paths[1].props.entry.id).toBe("es")
  })

  it("skips an entry whose id is not a locale", async () => {
    fill("home", ["en", "es", "ca", "it", "fr"])

    expect(await getLocalizedStaticPaths("home")).toHaveLength(4)
  })

  it("gives a page its segment in each locale", async () => {
    fill("privacy", ["en", "es", "ca", "it"])

    const paths = await getLocalizedStaticPaths("privacy", "privacy")

    expect(paths.map(({ params }) => params)).toEqual([
      { locale: undefined, privacy: "privacy" },
      { locale: "es", privacy: "privacidad" },
      { locale: "ca", privacy: "privacitat" },
      { locale: "it", privacy: "privacy" },
    ])
  })

  it("throws when a locale has no entry", async () => {
    fill("home", ["en"])

    await expect(getLocalizedStaticPaths("home")).rejects.toThrow(
      "The `home` collection has no entry for the locale `es`. Add its `es.yaml` file."
    )
  })
})

describe("getSettings", () => {
  beforeEach(() => {
    resetContent()
    fill("settings", ["en", "es"])
  })

  it("reads the settings of the given locale", async () => {
    expect(await getSettings("es")).toEqual({ id: "es" })
  })

  it("falls back to the default locale", async () => {
    expect(await getSettings()).toEqual({ id: "en" })
    expect(await getSettings("fr")).toEqual({ id: "en" })
  })

  it("throws when a locale has no settings", async () => {
    fill("settings", ["en"])

    await expect(getSettings("es")).rejects.toThrow(
      "No settings entry for the locale `es`. Add src/content/settings/es.yaml."
    )
  })
})
