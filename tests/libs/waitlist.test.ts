import { describe, expect, it } from "vitest"

import {
  checkEmail,
  checkSignup,
  HOUSEHOLDS,
  LIMITS,
  normalizeEmail,
} from "@/libs/waitlist"

const valid = {
  email: "ana@example.com",
  household: "family",
}

describe("checkEmail", () => {
  it("passes an ordinary address, ignoring the space around it", () => {
    expect(checkEmail("  ana@example.com ")).toBeUndefined()
  })

  it("asks for an address when there is none", () => {
    expect(checkEmail("")).toBe("required")
    expect(checkEmail("   ")).toBe("required")
  })

  it("turns down the typo that would leave nowhere to write to", () => {
    expect(checkEmail("ana@example")).toBe("email")
    expect(checkEmail("ana example.com")).toBe("email")
  })

  it("turns down an address longer than any mail server accepts", () => {
    const local = "a".repeat(LIMITS.email)

    expect(checkEmail(`${local}@example.com`)).toBe("tooLong")
  })
})

describe("checkSignup", () => {
  it("passes a complete signup", () => {
    expect(checkSignup(valid)).toEqual({})
  })

  it("passes a signup that leaves the household out", () => {
    expect(checkSignup({ ...valid, household: "" })).toEqual({})
  })

  it("turns down a household the form never offers", () => {
    expect(checkSignup({ ...valid, household: "castle" })).toEqual({
      household: "household",
    })
  })

  it("reports every field that fails at once", () => {
    expect(checkSignup({ email: "", household: "pets" })).toEqual({
      email: "required",
      household: "household",
    })
  })

  it("offers every household the copy has a label for", () => {
    expect(HOUSEHOLDS).toEqual(["solo", "couple", "family", "shared", "other"])
  })
})

describe("normalizeEmail", () => {
  it("trims and lowercases, so the same person signs up once", () => {
    expect(normalizeEmail("  Ana@Example.COM ")).toBe("ana@example.com")
  })
})
