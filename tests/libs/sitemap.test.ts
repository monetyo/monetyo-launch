import { describe, expect, it } from "vitest"

import { buildSitemap } from "@/libs/sitemap"

const SITE = "https://monetyo.com"

describe("buildSitemap", () => {
  it("lists every page once per locale, each with its translations and a default", () => {
    const xml = buildSitemap(SITE, ["/privacy/"])

    expect(xml).toContain("<loc>https://monetyo.com/privacy/</loc>")
    expect(xml).toContain("<loc>https://monetyo.com/es/privacidad/</loc>")
    expect(xml).toContain("<loc>https://monetyo.com/ca/privacitat/</loc>")
    expect(xml).toContain("<loc>https://monetyo.com/it/privacy/</loc>")
    expect(xml.match(/<url>/g)).toHaveLength(4)
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="es" href="https://monetyo.com/es/privacidad/"/>'
    )
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="x-default" href="https://monetyo.com/privacy/"/>'
    )
  })

  it("is a valid sitemap document", () => {
    const xml = buildSitemap(SITE, ["/"])

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain(
      '<?xml-stylesheet type="text/css" href="/sitemap.css"?>'
    )
    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'
    )
    expect(xml.trimEnd().endsWith("</urlset>")).toBe(true)
  })
})
