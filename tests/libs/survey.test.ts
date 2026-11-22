import { beforeEach, describe, expect, it, vi } from "vitest"

import { buildSurvey, readSurvey, type SurveyCopy } from "@/libs/survey"

import { files, resetFiles } from "../support/files"

vi.mock("node:fs/promises", () => import("../support/files"))

const COPY: SurveyCopy = {
  anonymity: "Answers aren't linked to you.",
  body: "We'd like to hear\nfrom you.\n\nIt's short.",
  button: "Take the survey",
  fallback: "Or paste this link:",
  heading: "How does money work in your home?",
  preheader: "A few minutes",
  reason: "You joined the waitlist.",
  subject: "A few questions",
  unsubscribe: "Unsubscribe",
}

const LINKS = {
  privacy: { href: "https://monetyo.com/privacy/", label: "Privacy" },
  survey: "https://tally.so/r/abc",
  unsubscribe: "https://monetyo.com/unsubscribe/?id=1&signature=2",
}

describe("readSurvey", () => {
  beforeEach(resetFiles)

  it("reads the copy in the recipient's own language", async () => {
    files["src/content/emails/survey/it.yaml"] = Object.entries(COPY)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join("\n")

    expect(await readSurvey("it")).toEqual(COPY)
  })

  it("throws, naming the field and the file, when a field is missing", async () => {
    files["src/content/emails/survey/en.yaml"] = "subject: Hi\n"

    await expect(readSurvey("en")).rejects.toThrow(
      "The survey email has no `anonymity`. Add it to src/content/emails/survey/en.yaml."
    )
  })
})

describe("buildSurvey", () => {
  const email = buildSurvey("es", COPY, LINKS)

  it("links the button to the survey, the same link for everyone", () => {
    expect(email.text).toContain("Take the survey: https://tally.so/r/abc")
    expect(email.html).toContain('href="https://tally.so/r/abc"')
  })

  it("says the answers aren't linked to the address, and why it was sent", () => {
    expect(email.text).toContain("Answers aren't linked to you.")
    expect(email.text).toContain("You joined the waitlist.")
  })

  it("splits the body into paragraphs and carries the unsubscribe link", () => {
    expect(email.text).toContain("We'd like to hear from you.\n\nIt's short.")
    expect(email.text).toContain(`Unsubscribe: ${LINKS.unsubscribe}`)
    expect(email.subject).toBe("A few questions")
    expect(email.html).toContain('<html lang="es"')
  })
})
