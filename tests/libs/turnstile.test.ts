import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { verifyTurnstile } from "@/libs/turnstile"

/**
 * Replaces `fetch` with one that answers Turnstile's check.
 *
 * @param response - What the check answers.
 *
 * @returns The mock, to read what it was sent.
 */
function stubFetch(response: Response) {
  const fetch = vi.fn().mockResolvedValue(response)

  vi.stubGlobal("fetch", fetch)

  return fetch
}

describe("verifyTurnstile", () => {
  beforeEach(() => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("sends the secret, the token and the address to Cloudflare", async () => {
    const fetch = stubFetch(Response.json({ success: true }))

    expect(await verifyTurnstile("token", "203.0.113.7")).toBe(true)

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
    const form = init.body as FormData

    expect(url).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    )
    expect(form.get("secret")).toBe("secret")
    expect(form.get("response")).toBe("token")
    expect(form.get("remoteip")).toBe("203.0.113.7")
  })

  it("leaves the address out when there is none", async () => {
    const fetch = stubFetch(Response.json({ success: true }))

    await verifyTurnstile("token", undefined)

    const form = (fetch.mock.calls[0] as [string, RequestInit])[1]
      .body as FormData

    expect(form.has("remoteip")).toBe(false)
  })

  it("fails a token Cloudflare turns down", async () => {
    stubFetch(Response.json({ success: false }))

    expect(await verifyTurnstile("token", undefined)).toBe(false)
  })

  it("fails an empty token without asking", async () => {
    const fetch = stubFetch(Response.json({ success: true }))

    expect(await verifyTurnstile("", undefined)).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("throws when Cloudflare answers with an error", async () => {
    stubFetch(new Response(null, { status: 500 }))

    await expect(verifyTurnstile("token", undefined)).rejects.toThrow("500")
  })

  it("throws when the secret isn't set", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "")

    await expect(verifyTurnstile("token", undefined)).rejects.toThrow(
      "`TURNSTILE_SECRET_KEY`"
    )
  })
})
