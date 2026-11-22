import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { type Email, sendEmail, SENDER } from "@/libs/email"

const EMAIL: Email = {
  headers: { "List-Unsubscribe": "<https://monetyo.com/unsubscribe/>" },
  html: "<p>Hello</p>",
  subject: "Hello",
  tags: ["waitlist"],
  text: "Hello",
  to: { email: "ana@example.com" },
}

/**
 * Replaces `fetch` with one that answers every request the same way.
 *
 * @param response - What every request gets back.
 *
 * @returns The mock, to read the requests it received.
 */
function stubFetch(response: Response) {
  const fetch = vi.fn().mockResolvedValue(response)

  vi.stubGlobal("fetch", fetch)

  return fetch
}

describe("sendEmail", () => {
  beforeEach(() => {
    vi.stubEnv("BREVO_API_KEY", "test-key")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("posts the email to Brevo with the API key and the site's sender", async () => {
    const fetch = stubFetch(new Response(null, { status: 201 }))

    await sendEmail(EMAIL)

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit]

    expect(url).toBe("https://api.brevo.com/v3/smtp/email")
    expect(init.method).toBe("POST")
    expect(init.headers).toMatchObject({ "api-key": "test-key" })
    expect(JSON.parse(init.body as string)).toEqual({
      headers: EMAIL.headers,
      htmlContent: "<p>Hello</p>",
      sender: SENDER,
      subject: "Hello",
      tags: ["waitlist"],
      textContent: "Hello",
      to: [{ email: "ana@example.com" }],
    })
  })

  it("adds an idempotency key to the other headers, so a retry sends once", async () => {
    const fetch = stubFetch(new Response(null, { status: 201 }))

    await sendEmail({ ...EMAIL, idempotencyKey: "key" })

    const [, init] = fetch.mock.calls[0] as [string, RequestInit]

    expect(JSON.parse(init.body as string).headers).toEqual({
      ...EMAIL.headers,
      idempotencyKey: "key",
    })
  })

  it("sends no headers at all when the email has none", async () => {
    const fetch = stubFetch(new Response(null, { status: 201 }))

    await sendEmail({ ...EMAIL, headers: undefined })

    const [, init] = fetch.mock.calls[0] as [string, RequestInit]

    expect(JSON.parse(init.body as string)).not.toHaveProperty("headers")
  })

  it("throws, naming the fix, when the API key is missing", async () => {
    vi.stubEnv("BREVO_API_KEY", "")

    await expect(sendEmail(EMAIL)).rejects.toThrow("Set `BREVO_API_KEY`")
  })

  it("throws with Brevo's answer when it refuses the email", async () => {
    stubFetch(new Response("unauthorised sender", { status: 400 }))

    await expect(sendEmail(EMAIL)).rejects.toThrow(
      "Brevo refused the email (400): unauthorised sender"
    )
  })
})
