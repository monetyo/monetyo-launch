import { describe, expect, it } from "vitest"

import { createToken, hashToken, signId, verifyId } from "@/libs/tokens"

describe("createToken", () => {
  it("gives a different URL-safe token every time", () => {
    const first = createToken()

    expect(first).toMatch(/^[\w-]{43}$/)
    expect(createToken()).not.toBe(first)
  })
})

describe("hashToken", () => {
  it("gives the same token the same hash, and never the token itself", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"))
    expect(hashToken("abc")).toMatch(/^[0-9a-f]{64}$/)
    expect(hashToken("abd")).not.toBe(hashToken("abc"))
  })
})

describe("verifyId", () => {
  const id = "0b8e4f6c-1d2a-4c3b-9e5f-7a6b5c4d3e2f"

  it("accepts the signature the server made", () => {
    expect(verifyId(id, signId(id, "secret"), "secret")).toBe(true)
  })

  it("turns down a signature made with another key or for another id", () => {
    expect(verifyId(id, signId(id, "other"), "secret")).toBe(false)
    expect(verifyId(id, signId("another-id", "secret"), "secret")).toBe(false)
  })

  it("turns down a signature of the wrong length without comparing it", () => {
    expect(verifyId(id, "short", "secret")).toBe(false)
  })
})
