import { DEFAULT_LOCALE, LOCALES, localizeHref } from "./i18n.js"

/** The pages search engines should know about, as content links to them. */
export const INDEXED = [
  "/",
  "/privacy/",
  "/cookies/",
  "/legal-notice/",
  "/security/",
  "/ai-content/",
] as const

/**
 * Builds a sitemap listing every page in every locale, each with links to its
 * translations, so a crawler learns how the languages pair up without having
 * to find each page through a link.
 *
 * We decided against `@astrojs/sitemap` because its i18n option pairs pages by
 * the path left once the locale prefix is stripped, and each locale words its
 * paths differently here (`/privacy/`, `/es/privacidad/`).
 *
 * @param site - The site's origin, such as `https://monetyo.com`.
 * @param pages - The pages to list, as content links to them.
 *
 * @returns The sitemap document.
 */
export function buildSitemap(site: string, pages: readonly string[]): string {
  const absolute = (href: string) => new URL(href, site).href

  const urls = pages.flatMap((page) => {
    const links = [
      ...LOCALES.map((locale) => [locale, localizeHref(page, locale)]),
      ["x-default", localizeHref(page, DEFAULT_LOCALE)],
    ].map(
      ([hreflang, href]) =>
        `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${absolute(href)}"/>`
    )

    return LOCALES.map((locale) =>
      [
        "  <url>",
        `    <loc>${absolute(localizeHref(page, locale))}</loc>`,
        ...links,
        "  </url>",
      ].join("\n")
    )
  })

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    // Crawlers skip the stylesheet. It is CSS rather than XSL, which browsers
    // are dropping support for, and lets a person read the sitemap too.
    `<?xml-stylesheet type="text/css" href="/sitemap.css"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`,
    ...urls,
    "</urlset>",
    "",
  ].join("\n")
}
