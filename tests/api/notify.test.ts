import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { readNotice } from "@/libs/consent"
import { sendEmail } from "@/libs/email"
import { readPrivacyLink } from "@/libs/email-copy"
import { LOCALES } from "@/libs/i18n"
import { readInvite } from "@/libs/invite"
import { readPolicy } from "@/libs/policy"
import { listConfirmed, recordBroadcast } from "@/libs/storage"
import { readSurvey } from "@/libs/survey"
import { signId } from "@/libs/tokens"

import notify from "../../api/notify"

vi.mock("@/libs/consent", () => ({ readNotice: vi.fn() }))
vi.mock("@/libs/email", () => ({ sendEmail: vi.fn() }))
vi.mock("@/libs/email-copy", () => ({ readPrivacyLink: vi.fn() }))
vi.mock("@/libs/storage", () => ({
  listConfirmed: vi.fn(),
  recordBroadcast: vi.fn(),
}))
vi.mock("@/libs/survey", async (original) => ({
  ...(await original<typeof import("@/libs/survey")>()),
  readSurvey: vi.fn(),
}))
vi.mock("@/libs/invite", async (original) => ({
  ...(await original<typeof import("@/libs/invite")>()),
  readInvite: vi.fn(),
}))
vi.mock("@/libs/policy", async (original) => ({
  ...(await original<typeof import("@/libs/policy")>()),
  readPolicy: vi.fn(),
}))

const ORIGIN = "https://monetyo.com"

const RECIPIENTS = [
  { email: "ana@example.com", id: "id-ana", locale: "en" },
  { email: "bea@example.com", id: "id-bea", locale: "es" },
  { email: "cira@example.com", id: "id-cira", locale: "it" },
  // A language the site has since dropped falls back to the default one.
  { email: "dirk@example.com", id: "id-dirk", locale: "de" },
]

const NOTICE = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    { body: `Body in ${locale}.`, subject: `Notice in ${locale}` },
  ])
)

const SURVEY = {
  mode: "send",
  template: "survey",
  url: "https://tally.so/r/abc",
}

/**
 * Builds a template's copy, every field naming itself and the locale.
 *
 * @param fields - The template's fields.
 *
 * @returns A function giving the copy for one locale.
 */
function copyOf(fields: string[]) {
  return async (locale: string) =>
    Object.fromEntries(fields.map((field) => [field, `${field} (${locale})`]))
}

/**
 * Calls the function the way `bun run notify` does.
 *
 * @param body - What it sends.
 * @param init - Anything else about the request.
 *
 * @returns The function's response.
 */
function call(body: unknown, init: RequestInit = {}): Promise<Response> {
  return notify.fetch(
    new Request(`${ORIGIN}/api/notify/`, {
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { authorization: "Bearer notify" },
      method: "POST",
      ...init,
    })
  )
}

/**
 * Lists what each email that went out was sent with.
 *
 * @returns The emails, in the order they were sent.
 */
function sent() {
  return vi.mocked(sendEmail).mock.calls.map(([email]) => email)
}

describe("api/notify", () => {
  beforeEach(() => {
    vi.stubEnv("NOTIFY_SECRET", "notify")
    vi.stubEnv("NOTIFY_TEST_EMAIL", "team@monetyo.com")
    vi.stubEnv("UNSUBSCRIBE_SECRET", "unsubscribe")
    vi.mocked(listConfirmed).mockResolvedValue(RECIPIENTS)
    vi.mocked(sendEmail).mockResolvedValue()
    vi.mocked(recordBroadcast).mockResolvedValue()
    vi.mocked(readNotice).mockResolvedValue({
      text: "Notice",
      version: "2026-11-22",
    })
    vi.mocked(readPrivacyLink).mockImplementation(async (locale, origin) => ({
      href: `${origin}/${locale}/privacy/`,
      label: `Privacy (${locale})`,
    }))
    vi.mocked(readSurvey).mockImplementation(
      copyOf([
        "anonymity",
        "body",
        "button",
        "fallback",
        "heading",
        "preheader",
        "reason",
        "subject",
        "unsubscribe",
      ]) as typeof readSurvey
    )
    vi.mocked(readInvite).mockImplementation(
      copyOf([
        "body",
        "button",
        "fallback",
        "feedback",
        "heading",
        "preheader",
        "reason",
        "subject",
        "unsubscribe",
      ]) as typeof readInvite
    )
    vi.mocked(readPolicy).mockImplementation(
      copyOf([
        "button",
        "fallback",
        "preheader",
        "reason",
        "rights",
        "unsubscribe",
      ]) as typeof readPolicy
    )
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.mocked(sendEmail).mockReset()
    vi.mocked(recordBroadcast).mockReset()
    vi.mocked(listConfirmed).mockReset()
  })

  describe("guards", () => {
    it.each([
      ["no secret", {}],
      ["the wrong secret", { authorization: "Bearer guess" }],
    ])("refuses a call with %s", async (_, headers) => {
      const response = await call(SURVEY, { headers, method: "POST" })

      expect(response.status).toBe(401)
      expect(listConfirmed).not.toHaveBeenCalled()
    })

    it("refuses every call when no secret is set, rather than run unguarded", async () => {
      vi.stubEnv("NOTIFY_SECRET", "")

      const response = await call(SURVEY, {
        headers: { authorization: "Bearer " },
        method: "POST",
      })

      expect(response.status).toBe(401)
    })

    it("only takes a POST", async () => {
      const response = await notify.fetch(
        new Request(`${ORIGIN}/api/notify/`, {
          headers: { authorization: "Bearer notify" },
        })
      )

      expect(response.status).toBe(405)
      expect(response.headers.get("allow")).toBe("POST")
    })

    it.each([
      ["a body that isn't JSON", "{"],
      ["an unknown mode", { ...SURVEY, mode: "blast" }],
      ["an unknown template", { ...SURVEY, template: "newsletter" }],
      ["a survey without a URL", { mode: "send", template: "survey" }],
      ["a URL that isn't one", { ...SURVEY, url: "tally" }],
      ["a URL that isn't https", { ...SURVEY, url: "http://tally.so/r/abc" }],
      [
        "a notice missing a language",
        { mode: "send", notice: { en: NOTICE.en }, template: "policy" },
      ],
    ])("explains what to send, given %s", async (_, body) => {
      const response = await call(body)

      expect(response.status).toBe(400)
      expect((await response.json()).error).toContain(
        "Send a `mode` (dry-run, test, send) and a `template` (invite, policy, survey)"
      )
      expect(sendEmail).not.toHaveBeenCalled()
    })
  })

  describe("dry run", () => {
    it("counts the recipients by language, checks their copy, and sends nothing", async () => {
      const response = await call({ ...SURVEY, mode: "dry-run" })

      expect(response.headers.get("cache-control")).toBe("no-store")
      expect(await response.json()).toEqual({
        byLocale: { ca: 0, en: 2, es: 1, it: 1 },
        mode: "dry-run",
        recipients: 4,
        template: "survey",
      })
      expect(
        vi.mocked(readSurvey).mock.calls.map(([locale]) => locale)
      ).toEqual(["en", "es", "it"])
      expect(sendEmail).not.toHaveBeenCalled()
      expect(recordBroadcast).not.toHaveBeenCalled()
    })

    it("answers with the real error when a language's copy is broken", async () => {
      vi.mocked(readSurvey).mockRejectedValue(
        new Error("The survey email has no `body`.")
      )

      const response = await call({ ...SURVEY, mode: "dry-run" })

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        error: "Error: The survey email has no `body`.",
      })
    })
  })

  describe("test", () => {
    it("sends one copy in each language to the test inbox, and nobody else", async () => {
      const response = await call({ ...SURVEY, mode: "test" })

      expect(await response.json()).toEqual({
        mode: "test",
        sent: 4,
        to: "team@monetyo.com",
      })
      expect(listConfirmed).not.toHaveBeenCalled()
      expect(sent().map(({ subject }) => subject)).toEqual(
        LOCALES.map((locale) => `[Test, ${locale}] subject (${locale})`)
      )
      expect(sent()[0]).toMatchObject({
        tags: ["broadcast-survey", "test"],
        to: { email: "team@monetyo.com" },
      })
    })

    it("signs an id no signup has, so the unsubscribe link can be tried safely", async () => {
      await call({ ...SURVEY, mode: "test" })

      const id = "00000000-0000-0000-0000-000000000000"
      const signature = signId(id, "unsubscribe")

      expect(sent()[1].text).toContain(
        `${ORIGIN}/es/baja/?id=${id}&signature=${signature}`
      )
      expect(sent()[1].headers?.["List-Unsubscribe"]).toBe(
        `<${ORIGIN}/api/unsubscribe/?id=${id}&signature=${signature}>`
      )
    })

    it("fails without an inbox to send to", async () => {
      vi.stubEnv("NOTIFY_TEST_EMAIL", "")

      const response = await call({ ...SURVEY, mode: "test" })

      expect(response.status).toBe(500)
      expect((await response.json()).error).toContain("NOTIFY_TEST_EMAIL")
      expect(sendEmail).not.toHaveBeenCalled()
    })
  })

  describe("send", () => {
    it("emails each person in their language with their own unsubscribe link, and records the run", async () => {
      const response = await call(SURVEY)

      expect(await response.json()).toEqual({
        delivered: 4,
        failed: 0,
        mode: "send",
        recipients: 4,
        recorded: true,
      })
      expect(sent().map(({ subject, to }) => [to.email, subject])).toEqual([
        ["ana@example.com", "subject (en)"],
        ["bea@example.com", "subject (es)"],
        ["cira@example.com", "subject (it)"],
        ["dirk@example.com", "subject (en)"],
      ])

      const bea = sent()[1]
      const signature = signId("id-bea", "unsubscribe")

      expect(bea.text).toContain("button (es): https://tally.so/r/abc")
      expect(bea.text).toContain(
        `${ORIGIN}/es/baja/?id=id-bea&signature=${signature}`
      )
      expect(bea.text).toContain(`Privacy (es): ${ORIGIN}/es/privacy/`)
      expect(bea.headers).toEqual({
        "List-Unsubscribe": `<${ORIGIN}/api/unsubscribe/?id=id-bea&signature=${signature}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      })
      expect(bea.tags).toEqual(["broadcast-survey"])
      expect(new Set(sent().map((email) => email.idempotencyKey)).size).toBe(4)

      expect(recordBroadcast).toHaveBeenCalledWith({
        delivered: 4,
        failed: 0,
        id: expect.any(String),
        policyVersion: "2026-11-22",
        recipients: 4,
        sentAt: expect.any(String),
        subject: "subject (en)",
        template: "survey",
      })
    })

    it("sends in batches of ten", async () => {
      const many = Array.from({ length: 23 }, (_, index) => ({
        email: `person${index}@example.com`,
        id: `id-${index}`,
        locale: "en",
      }))
      let inFlight = 0
      let most = 0

      vi.mocked(listConfirmed).mockResolvedValue(many)
      vi.mocked(sendEmail).mockImplementation(async () => {
        inFlight += 1
        most = Math.max(most, inFlight)
        await Promise.resolve()
        inFlight -= 1
      })

      expect(await (await call(SURVEY)).json()).toMatchObject({
        delivered: 23,
      })
      expect(most).toBe(10)
    })

    it("links an invitation's button to the app", async () => {
      await call({
        mode: "send",
        template: "invite",
        url: "https://app.monetyo.com/join",
      })

      expect(sent()[1].text).toContain(
        "button (es): https://app.monetyo.com/join"
      )
      expect(sent()[1].text).toContain("feedback (es)")
      expect(sent()[1].tags).toEqual(["broadcast-invite"])
    })

    it("sends a policy notice in each person's language, linking to the changed page in it", async () => {
      await call({
        mode: "send",
        notice: { ...NOTICE, page: "/cookies/" },
        template: "policy",
      })

      expect(sent().map(({ subject }) => subject)).toEqual([
        "Notice in en",
        "Notice in es",
        "Notice in it",
        "Notice in en",
      ])
      expect(sent()[1].text).toContain("Body in es.")
      expect(sent()[1].text).toContain(`button (es): ${ORIGIN}/es/cookies/`)
      expect(sent()[1].text).toContain("rights (es)")
      expect(recordBroadcast).toHaveBeenCalledWith(
        expect.objectContaining({ subject: "Notice in en", template: "policy" })
      )
    })

    it("stops before sending anything when a language's copy is broken", async () => {
      vi.mocked(readSurvey).mockRejectedValue(new Error("no `body`"))

      const response = await call(SURVEY)

      expect(response.status).toBe(500)
      expect(sendEmail).not.toHaveBeenCalled()
      expect(recordBroadcast).not.toHaveBeenCalled()
    })

    it("reports the run unrecorded, rather than failing it, when the record can't be stored", async () => {
      vi.mocked(recordBroadcast).mockRejectedValue(new Error("Neon down"))

      const response = await call(SURVEY)

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        delivered: 4,
        recorded: false,
      })
      expect(console.error).toHaveBeenCalledWith(new Error("Neon down"))
    })

    describe("when Brevo fails", () => {
      beforeEach(() => {
        vi.useFakeTimers()
        vi.mocked(listConfirmed).mockResolvedValue(RECIPIENTS.slice(0, 1))
      })

      /**
       * Sends to one person, letting the wait before the retry pass.
       *
       * @returns The function's report.
       */
      async function sendOnce() {
        const response = call(SURVEY)

        await vi.advanceTimersByTimeAsync(3000)

        return (await response).json()
      }

      it("waits, then retries with the same key", async () => {
        vi.mocked(sendEmail).mockRejectedValueOnce(new Error("503"))

        expect(await sendOnce()).toMatchObject({ delivered: 1, failed: 0 })

        const [first, retry] = sent()

        expect(retry.idempotencyKey).toBe(first.idempotencyKey)
      })

      it("counts it delivered when the retry finds the first attempt went through", async () => {
        vi.mocked(sendEmail)
          .mockRejectedValueOnce(new Error("503"))
          .mockRejectedValueOnce(new Error("Brevo 400: duplicate_parameter"))

        expect(await sendOnce()).toMatchObject({ delivered: 1, failed: 0 })
      })

      it("counts it failed, and still records the run, when the retry fails too", async () => {
        const error = new Error("Brevo 503")

        vi.mocked(sendEmail)
          .mockRejectedValueOnce(new Error("503"))
          .mockRejectedValueOnce(error)

        expect(await sendOnce()).toMatchObject({ delivered: 0, failed: 1 })
        expect(console.error).toHaveBeenCalledWith(error)
        expect(recordBroadcast).toHaveBeenCalledWith(
          expect.objectContaining({ delivered: 0, failed: 1, recipients: 1 })
        )
      })
    })
  })
})
