import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { deleteExpiredProofs, deleteExpiredSignups } from "@/libs/storage"

import cleanup from "../../api/cleanup"

vi.mock("@/libs/storage", () => ({
  deleteExpiredProofs: vi.fn(),
  deleteExpiredSignups: vi.fn(),
}))

/**
 * Calls the job the way Vercel's scheduler does.
 *
 * @param authorization - The header it sends.
 *
 * @returns The function's response.
 */
function run(authorization?: string): Promise<Response> {
  return cleanup.fetch(
    new Request("https://monetyo.com/api/cleanup/", {
      headers: authorization ? { authorization } : {},
    })
  )
}

describe("api/cleanup", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "cron")
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(deleteExpiredSignups).mockResolvedValue(3)
    vi.mocked(deleteExpiredProofs).mockResolvedValue(1)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("reports how many rows each database lost", async () => {
    const response = await run("Bearer cron")

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ proofs: 1, signups: 3 })
  })

  it("refuses a call without the secret", async () => {
    expect((await run()).status).toBe(401)
    expect((await run("Bearer wrong")).status).toBe(401)
    expect(deleteExpiredSignups).not.toHaveBeenCalled()
  })

  it("refuses every call while the secret isn't set", async () => {
    vi.stubEnv("CRON_SECRET", "")

    expect((await run("Bearer undefined")).status).toBe(401)
  })

  it("runs the other cleanup when one fails, and answers 500", async () => {
    vi.mocked(deleteExpiredProofs).mockRejectedValue(new Error("down"))

    const response = await run("Bearer cron")

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ proofs: "failed", signups: 3 })
  })
})
