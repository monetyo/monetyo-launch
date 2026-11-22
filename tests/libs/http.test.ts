import { afterEach, describe, expect, it, vi } from "vitest"

import { hasBearer, json, readJson, secret, text } from "@/libs/http"

/**
 * Builds a POST carrying a raw body.
 *
 * @param body - The body, as sent.
 *
 * @returns The request.
 */
function post(body: string) {
  return new Request("https://monetyo.com/api/waitlist/", {
    body,
    method: "POST",
  })
}

describe("json", () => {
  it("answers with JSON that no cache keeps", async () => {
    const response = json({ ok: true }, 201)

    expect(response.status).toBe(201)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.json()).toEqual({ ok: true })
  })

  it("answers 200 by default", () => {
    expect(json({}).status).toBe(200)
  })
})

describe("readJson", () => {
  it("reads an object", async () => {
    expect(await readJson(post('{"a":1}'))).toEqual({ a: 1 })
  })

  it("turns down anything that isn't a JSON object", async () => {
    expect(await readJson(post("not json"))).toBeUndefined()
    expect(await readJson(post("[1]"))).toBeUndefined()
    expect(await readJson(post("null"))).toBeUndefined()
    expect(await readJson(post('"text"'))).toBeUndefined()
  })
})

describe("text", () => {
  it("reads a string field and treats anything else as empty", () => {
    expect(text({ a: "x", b: 1 }, "a")).toBe("x")
    expect(text({ a: "x", b: 1 }, "b")).toBe("")
    expect(text({}, "c")).toBe("")
  })
})

describe("secret", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("reads a secret that is set", () => {
    vi.stubEnv("SOME_SECRET", "value")

    expect(secret("SOME_SECRET")).toBe("value")
  })

  it("throws, naming the variable, when it isn't", () => {
    vi.stubEnv("SOME_SECRET", "")

    expect(() => secret("SOME_SECRET")).toThrow("Set `SOME_SECRET`")
  })
})

describe("hasBearer", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  /**
   * Builds a request carrying an `Authorization` header, if any.
   *
   * @param authorization - The header's value.
   *
   * @returns The request.
   */
  function withAuth(authorization?: string) {
    return new Request("https://monetyo.com/api/notify/", {
      headers: authorization ? { authorization } : {},
    })
  }

  it("accepts the secret as a bearer token", () => {
    vi.stubEnv("SOME_SECRET", "s3cret")

    expect(hasBearer(withAuth("Bearer s3cret"), "SOME_SECRET")).toBe(true)
  })

  it("turns down a wrong, partial, longer or missing token", () => {
    vi.stubEnv("SOME_SECRET", "s3cret")

    expect(hasBearer(withAuth("Bearer guess"), "SOME_SECRET")).toBe(false)
    expect(hasBearer(withAuth("Bearer s3cre"), "SOME_SECRET")).toBe(false)
    expect(hasBearer(withAuth("Bearer s3cret!"), "SOME_SECRET")).toBe(false)
    expect(hasBearer(withAuth("s3cret"), "SOME_SECRET")).toBe(false)
    expect(hasBearer(withAuth(), "SOME_SECRET")).toBe(false)
  })

  it("turns everything down when the secret isn't set", () => {
    vi.stubEnv("SOME_SECRET", "")

    expect(hasBearer(withAuth("Bearer "), "SOME_SECRET")).toBe(false)
    expect(hasBearer(withAuth("Bearer undefined"), "SOME_SECRET")).toBe(false)
  })
})
