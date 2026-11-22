import { describe, expect, it } from "vitest"

import {
  escapeHtml,
  type Layout,
  paragraphs,
  renderEmail,
} from "@/libs/email-layout"

const LAYOUT: Layout = {
  body: ["First <b>paragraph</b>.", "Second & last."],
  button: {
    fallback: "Or paste this link:",
    href: "https://tally.so/r/abc?x=1&y=2",
    label: "Take the survey",
  },
  heading: 'A "quoted" heading',
  locale: "en",
  notes: ["A first note.", "A second note."],
  preheader: "Seen in the inbox",
  privacy: { href: "https://monetyo.com/privacy/", label: "Privacy" },
  reason: "You joined the waitlist.",
  subject: "Subject & more",
  unsubscribe: {
    href: "https://monetyo.com/unsubscribe/?id=1&signature=2",
    label: "Unsubscribe",
  },
}

describe("escapeHtml", () => {
  it("escapes everything that could open a tag or close an attribute", () => {
    expect(escapeHtml(`<a href="x">&</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;"
    )
  })

  it("leaves an apostrophe as it is", () => {
    expect(escapeHtml("You're in")).toBe("You're in")
  })
})

describe("paragraphs", () => {
  it("splits on blank lines and folds the line breaks inside each paragraph", () => {
    expect(paragraphs("One\nline.\n\n  \nTwo.\n")).toEqual([
      "One line.",
      "Two.",
    ])
  })

  it("returns nothing for blank text", () => {
    expect(paragraphs(" \n\n ")).toEqual([])
  })
})

describe("renderEmail", () => {
  const email = renderEmail(LAYOUT)

  it("takes the subject as given", () => {
    expect(email.subject).toBe("Subject & more")
  })

  it("writes the plain text in reading order, with every link in full", () => {
    expect(email.text).toBe(
      [
        'A "quoted" heading',
        "First <b>paragraph</b>.",
        "Second & last.",
        "Take the survey: https://tally.so/r/abc?x=1&y=2",
        "A first note.",
        "A second note.",
        [
          "--",
          "You joined the waitlist.",
          "Privacy: https://monetyo.com/privacy/",
          "Unsubscribe: https://monetyo.com/unsubscribe/?id=1&signature=2",
        ].join("\n"),
      ].join("\n\n")
    )
  })

  it("escapes every piece of copy and every link in the HTML", () => {
    expect(email.html).toContain("<title>Subject &amp; more</title>")
    expect(email.html).toContain("First &lt;b&gt;paragraph&lt;/b&gt;.")
    expect(email.html).toContain("A &quot;quoted&quot; heading")
    expect(email.html).toContain('href="https://tally.so/r/abc?x=1&amp;y=2"')
    expect(email.html).not.toContain("<b>")
  })

  it("sets the language, the preheader and the brand", () => {
    expect(email.html).toContain('<html lang="en" dir="ltr">')
    expect(email.html).toMatch(
      /<div style="display:none;[^"]*">Seen in the inbox/
    )
    expect(email.html).toContain(">monetyo</td>")
    expect(email.html).toContain("background-color:#2341f5")
    expect(email.html).toContain("background-color:#ff6a3d")
  })

  it("keeps every style inline, with no stylesheet or image", () => {
    expect(email.html).not.toMatch(/<style|<img|<svg|<link/)
  })

  it("puts the footer's links under the card", () => {
    expect(email.html).toContain(
      '<a href="https://monetyo.com/unsubscribe/?id=1&amp;signature=2"'
    )
    expect(email.html).toContain(">Privacy</a>")
    expect(email.html).toContain("You joined the waitlist.")
  })

  it("leaves out the button, the notes, the reason and the unsubscribe link when an email has none", () => {
    const bare = renderEmail({
      body: ["Body."],
      heading: "Heading",
      locale: "es",
      preheader: "Preheader",
      privacy: LAYOUT.privacy,
      subject: "Subject",
    })

    expect(bare.text).toBe(
      ["Heading", "Body.", "--\nPrivacy: https://monetyo.com/privacy/"].join(
        "\n\n"
      )
    )
    expect(bare.html).not.toContain("Unsubscribe")
    expect(bare.html).not.toContain("border-radius:999px")
    expect(bare.html).not.toContain("border-top")
    expect(bare.html).toContain('<html lang="es"')
  })
})
