import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import notFound from "../../api/not-found"

/**
 * Calls the function the way a rewrite in `vercel.json` does.
 *
 * @param query - The rewrite's query string.
 * @param cookie - The visitor's cookie header.
 *
 * @returns The function's response.
 */
function run(query: string, cookie?: string): Promise<Response> {
  return notFound.fetch(
    new Request(`https://monetyo.com/api/not-found/${query}`, {
      headers: cookie ? { cookie } : {},
    })
  )
}

describe("api/not-found", () => {
  const page = vi.fn<typeof fetch>()

  beforeEach(() => {
    page.mockResolvedValue(new Response("<html>Página</html>"))
    vi.stubGlobal("fetch", page)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("answers with the page in the path's language and a 404 status", async () => {
    const response = await run("?locale=es", "_vercel_jwt=abc")

    expect(response.status).toBe(404)
    expect(response.headers.get("Content-Type")).toBe(
      "text/html; charset=utf-8"
    )
    expect(await response.text()).toBe("<html>Página</html>")
    expect(String(page.mock.calls[0][0])).toBe(
      "https://monetyo.com/es/not-found/"
    )
    expect(page.mock.calls[0][1]).toEqual({
      headers: { cookie: "_vercel_jwt=abc" },
    })
  })

  it.each([
    ["the default language", "?locale=en"],
    ["an unsupported one", "?locale=fr"],
    ["none at all", ""],
  ])("falls back to the default page for %s", async (_, query) => {
    await run(query)

    expect(String(page.mock.calls[0][0])).toBe("https://monetyo.com/404.html")
    expect(page.mock.calls[0][1]).toEqual({ headers: { cookie: "" } })
  })

  it("still answers 404 when the page itself can't be read", async () => {
    page.mockResolvedValue(new Response("Forbidden", { status: 403 }))

    const response = await run("?locale=it")

    expect(response.status).toBe(404)
    expect(await response.text()).toBe("Not found")
  })
})
