import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  buildConfirmation,
  type ConfirmationCopy,
  readConfirmation,
} from "@/libs/confirmation"

import { files, resetFiles } from "../support/files"

vi.mock("node:fs/promises", () => import("../support/files"))

const COPY: ConfirmationCopy = {
  body: "Confirm it's you <and> nobody else.",
  button: "Confirm my email",
  fallback: "Or paste this link:",
  heading: "One more step",
  ignore: "Didn't sign up? Ignore this.",
  preheader: "Confirm your email",
  subject: "Confirm your place on the Monetyo waitlist",
  unsubscribe: "Unsubscribe",
}

const LINKS = {
  confirm: "https://monetyo.com/confirm/?token=a&b",
  privacy: { href: "https://monetyo.com/privacy/", label: "Privacy" },
  unsubscribe: "https://monetyo.com/unsubscribe/?id=1&signature=2",
}

describe("readConfirmation", () => {
  beforeEach(() => {
    resetFiles()
  })

  it("reads the copy for a locale", async () => {
    files["src/content/emails/confirm/es.yaml"] = Object.entries(COPY)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join("\n")

    expect(await readConfirmation("es")).toEqual(COPY)
  })

  it("throws, naming the field and the file, when a field is missing", async () => {
    files["src/content/emails/confirm/es.yaml"] = "subject: Hi\n"

    await expect(readConfirmation("es")).rejects.toThrow(
      "The confirmation email has no `body`. Add it to src/content/emails/confirm/es.yaml"
    )
  })

  it("never falls back to another language, since every signup gets one", async () => {
    files["src/content/emails/confirm/en.yaml"] = "subject: Hi\n"

    await expect(readConfirmation("ca")).rejects.toThrow("ENOENT")
  })

  it("throws when the file is empty", async () => {
    files["src/content/emails/confirm/es.yaml"] = ""

    await expect(readConfirmation("es")).rejects.toThrow("no `body`")
  })
})

describe("buildConfirmation", () => {
  const email = buildConfirmation("es", COPY, LINKS)

  it("takes its subject from the copy", () => {
    expect(email.subject).toBe(COPY.subject)
  })

  it("writes both links out in full in the plain text", () => {
    expect(email.text).toContain(`Confirm my email: ${LINKS.confirm}`)
    expect(email.text).toContain(`Unsubscribe: ${LINKS.unsubscribe}`)
    expect(email.text).toContain("Privacy: https://monetyo.com/privacy/")
  })

  it("puts the copy on the shared layout, in the Visitor's language", () => {
    expect(email.html).toContain('<html lang="es"')
    expect(email.html).toContain("Confirm your email")
    expect(email.html).toContain("Didn't sign up? Ignore this.")
  })

  it("escapes the copy and the links in the HTML", () => {
    expect(email.html).toContain("Confirm it's you")
    expect(email.html).toContain("&lt;and&gt;")
    expect(email.html).toContain(
      'href="https://monetyo.com/confirm/?token=a&amp;b"'
    )
    expect(email.html).not.toContain("<and>")
  })
})
