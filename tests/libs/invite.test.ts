import { beforeEach, describe, expect, it, vi } from "vitest"

import { buildInvite, type InviteCopy, readInvite } from "@/libs/invite"

import { files, resetFiles } from "../support/files"

vi.mock("node:fs/promises", () => import("../support/files"))

const COPY: InviteCopy = {
  body: "It's ready.",
  button: "Try Monetyo",
  fallback: "Or paste this link:",
  feedback: "Reply and tell us.",
  heading: "Your invitation",
  preheader: "You're among the first",
  reason: "You joined the waitlist.",
  subject: "Monetyo is ready for you to try",
  unsubscribe: "Unsubscribe",
}

describe("readInvite", () => {
  beforeEach(resetFiles)

  it("reads the copy in the recipient's own language", async () => {
    files["src/content/emails/invite/ca.yaml"] = Object.entries(COPY)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join("\n")

    expect(await readInvite("ca")).toEqual(COPY)
  })

  it("throws, naming the field and the file, when a field is missing", async () => {
    files["src/content/emails/invite/en.yaml"] = "subject: Hi\n"

    await expect(readInvite("en")).rejects.toThrow(
      "The invite email has no `body`. Add it to src/content/emails/invite/en.yaml."
    )
  })
})

describe("buildInvite", () => {
  const email = buildInvite("en", COPY, {
    app: "https://app.monetyo.com/join",
    privacy: { href: "https://monetyo.com/privacy/", label: "Privacy" },
    unsubscribe: "https://monetyo.com/unsubscribe/?id=1&signature=2",
  })

  it("links the button to the app", () => {
    expect(email.text).toContain("Try Monetyo: https://app.monetyo.com/join")
    expect(email.html).toContain('href="https://app.monetyo.com/join"')
  })

  it("asks for feedback, and carries the reason and the unsubscribe link", () => {
    expect(email.subject).toBe("Monetyo is ready for you to try")
    expect(email.text).toContain("Reply and tell us.")
    expect(email.text).toContain("You joined the waitlist.")
    expect(email.text).toContain(
      "Unsubscribe: https://monetyo.com/unsubscribe/?id=1&signature=2"
    )
  })
})
