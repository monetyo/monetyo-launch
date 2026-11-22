import { describe, expect, it } from "vitest"

import { protect, protectText } from "@/libs/obfuscate"

describe("protect", () => {
  it("turns a mailto link into a reversed one the browser restores", () => {
    expect(
      protect(
        'Write to <a href="mailto:privacy@monetyo.com">privacy@monetyo.com</a>.'
      )
    ).toBe(
      'Write to <a class="protected" data-mailto="">moc.oytenom@ycavirp</a>.'
    )
  })

  it("reverses a linked address only once, even with a dot before the @", () => {
    expect(
      protect('<a href="mailto:luca.p@monetyo.com">luca.p@monetyo.com</a>')
    ).toBe('<a class="protected" data-mailto="">moc.oytenom@p.acul</a>')
  })

  it("reverses an address written as plain text", () => {
    expect(protect("or write to hello@monetyo.com.")).toBe(
      'or write to <span class="protected">moc.oytenom@olleh</span>.'
    )
  })

  it("reverses the owner's details wherever they appear in the text", () => {
    expect(protect("Luca Pipolo, NIF Y4675193C")).toBe(
      '<span class="protected">olopiP acuL</span>, NIF <span class="protected">C3915764Y</span>'
    )
  })

  it("leaves tags and their attributes alone", () => {
    const html =
      '<a href="https://example.com/?ref=hello@monetyo.com">Example</a>'

    expect(protect(html)).toBe(html)
  })

  it("keeps characters with accents whole when reversing", () => {
    expect(protect("Carrer de Bailèn 41, 1º 2ªB, 08010 Barcelona")).toBe(
      '<span class="protected">anolecraB 01080 ,Bª2 º1 ,14 nèliaB ed rerraC</span>'
    )
  })
})

describe("protectText", () => {
  it("escapes plain text before protecting it", () => {
    expect(protectText("<b>Luca Pipolo</b>")).toBe(
      '&lt;b&gt;<span class="protected">olopiP acuL</span>&lt;/b&gt;'
    )
  })
})
