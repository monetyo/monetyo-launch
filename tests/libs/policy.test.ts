import { beforeEach, describe, expect, it, vi } from "vitest"

import { LOCALES } from "@/libs/i18n"
import {
  buildPolicy,
  type PolicyCopy,
  readNoticeInput,
  readPolicy,
} from "@/libs/policy"

import { files, resetFiles } from "../support/files"

vi.mock("node:fs/promises", () => import("../support/files"))

const COPY: PolicyCopy = {
  button: "Read the updated page",
  fallback: "Or paste this link:",
  preheader: "A change to how we handle your data",
  reason: "You're on the waitlist.",
  rights: "Unsubscribe or write to privacy@monetyo.com.",
  unsubscribe: "Unsubscribe",
}

const NOTICE = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    { body: `Body in ${locale}.`, subject: `Subject in ${locale}` },
  ])
)

describe("readNoticeInput", () => {
  it("takes a complete notice, about the privacy policy unless it says otherwise", () => {
    expect(readNoticeInput(NOTICE)).toEqual({ ...NOTICE, page: "/privacy/" })
    expect(readNoticeInput({ ...NOTICE, page: "/cookies/" })?.page).toBe(
      "/cookies/"
    )
  })

  it.each([
    ["nothing", undefined],
    ["something that isn't an object", "notice"],
    ["a page that isn't a legal one", { ...NOTICE, page: "/blog/" }],
    ["a missing language", { ...NOTICE, it: undefined }],
    ["a blank subject", { ...NOTICE, es: { body: "Body", subject: " " } }],
    ["a blank body", { ...NOTICE, ca: { body: "\n", subject: "Subject" } }],
    ["a body that isn't text", { ...NOTICE, en: { body: 1, subject: "S" } }],
  ])("turns down %s", (_, value) => {
    expect(readNoticeInput(value)).toBeUndefined()
  })
})

describe("readPolicy", () => {
  beforeEach(resetFiles)

  it("reads the frame in the recipient's own language", async () => {
    files["src/content/emails/policy/it.yaml"] = Object.entries(COPY)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join("\n")

    expect(await readPolicy("it")).toEqual(COPY)
  })

  it("throws, naming the field and the file, when a field is missing", async () => {
    files["src/content/emails/policy/en.yaml"] = "button: Read\n"

    await expect(readPolicy("en")).rejects.toThrow(
      "The policy email has no `fallback`. Add it to src/content/emails/policy/en.yaml."
    )
  })
})

describe("buildPolicy", () => {
  const email = buildPolicy(
    "es",
    COPY,
    { body: "What changed.\n\nFrom when.", subject: "  A change  " },
    {
      page: "https://monetyo.com/es/cookies/",
      privacy: {
        href: "https://monetyo.com/es/privacidad/",
        label: "Privacidad",
      },
      unsubscribe: "https://monetyo.com/es/baja/?id=1&signature=2",
    }
  )

  it("takes its subject and heading from the notice, trimmed", () => {
    expect(email.subject).toBe("A change")
    expect(
      email.text.startsWith("A change\n\nWhat changed.\n\nFrom when.")
    ).toBe(true)
  })

  it("frames the notice with the link to the page, the rights and the reason", () => {
    expect(email.text).toContain(
      "Read the updated page: https://monetyo.com/es/cookies/"
    )
    expect(email.text).toContain("Unsubscribe or write to privacy@monetyo.com.")
    expect(email.text).toContain("You're on the waitlist.")
    expect(email.text).toContain(
      "Unsubscribe: https://monetyo.com/es/baja/?id=1&signature=2"
    )
  })
})
