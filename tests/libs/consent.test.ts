import { beforeEach, describe, expect, it, vi } from "vitest"

import { hashIp, hashProof, type Proof, readNotice } from "@/libs/consent"

import { files, resetFiles } from "../support/files"

vi.mock("node:fs/promises", () => import("../support/files"))

const PROOF: Proof = {
  id: "7c1e0f7a-5a54-4c55-8e44-0d1c6b9f8a21",
  ipHash: "ip",
  locale: "en",
  notice: "Notice",
  noticeVersion: "2026-11-18",
  page: "/",
  purpose: "signup",
  recordedAt: "2026-11-18T12:00:00.000Z",
  signupId: "0b8e4f6c-1d2a-4c3b-9e5f-7a6b5c4d3e2f",
  userAgent: "Firefox",
}

describe("readNotice", () => {
  beforeEach(() => {
    resetFiles()
    files["src/content/settings/en.yaml"] = `
waitlist:
  consent: You will get launch news.
  privacyLink: Privacy policy
  notice:
    heading: Data protection
    items:
      - term: Data controller
        description: Luca Pipolo
      - term: Purpose
        description: Launch news
`
    files["src/content/pages/privacy/en.yaml"] = "updated: 2026-11-18\n"
  })

  it("puts the consent statement, the privacy link, the heading and each item in order, one per line", async () => {
    expect((await readNotice("en")).text).toBe(
      [
        "You will get launch news.",
        "Privacy policy",
        "Data protection",
        "Data controller: Luca Pipolo",
        "Purpose: Launch news",
      ].join("\n")
    )
  })

  it("versions the notice by the privacy policy's last update", async () => {
    expect((await readNotice("en")).version).toBe("2026-11-18")
  })

  it("throws when a locale's content files are missing", async () => {
    await expect(readNotice("es")).rejects.toThrow("ENOENT")
  })
})

describe("hashIp", () => {
  it("gives the same address the same hash, and a different one another", () => {
    expect(hashIp("203.0.113.7", "secret")).toBe(
      hashIp("203.0.113.7", "secret")
    )
    expect(hashIp("203.0.113.8", "secret")).not.toBe(
      hashIp("203.0.113.7", "secret")
    )
  })

  it("depends on the secret, so the hash can't be looked up", () => {
    expect(hashIp("203.0.113.7", "other")).not.toBe(
      hashIp("203.0.113.7", "secret")
    )
  })
})

describe("hashProof", () => {
  it("hashes the same record the same way whatever order its keys are in", () => {
    const reversed = Object.fromEntries(
      Object.entries(PROOF).reverse()
    ) as unknown as Proof

    expect(hashProof(reversed)).toBe(hashProof(PROOF))
  })

  it("changes when any field does", () => {
    expect(hashProof({ ...PROOF, notice: "Changed" })).not.toBe(
      hashProof(PROOF)
    )
  })
})
