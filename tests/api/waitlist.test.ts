import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { readConfirmation } from "@/libs/confirmation"
import { sendEmail } from "@/libs/email"
import { readPrivacyLink } from "@/libs/email-copy"
import { recordProof } from "@/libs/proofs"
import { storePending } from "@/libs/storage"
import { hashToken, signId } from "@/libs/tokens"
import { verifyTurnstile } from "@/libs/turnstile"

import waitlist from "../../api/waitlist"

vi.mock("@/libs/email", () => ({ sendEmail: vi.fn() }))
vi.mock("@/libs/email-copy", () => ({ readPrivacyLink: vi.fn() }))
vi.mock("@/libs/proofs", () => ({ recordProof: vi.fn() }))
vi.mock("@/libs/storage", () => ({ storePending: vi.fn() }))
vi.mock("@/libs/turnstile", () => ({ verifyTurnstile: vi.fn() }))
vi.mock("@/libs/confirmation", async (original) => ({
  ...(await original<typeof import("@/libs/confirmation")>()),
  readConfirmation: vi.fn(),
}))

const ID = "0b8e4f6c-1d2a-4c3b-9e5f-7a6b5c4d3e2f"

const FORM = {
  elapsed: 5000,
  email: " Ana@Example.com ",
  household: "family",
  locale: "es",
  page: "/es/",
  token: "turnstile-token",
  website: "",
}

/**
 * Posts the form.
 *
 * @param body - What it sends, as an object or as raw text.
 * @param init - Anything else about the request.
 *
 * @returns The function's response.
 */
function post(body: unknown = FORM, init: RequestInit = {}): Promise<Response> {
  return waitlist.fetch(
    new Request("https://preview.monetyo.com/api/waitlist/", {
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "x-real-ip": "203.0.113.7" },
      method: "POST",
      ...init,
    })
  )
}

describe("api/waitlist", () => {
  beforeEach(() => {
    vi.stubEnv("UNSUBSCRIBE_SECRET", "unsubscribe-secret")
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(verifyTurnstile).mockResolvedValue(true)
    vi.mocked(storePending).mockResolvedValue(ID)
    vi.mocked(readPrivacyLink).mockResolvedValue({
      href: "https://preview.monetyo.com/es/privacidad/",
      label: "Privacidad",
    })
    vi.mocked(readConfirmation).mockResolvedValue({
      body: "Body",
      button: "Confirm",
      fallback: "Fallback",
      heading: "Heading",
      ignore: "Ignore",
      preheader: "Preheader",
      subject: "Confirm your email",
      unsubscribe: "Unsubscribe",
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.mocked(sendEmail).mockReset()
    vi.mocked(recordProof).mockReset()
    vi.mocked(storePending).mockReset()
    vi.mocked(verifyTurnstile).mockReset()
  })

  it("only takes a POST", async () => {
    const response = await waitlist.fetch(
      new Request("https://monetyo.com/api/waitlist/")
    )

    expect(response.status).toBe(405)
    expect(response.headers.get("allow")).toBe("POST")
  })

  it("turns down a body that isn't a JSON object", async () => {
    expect((await post("not json")).status).toBe(400)
  })

  it("tells a bot that filled the hidden field it worked, and keeps nothing", async () => {
    const response = await post({ ...FORM, website: "https://spam.example" })

    expect(await response.json()).toEqual({ ok: true })
    expect(verifyTurnstile).not.toHaveBeenCalled()
    expect(storePending).not.toHaveBeenCalled()
  })

  it("tells a bot faster than any person it worked, and keeps nothing", async () => {
    const response = await post({ ...FORM, elapsed: 200 })

    expect(await response.json()).toEqual({ ok: true })
    expect(storePending).not.toHaveBeenCalled()
  })

  it("reports each field that fails, in the shape the form reads", async () => {
    const response = await post({ ...FORM, email: "x", household: "pets" })

    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({
      fields: { email: "email", household: "household" },
    })
  })

  it("treats fields of the wrong type as empty", async () => {
    const response = await post({ ...FORM, elapsed: "5000", email: 42 })

    expect(await response.json()).toEqual({ ok: true })
    expect(storePending).not.toHaveBeenCalled()
  })

  it("turns down a locale the site isn't built in", async () => {
    expect((await post({ ...FORM, locale: "fr" })).status).toBe(400)
  })

  it("turns down a signup Turnstile doesn't vouch for", async () => {
    vi.mocked(verifyTurnstile).mockResolvedValue(false)

    const response = await post()

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: "verification" })
    expect(verifyTurnstile).toHaveBeenCalledWith(
      "turnstile-token",
      "203.0.113.7"
    )
  })

  it("answers 502 when Turnstile can't be asked", async () => {
    vi.mocked(verifyTurnstile).mockRejectedValue(new Error("down"))

    expect((await post()).status).toBe(502)
  })

  it("answers 502 when the signup can't be stored", async () => {
    vi.mocked(storePending).mockRejectedValue(new Error("down"))

    expect((await post()).status).toBe(502)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("stores the address normalised, with only the token's hash", async () => {
    await post()

    const signup = vi.mocked(storePending).mock.calls[0][0]
    const sent = vi.mocked(sendEmail).mock.calls[0][0]
    const token = /token=([\w-]+)/.exec(sent.text)![1]

    expect(signup).toMatchObject({
      email: "ana@example.com",
      household: "family",
      locale: "es",
      page: "/es/",
      tokenHash: hashToken(token),
    })
  })

  it("stores no household when none was picked", async () => {
    await post({ ...FORM, household: "" })

    expect(vi.mocked(storePending).mock.calls[0][0].household).toBeNull()
  })

  it("emails a confirmation whose links lead back to this deployment, in the Visitor's language", async () => {
    const response = await post()
    const sent = vi.mocked(sendEmail).mock.calls[0][0]
    const signature = signId(ID, "unsubscribe-secret")

    expect(await response.json()).toEqual({ ok: true })
    expect(sent.to).toEqual({ email: "ana@example.com" })
    expect(sent.subject).toBe("Confirm your email")
    expect(sent.text).toContain(
      "https://preview.monetyo.com/es/confirmar/?token="
    )
    expect(sent.text).toContain(
      `https://preview.monetyo.com/es/baja/?id=${ID}&signature=${signature}`
    )
    expect(sent.headers).toEqual({
      "List-Unsubscribe": `<https://preview.monetyo.com/api/unsubscribe/?id=${ID}&signature=${signature}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    })
    expect(sent.text).toContain(
      "Privacidad: https://preview.monetyo.com/es/privacidad/"
    )
    expect(readConfirmation).toHaveBeenCalledWith("es")
    expect(readPrivacyLink).toHaveBeenCalledWith(
      "es",
      "https://preview.monetyo.com"
    )
  })

  it("records proof of what the Visitor agreed to", async () => {
    await post()

    expect(recordProof).toHaveBeenCalledWith(expect.any(Request), {
      locale: "es",
      page: "/es/",
      purpose: "signup",
      signupId: ID,
    })
  })

  it("sends nothing for an address that is already confirmed, and says nothing about it", async () => {
    vi.mocked(storePending).mockResolvedValue(undefined)

    const response = await post()

    expect(await response.json()).toEqual({ ok: true })
    expect(sendEmail).not.toHaveBeenCalled()
    expect(recordProof).not.toHaveBeenCalled()
  })

  it("still answers ok when only the proof fails to store", async () => {
    vi.mocked(recordProof).mockRejectedValue(new Error("down"))

    expect((await post()).status).toBe(200)
    expect(console.error).toHaveBeenCalledWith(new Error("down"))
  })

  it("asks the Visitor to try again when the email can't be sent", async () => {
    vi.mocked(sendEmail).mockRejectedValue(new Error("Brevo down"))

    const response = await post()

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: "generic" })
  })

  it("asks the Visitor to try again when the unsubscribe secret is missing", async () => {
    vi.stubEnv("UNSUBSCRIBE_SECRET", "")

    expect((await post()).status).toBe(502)
    expect(sendEmail).not.toHaveBeenCalled()
  })
})
