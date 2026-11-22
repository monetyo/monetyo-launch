import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { signId } from "@/libs/tokens"
import { buildUnsubscribe } from "@/libs/unsubscribe"

const ID = "0b8e4f6c-1d2a-4c3b-9e5f-7a6b5c4d3e2f"

describe("buildUnsubscribe", () => {
  beforeEach(() => {
    vi.stubEnv("UNSUBSCRIBE_SECRET", "secret")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("signs the id into the page link, in the signup's language, and into the one-click headers", () => {
    const signature = signId(ID, "secret")

    expect(
      buildUnsubscribe("https://preview.monetyo.com", { id: ID, locale: "es" })
    ).toEqual({
      headers: {
        "List-Unsubscribe": `<https://preview.monetyo.com/api/unsubscribe/?id=${ID}&signature=${signature}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      href: `https://preview.monetyo.com/es/baja/?id=${ID}&signature=${signature}`,
    })
  })

  it("throws, naming the variable, when the secret is missing", () => {
    vi.stubEnv("UNSUBSCRIBE_SECRET", "")

    expect(() =>
      buildUnsubscribe("https://monetyo.com", { id: ID, locale: "en" })
    ).toThrow("Set `UNSUBSCRIBE_SECRET`")
  })
})
