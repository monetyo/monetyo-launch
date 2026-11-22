import { beforeEach, describe, expect, it, vi } from "vitest"

import { buildDeletion, type DeletionCopy, readDeletion } from "@/libs/deletion"

import { files, resetFiles } from "../support/files"

vi.mock("node:fs/promises", () => import("../support/files"))

const COPY: DeletionCopy = {
  body: "We've deleted your address.",
  heading: "You're off the list",
  preheader: "Deleted",
  records: "Records are kept for 3 years without your address.",
  rejoin: "Join again any time.",
  subject: "You've left the Monetyo waitlist",
}

describe("readDeletion", () => {
  beforeEach(resetFiles)

  it("reads the copy in the recipient's own language", async () => {
    files["src/content/emails/deletion/es.yaml"] = Object.entries(COPY)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join("\n")

    expect(await readDeletion("es")).toEqual(COPY)
  })

  it("throws, naming the field and the file, when a field is missing", async () => {
    files["src/content/emails/deletion/en.yaml"] = "subject: Hi\nbody: Bye\n"

    await expect(readDeletion("en")).rejects.toThrow(
      "The deletion email has no `heading`. Add it to src/content/emails/deletion/en.yaml."
    )
  })
})

describe("buildDeletion", () => {
  const email = buildDeletion("en", COPY, {
    href: "https://monetyo.com/privacy/",
    label: "Privacy",
  })

  it("confirms the deletion and says what's kept", () => {
    expect(email.subject).toBe("You've left the Monetyo waitlist")
    expect(email.text).toContain("We've deleted your address.")
    expect(email.text).toContain(
      "Records are kept for 3 years without your address."
    )
    expect(email.text).toContain("Privacy: https://monetyo.com/privacy/")
  })

  it("has no button and no unsubscribe link, since there is nothing left to leave", () => {
    expect(email.text).not.toMatch(/unsubscribe/i)
    expect(email.html).not.toMatch(/unsubscribe/i)
    expect(email.html).not.toContain("border-radius:999px")
  })
})
