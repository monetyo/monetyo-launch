import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { readDeletion } from "@/libs/deletion"
import { sendEmail } from "@/libs/email"
import { readPrivacyLink } from "@/libs/email-copy"
import { recordProof } from "@/libs/proofs"
import { deleteSignup } from "@/libs/storage"
import { signId } from "@/libs/tokens"

import unsubscribe from "../../api/unsubscribe"

vi.mock("@/libs/proofs", () => ({ recordProof: vi.fn() }))
vi.mock("@/libs/email", () => ({ sendEmail: vi.fn() }))
vi.mock("@/libs/email-copy", () => ({ readPrivacyLink: vi.fn() }))
vi.mock("@/libs/deletion", async (original) => ({
  ...(await original<typeof import("@/libs/deletion")>()),
  readDeletion: vi.fn(),
}))
vi.mock("@/libs/storage", () => ({ deleteSignup: vi.fn() }))

const ID = "0b8e4f6c-1d2a-4c3b-9e5f-7a6b5c4d3e2f"
const SIGNATURE = signId(ID, "secret")

const SIGNUP = { email: "ana@example.com", locale: "es" }

/**
 * Posts the unsubscribe page's request.
 *
 * @param body - What it sends.
 *
 * @returns The function's response.
 */
function post(
  body: unknown = { id: ID, page: "/es/baja/", signature: SIGNATURE }
): Promise<Response> {
  return unsubscribe.fetch(
    new Request("https://monetyo.com/api/unsubscribe/", {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
  )
}

describe("api/unsubscribe", () => {
  beforeEach(() => {
    vi.stubEnv("UNSUBSCRIBE_SECRET", "secret")
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(deleteSignup).mockResolvedValue(SIGNUP)
    vi.mocked(recordProof).mockResolvedValue()
    vi.mocked(sendEmail).mockResolvedValue()
    vi.mocked(readPrivacyLink).mockResolvedValue({
      href: "https://monetyo.com/es/privacidad/",
      label: "Privacidad",
    })
    vi.mocked(readDeletion).mockResolvedValue({
      body: "Borrada.",
      heading: "Fuera de la lista",
      preheader: "Preheader",
      records: "Registros.",
      rejoin: "Vuelve cuando quieras.",
      subject: "Has salido de la lista",
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.mocked(deleteSignup).mockReset()
    vi.mocked(recordProof).mockReset()
    vi.mocked(sendEmail).mockReset()
  })

  it("only takes a POST", async () => {
    const response = await unsubscribe.fetch(
      new Request("https://monetyo.com/api/unsubscribe/")
    )

    expect(response.status).toBe(405)
  })

  it("deletes the signup, records the withdrawal and confirms the deletion by email", async () => {
    const response = await post()

    expect(await response.json()).toEqual({ ok: true })
    expect(deleteSignup).toHaveBeenCalledWith(ID)
    expect(recordProof).toHaveBeenCalledWith(expect.any(Request), {
      locale: "es",
      page: "/es/baja/",
      purpose: "withdrawal",
      signupId: ID,
    })
    expect(readDeletion).toHaveBeenCalledWith("es")
    expect(readPrivacyLink).toHaveBeenCalledWith("es", "https://monetyo.com")

    const [[sent]] = vi.mocked(sendEmail).mock.calls

    expect(sent).toMatchObject({
      subject: "Has salido de la lista",
      tags: ["waitlist-deletion"],
      to: { email: "ana@example.com" },
    })
    expect(sent.headers).toBeUndefined()
    expect(sent.text).toContain("Registros.")
    expect(sent.text).not.toContain("unsubscribe")
  })

  it("takes a mail client's one-click unsubscribe from the query string", async () => {
    const response = await unsubscribe.fetch(
      new Request(
        `https://monetyo.com/api/unsubscribe/?id=${ID}&signature=${SIGNATURE}`,
        {
          body: "List-Unsubscribe=One-Click",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          method: "POST",
        }
      )
    )

    expect(response.status).toBe(200)
    expect(vi.mocked(recordProof).mock.calls[0][1].page).toBe("one-click")
    expect(vi.mocked(sendEmail).mock.calls[0][0].to).toEqual({
      email: "ana@example.com",
    })
  })

  it("turns down a link that was tampered with or has no id", async () => {
    expect((await post({ id: ID, signature: "forged" })).status).toBe(400)
    expect((await post({ signature: SIGNATURE })).status).toBe(400)
    expect(deleteSignup).not.toHaveBeenCalled()
  })

  it("reads an unreadable body as no id at all", async () => {
    const response = await unsubscribe.fetch(
      new Request("https://monetyo.com/api/unsubscribe/", {
        body: "not json",
        headers: { "content-type": "application/json" },
        method: "POST",
      })
    )

    expect(response.status).toBe(400)
  })

  it("answers ok without a proof or an email when the address was already gone", async () => {
    vi.mocked(deleteSignup).mockResolvedValue(undefined)

    expect((await post()).status).toBe(200)
    expect(recordProof).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("still answers ok, and still records the withdrawal, when the email fails to send", async () => {
    vi.mocked(sendEmail).mockRejectedValue(new Error("Brevo down"))

    expect((await post()).status).toBe(200)
    expect(recordProof).toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith(new Error("Brevo down"))
  })

  it("still answers ok when the proof fails to store", async () => {
    vi.mocked(recordProof).mockRejectedValue(new Error("down"))

    expect((await post()).status).toBe(200)
    expect(console.error).toHaveBeenCalledWith(new Error("down"))
  })

  it("records a stored locale the site no longer has under the default", async () => {
    vi.mocked(deleteSignup).mockResolvedValue({ ...SIGNUP, locale: "fr" })

    await post()

    expect(vi.mocked(recordProof).mock.calls[0][1].locale).toBe("en")
    expect(readDeletion).toHaveBeenCalledWith("en")
  })

  it("answers 502 when the secret is missing or the database is down", async () => {
    vi.mocked(deleteSignup).mockRejectedValue(new Error("down"))
    expect((await post()).status).toBe(502)

    vi.stubEnv("UNSUBSCRIBE_SECRET", "")
    expect((await post()).status).toBe(502)
  })
})
