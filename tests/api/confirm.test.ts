import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { recordProof } from "@/libs/proofs"
import { confirmPending } from "@/libs/storage"
import { hashToken } from "@/libs/tokens"

import confirm from "../../api/confirm"

vi.mock("@/libs/proofs", () => ({ recordProof: vi.fn() }))
vi.mock("@/libs/storage", () => ({ confirmPending: vi.fn() }))

const SIGNUP = {
  email: "ana@example.com",
  id: "0b8e4f6c-1d2a-4c3b-9e5f-7a6b5c4d3e2f",
  locale: "es",
}

/**
 * Posts the confirmation page's request.
 *
 * @param body - What it sends, as an object or as raw text.
 *
 * @returns The function's response.
 */
function post(
  body: unknown = { page: "/es/confirmar/", token: "token" }
): Promise<Response> {
  return confirm.fetch(
    new Request("https://monetyo.com/api/confirm/", {
      body: typeof body === "string" ? body : JSON.stringify(body),
      method: "POST",
    })
  )
}

describe("api/confirm", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(confirmPending).mockResolvedValue(SIGNUP)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.mocked(confirmPending).mockReset()
    vi.mocked(recordProof).mockReset()
  })

  it("only takes a POST, so a mail scanner opening the link confirms nothing", async () => {
    const response = await confirm.fetch(
      new Request("https://monetyo.com/api/confirm/?token=token")
    )

    expect(response.status).toBe(405)
    expect(confirmPending).not.toHaveBeenCalled()
  })

  it("confirms the signup by the token's hash and records the proof", async () => {
    const response = await post()

    expect(await response.json()).toEqual({ ok: true })
    expect(confirmPending).toHaveBeenCalledWith(hashToken("token"))
    expect(recordProof).toHaveBeenCalledWith(expect.any(Request), {
      locale: "es",
      page: "/es/confirmar/",
      purpose: "confirmation",
      signupId: SIGNUP.id,
    })
  })

  it("treats a missing token or an unreadable body as an expired link", async () => {
    expect((await post({})).status).toBe(410)
    expect((await post("not json")).status).toBe(410)
    expect(confirmPending).not.toHaveBeenCalled()
  })

  it("answers expired for a token no pending signup has", async () => {
    vi.mocked(confirmPending).mockResolvedValue(undefined)

    const response = await post()

    expect(response.status).toBe(410)
    expect(await response.json()).toEqual({ error: "expired" })
    expect(recordProof).not.toHaveBeenCalled()
  })

  it("answers 502 when the database can't be reached", async () => {
    vi.mocked(confirmPending).mockRejectedValue(new Error("down"))

    expect((await post()).status).toBe(502)
  })

  it("still confirms when the proof fails to store", async () => {
    vi.mocked(recordProof).mockRejectedValue(new Error("down"))

    expect((await post()).status).toBe(200)
    expect(console.error).toHaveBeenCalledWith(new Error("down"))
  })

  it("records a stored locale the site no longer has under the default", async () => {
    vi.mocked(confirmPending).mockResolvedValue({ ...SIGNUP, locale: "fr" })

    await post()

    expect(vi.mocked(recordProof).mock.calls[0][1].locale).toBe("en")
  })
})
