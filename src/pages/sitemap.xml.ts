import type { APIContext } from "astro"

import { buildSitemap, INDEXED } from "@/libs/sitemap"

/**
 * Lists every page in every language for search engines.
 */
export function GET(context: APIContext) {
  return new Response(buildSitemap(String(context.site), INDEXED), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  })
}
