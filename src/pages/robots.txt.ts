import type { APIContext } from "astro"

/**
 * Lets every crawler in and points them at the sitemap.
 *
 * We decided against naming crawlers one by one because the site wants to be
 * found and cited by all of them, and a list would only go stale.
 */
export function GET(context: APIContext) {
  const sitemap = new URL("/sitemap.xml", context.site).href

  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
