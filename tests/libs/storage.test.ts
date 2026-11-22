import type { Proof } from "@/libs/consent"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const neon = vi.hoisted(() => {
  /** Every database the module connected to, by its connection string. */
  const databases = new Map<
    string,
    ReturnType<typeof vi.fn> & { query: ReturnType<typeof vi.fn> }
  >()

  return {
    databases,
    neon: vi.fn((url: string) => {
      if (!databases.has(url)) {
        databases.set(
          url,
          Object.assign(
            vi.fn(async () => []),
            { query: vi.fn(async () => []) }
          )
        )
      }

      return databases.get(url)
    }),
  }
})

vi.mock("@neondatabase/serverless", () => ({ neon: neon.neon }))

const WAITLIST = "postgres://waitlist"
const CONSENT = "postgres://consent"

/**
 * Loads the module afresh, so no test inherits the tables another created.
 *
 * @returns The module.
 */
async function load() {
  vi.resetModules()

  return import("@/libs/storage")
}

/**
 * Makes a database answer its next query with these rows.
 *
 * @param url - The database's connection string.
 * @param rows - What the query returns.
 */
async function answer(url: string, rows: unknown[]) {
  neon.neon(url)
  neon.databases.get(url)!.mockResolvedValueOnce(rows)
}

/**
 * Reads back one query a database ran.
 *
 * @param url - The database's connection string.
 * @param call - Which query, in order.
 *
 * @returns Its SQL, whitespace folded, and its values.
 */
function query(url: string, call = 0) {
  const [strings, ...values] = neon.databases.get(url)!.mock.calls[call] as [
    TemplateStringsArray,
    ...unknown[],
  ]

  return { sql: strings.join("?").replace(/\s+/g, " ").trim(), values }
}

const PENDING = {
  createdAt: "2026-11-18T12:00:00.000Z",
  email: "ana@example.com",
  household: "family",
  id: "0b8e4f6c-1d2a-4c3b-9e5f-7a6b5c4d3e2f",
  locale: "es",
  page: "/es/",
  tokenHash: "hash",
}

const PROOF: Proof = {
  id: "7c1e0f7a-5a54-4c55-8e44-0d1c6b9f8a21",
  ipHash: "ip",
  locale: "es",
  notice: "Notice",
  noticeVersion: "2026-11-18",
  page: "/es/",
  purpose: "signup",
  recordedAt: PENDING.createdAt,
  signupId: PENDING.id,
  userAgent: "Firefox",
}

describe("storage", () => {
  beforeEach(() => {
    vi.stubEnv("DB_WAITLIST_DATABASE_URL", WAITLIST)
    vi.stubEnv("DB_CONSENT_DATABASE_URL", CONSENT)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    neon.databases.clear()
    neon.neon.mockClear()
  })

  describe("storePending", () => {
    it("creates the table once, then upserts the signup without touching a confirmed one", async () => {
      const { storePending } = await load()

      await answer(WAITLIST, [{ id: PENDING.id }])

      expect(await storePending(PENDING)).toBe(PENDING.id)
      await storePending(PENDING)

      const database = neon.databases.get(WAITLIST)!

      expect(database.query).toHaveBeenCalledOnce()
      expect(database.query.mock.calls[0][0]).toContain(
        "CREATE TABLE IF NOT EXISTS signups"
      )

      const { sql, values } = query(WAITLIST)

      expect(sql).toContain("ON CONFLICT (email) DO UPDATE")
      expect(sql).toContain("WHERE signups.status = 'pending'")
      expect(values).toEqual([
        PENDING.id,
        PENDING.email,
        PENDING.household,
        PENDING.locale,
        PENDING.page,
        PENDING.tokenHash,
        PENDING.createdAt,
      ])
    })

    it("returns nothing for an address that is already confirmed", async () => {
      const { storePending } = await load()

      expect(await storePending(PENDING)).toBeUndefined()
    })

    it("throws, naming the variable, when the database isn't connected", async () => {
      vi.stubEnv("DB_WAITLIST_DATABASE_URL", "")
      const { storePending } = await load()

      await expect(storePending(PENDING)).rejects.toThrow(
        "`DB_WAITLIST_DATABASE_URL`"
      )
    })

    it("tries creating the table again after a failed attempt", async () => {
      const { storePending } = await load()

      neon.neon(WAITLIST)
      neon.databases
        .get(WAITLIST)!
        .query.mockRejectedValueOnce(new Error("connection reset"))

      await expect(storePending(PENDING)).rejects.toThrow("connection reset")
      await storePending(PENDING)

      expect(neon.databases.get(WAITLIST)!.query).toHaveBeenCalledTimes(2)
    })
  })

  describe("confirmPending", () => {
    it("confirms the signup the token belongs to while its link is valid", async () => {
      const { confirmPending, RETENTION } = await load()
      const row = { email: PENDING.email, id: PENDING.id, locale: "es" }

      await answer(WAITLIST, [row])

      expect(await confirmPending("hash")).toEqual(row)

      const { sql, values } = query(WAITLIST)

      expect(sql).toContain("SET status = 'confirmed'")
      expect(sql).toContain("token_hash = NULL")
      expect(values).toEqual(["hash", RETENTION.pending])
    })

    it("returns nothing for an unknown or expired token", async () => {
      const { confirmPending } = await load()

      expect(await confirmPending("hash")).toBeUndefined()
    })
  })

  describe("deleteSignup", () => {
    it("deletes the signup and returns its address and locale", async () => {
      const { deleteSignup } = await load()

      await answer(WAITLIST, [{ email: PENDING.email, locale: "es" }])

      expect(await deleteSignup(PENDING.id)).toEqual({
        email: PENDING.email,
        locale: "es",
      })
      expect(query(WAITLIST).sql).toContain("RETURNING email, locale")
      expect(query(WAITLIST).values).toEqual([PENDING.id])
    })

    it("returns nothing when it was already gone", async () => {
      const { deleteSignup } = await load()

      expect(await deleteSignup(PENDING.id)).toBeUndefined()
    })
  })

  describe("listConfirmed", () => {
    it("lists only confirmed signups, longest on the list first", async () => {
      const { listConfirmed } = await load()
      const rows = [{ email: PENDING.email, id: PENDING.id, locale: "es" }]

      await answer(WAITLIST, rows)

      expect(await listConfirmed()).toEqual(rows)
      expect(query(WAITLIST).sql).toContain("WHERE status = 'confirmed'")
      expect(query(WAITLIST).sql).toContain("ORDER BY confirmed_at")
    })
  })

  describe("deleteExpiredSignups", () => {
    it("deletes stale pending signups and any past the list's retention", async () => {
      const { deleteExpiredSignups, RETENTION } = await load()

      await answer(WAITLIST, [{ id: "a" }, { id: "b" }])

      expect(await deleteExpiredSignups()).toBe(2)
      expect(query(WAITLIST).values).toEqual([
        RETENTION.pending,
        RETENTION.signups,
      ])
    })
  })

  describe("storeProof", () => {
    it("stores the record in the consent database, sealed with its hash", async () => {
      const { storeProof } = await load()
      const { hashProof } = await import("@/libs/consent")

      await storeProof(PROOF)

      expect(neon.databases.has(WAITLIST)).toBe(false)
      expect(query(CONSENT).values).toEqual([
        PROOF.id,
        PROOF.signupId,
        PROOF.recordedAt,
        PROOF.purpose,
        PROOF.locale,
        PROOF.page,
        PROOF.notice,
        PROOF.noticeVersion,
        PROOF.userAgent,
        PROOF.ipHash,
        hashProof(PROOF),
      ])
    })
  })

  describe("deleteExpiredProofs", () => {
    it("deletes the records past their retention", async () => {
      const { deleteExpiredProofs, RETENTION } = await load()

      await answer(CONSENT, [{ id: "a" }])

      expect(await deleteExpiredProofs()).toBe(1)
      expect(query(CONSENT).values).toEqual([RETENTION.proofs])
    })
  })

  describe("recordBroadcast", () => {
    const BROADCAST = {
      delivered: 9,
      failed: 1,
      id: "5d3c1b2a-0f9e-4d8c-8b7a-6f5e4d3c2b1a",
      policyVersion: "2026-11-22",
      recipients: 10,
      sentAt: PENDING.createdAt,
      subject: "A few questions",
      template: "survey",
    }

    it("stores the counts in the consent database, with no address", async () => {
      const { recordBroadcast } = await load()

      await recordBroadcast(BROADCAST)

      expect(neon.databases.has(WAITLIST)).toBe(false)
      expect(query(CONSENT).values).toEqual([
        BROADCAST.id,
        BROADCAST.sentAt,
        BROADCAST.template,
        BROADCAST.subject,
        BROADCAST.policyVersion,
        BROADCAST.recipients,
        BROADCAST.delivered,
        BROADCAST.failed,
      ])
    })

    it("creates its own table even when the proofs table already exists there", async () => {
      const { recordBroadcast, storeProof } = await load()

      await storeProof(PROOF)
      await recordBroadcast(BROADCAST)

      const schemas = neon.databases
        .get(CONSENT)!
        .query.mock.calls.map(([schema]) => String(schema))

      expect(schemas).toHaveLength(2)
      expect(schemas[0]).toContain("CREATE TABLE IF NOT EXISTS proofs")
      expect(schemas[1]).toContain("CREATE TABLE IF NOT EXISTS broadcasts")
    })
  })
})
