import { DEFAULT_LOCALE, isLocale } from "../src/libs/i18n.js"

/**
 * We decided to answer a missing translated path from a function, because
 * Vercel serves one `404.html` for every missing path, in the default
 * language. The rewrites in `vercel.json`, which only apply when no file
 * matches, send each language's missing paths here.
 *
 * @see https://vercel.com/docs/routing/custom-404-pages
 */

export default {
  /**
   * Answers with the 404 page in the path's language.
   *
   * @param request - The missing path, rewritten with its `locale`.
   *
   * @returns The page, with a 404 status.
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const locale = url.searchParams.get("locale")
    const page =
      isLocale(locale) && locale !== DEFAULT_LOCALE
        ? `/${locale}/not-found/`
        : "/404.html"

    // The visitor's cookie goes along so a protected preview lets it through.
    const response = await fetch(new URL(page, url.origin), {
      headers: { cookie: request.headers.get("cookie") ?? "" },
    })

    return new Response(response.ok ? response.body : "Not found", {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Content-Type": "text/html; charset=utf-8",
      },
      status: 404,
    })
  },
}
