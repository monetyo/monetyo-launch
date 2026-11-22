import { beforeEach, describe, expect, it, vi } from "vitest"

import { readEmailCopy, readPrivacyLink } from "@/libs/email-copy"

import { files, resetFiles } from "../support/files"

vi.mock("node:fs/promises", () => import("../support/files"))

const FIELDS = ["subject", "body"] as const

describe("readEmailCopy", () => {
  beforeEach(resetFiles)

  it("reads the copy in the recipient's language", async () => {
    files["src/content/emails/survey/es.yaml"] = "subject: Hola\nbody: Cuerpo\n"
    files["src/content/emails/survey/en.yaml"] = "subject: Hi\nbody: Body\n"

    expect(await readEmailCopy("survey", "es", FIELDS)).toEqual({
      body: "Cuerpo",
      subject: "Hola",
    })
  })

  it("throws for a missing language instead of sending another one", async () => {
    files["src/content/emails/survey/en.yaml"] = "subject: Hi\nbody: Body\n"

    await expect(readEmailCopy("survey", "ca", FIELDS)).rejects.toThrow(
      "ENOENT"
    )
  })

  it("throws, naming the field and the file, when a field is missing", async () => {
    files["src/content/emails/survey/it.yaml"] = "subject: Ciao\n"

    await expect(readEmailCopy("survey", "it", FIELDS)).rejects.toThrow(
      "The survey email has no `body`. Add it to src/content/emails/survey/it.yaml."
    )
  })

  it("names the email by its label when it has one, and treats an empty file as missing every field", async () => {
    files["src/content/emails/confirm/es.yaml"] = ""

    await expect(
      readEmailCopy("confirm", "es", FIELDS, { label: "confirmation" })
    ).rejects.toThrow("The confirmation email has no `subject`.")
  })
})

describe("readPrivacyLink", () => {
  beforeEach(resetFiles)

  it("words the link as the site's footer does, pointing at the page in that language", async () => {
    files["src/content/settings/es.yaml"] = `
footer:
  links:
    - { label: Aviso legal, href: /legal-notice/ }
    - { label: Privacidad, href: /privacy/ }
`

    expect(await readPrivacyLink("es", "https://monetyo.com")).toEqual({
      href: "https://monetyo.com/es/privacidad/",
      label: "Privacidad",
    })
  })

  it.each([
    ["has no link to the privacy policy", "footer:\n  links: []\n"],
    ["has no footer", "siteName: Monetyo\n"],
    ["is empty", ""],
  ])("throws, naming the fix, when the settings file %s", async (_, file) => {
    files["src/content/settings/en.yaml"] = file

    await expect(readPrivacyLink("en", "https://monetyo.com")).rejects.toThrow(
      "No privacy policy link in src/content/settings/en.yaml. Add one to `footer.links` with `href: /privacy/`."
    )
  })
})
