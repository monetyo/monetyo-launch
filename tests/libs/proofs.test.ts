import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { hashIp } from "@/libs/consent"
import { recordProof } from "@/libs/proofs"
import { storeProof } from "@/libs/storage"

import { files, resetFiles } from "../support/files"

vi.mock("node:fs/promises", () => import("../support/files"))
vi.mock("@/libs/storage", () => ({ storeProof: vi.fn() }))

const SUBJECT = {
  locale: "en",
  page: "/",
  purpose: "signup",
  signupId: "0b8e4f6c-1d2a-4c3b-9e5f-7a6b5c4d3e2f",
} as const

/**
 * Builds the request a proof is recorded for.
 *
 * @param headers - The request's headers.
 *
 * @returns The request.
 */
function request(headers: Record<string, string>) {
  return new Request("https://monetyo.com/api/waitlist/", {
    headers,
    method: "POST",
  })
}

describe("recordProof", () => {
  beforeEach(() => {
    resetFiles()
    files["src/content/settings/en.yaml"] = `
waitlist:
  consent: Yes, keep me posted.
  privacyLink: Privacy policy
  notice:
    heading: Data protection
    items: []
`
    files["src/content/pages/privacy/en.yaml"] = "updated: 2026-11-18\n"
    vi.stubEnv("CONSENT_IP_HASH_SECRET", "pepper")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.mocked(storeProof).mockReset()
  })

  it("stores the notice, a hashed address and the trimmed browser", async () => {
    await recordProof(
      request({
        "user-agent": "x".repeat(600),
        "x-real-ip": "203.0.113.7",
      }),
      SUBJECT
    )

    const proof = vi.mocked(storeProof).mock.calls[0][0]

    expect(proof).toMatchObject({
      ...SUBJECT,
      ipHash: hashIp("203.0.113.7", "pepper"),
      notice: "Yes, keep me posted.\nPrivacy policy\nData protection",
      noticeVersion: "2026-11-18",
    })
    expect(proof.userAgent).toHaveLength(512)
    expect(proof.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(Date.parse(proof.recordedAt)).not.toBeNaN()
  })

  it("stores empty values when the request has no address or browser", async () => {
    await recordProof(request({}), SUBJECT)

    expect(vi.mocked(storeProof).mock.calls[0][0]).toMatchObject({
      ipHash: hashIp("", "pepper"),
      userAgent: "",
    })
  })

  it("throws before storing anything when the secret isn't set", async () => {
    vi.stubEnv("CONSENT_IP_HASH_SECRET", "")

    await expect(recordProof(request({}), SUBJECT)).rejects.toThrow(
      "`CONSENT_IP_HASH_SECRET`"
    )
    expect(storeProof).not.toHaveBeenCalled()
  })
})
