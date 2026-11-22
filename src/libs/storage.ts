import { neon } from "@neondatabase/serverless"

import { hashProof, type Proof } from "./consent.js"

/**
 * We decided to keep signups and proof records in two separate databases,
 * with their own credentials, because they're kept for different lengths of
 * time and for different reasons: a leak or a mistake in one never reaches
 * the other. Both are Neon projects in Frankfurt, since the product promises
 * EU data residency for everything it stores.
 */

/**
 * How long each is kept, as Postgres intervals. The privacy policy promises
 * these exact periods in every language, so changing one means changing it
 * there too.
 */
export const RETENTION = {
  /** How long a confirmation link works before the address is forgotten. */
  pending: "7 days",
  /** Long enough to reach everyone at launch and for the year after it. */
  signups: "24 months",
  /**
   * Longer than any signup is kept, so a proof outlives what it proves: the
   * most time a data protection authority has to act on an infringement.
   */
  proofs: "3 years",
} as const

/** A signup, as it's kept until its address is confirmed. */
export interface PendingSignup {
  createdAt: string
  email: string
  household: string | null
  id: string
  locale: string
  page: string
  tokenHash: string
}

/** A signup whose address was just confirmed. */
export interface ConfirmedSignup {
  email: string
  id: string
  locale: string
}

const SIGNUPS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS signups (
    id uuid PRIMARY KEY,
    email text NOT NULL UNIQUE,
    household text,
    locale text NOT NULL,
    page text NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'confirmed')),
    token_hash text UNIQUE,
    created_at timestamptz NOT NULL,
    confirmed_at timestamptz
  )`

const PROOFS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS proofs (
    id uuid PRIMARY KEY,
    signup_id uuid NOT NULL,
    recorded_at timestamptz NOT NULL,
    purpose text NOT NULL,
    locale text NOT NULL,
    page text NOT NULL,
    notice text NOT NULL,
    notice_version text NOT NULL,
    user_agent text NOT NULL,
    ip_hash text NOT NULL,
    record_hash text NOT NULL
  )`

// Each preview starts on a fresh copy of the database, so the tables are
// created on first use rather than by a migration someone has to remember.
const ready = new Map<string, Promise<unknown>>()

/**
 * Connects to a database, creating the table the first time this instance
 * uses it.
 *
 * @param variable - The environment variable holding the connection string.
 * @param schema - The `CREATE TABLE` statement for the table to use.
 *
 * @returns A query function for that database.
 *
 * @throws When the variable isn't set.
 */
async function connect(variable: string, schema: string) {
  const url = process.env[variable]

  if (!url) {
    throw new Error(
      `No database to store in. Connect the Neon database to this Vercel environment so it sets \`${variable}\`.`
    )
  }

  const sql = neon(url)
  // One database can hold more than one table, so each is tracked on its own.
  const key = `${variable} ${schema}`

  if (!ready.has(key)) ready.set(key, sql.query(schema))

  try {
    await ready.get(key)
  } catch (error) {
    ready.delete(key)
    throw error
  }

  return sql
}

/**
 * Stores a signup waiting for its address to be confirmed.
 *
 * Signing up again before confirming replaces the token, so only the latest
 * email's link works, and keeps the original id. An address already confirmed
 * is left as it is.
 *
 * @param signup - The signup, as it passed every check.
 *
 * @returns The id it's stored under, or `undefined` when the address is
 *   already confirmed and there is nothing to send.
 */
export async function storePending(
  signup: PendingSignup
): Promise<string | undefined> {
  const sql = await connect("DB_WAITLIST_DATABASE_URL", SIGNUPS_SCHEMA)

  const rows = await sql`
    INSERT INTO signups (id, email, household, locale, page, status, token_hash, created_at)
    VALUES (${signup.id}, ${signup.email}, ${signup.household}, ${signup.locale},
      ${signup.page}, 'pending', ${signup.tokenHash}, ${signup.createdAt})
    ON CONFLICT (email) DO UPDATE SET
      household = excluded.household,
      locale = excluded.locale,
      page = excluded.page,
      token_hash = excluded.token_hash,
      created_at = excluded.created_at
    WHERE signups.status = 'pending'
    RETURNING id`

  return (rows[0] as { id: string } | undefined)?.id
}

/**
 * Confirms the signup a token belongs to, as long as its link hasn't expired.
 *
 * @param tokenHash - The hash of the token the link carried.
 *
 * @returns The signup, or `undefined` when no pending signup has that token
 *   within {@link RETENTION}'s pending window.
 */
export async function confirmPending(
  tokenHash: string
): Promise<ConfirmedSignup | undefined> {
  const sql = await connect("DB_WAITLIST_DATABASE_URL", SIGNUPS_SCHEMA)

  const rows = await sql`
    UPDATE signups
    SET status = 'confirmed', confirmed_at = now(), token_hash = NULL
    WHERE token_hash = ${tokenHash}
      AND status = 'pending'
      AND created_at > now() - ${RETENTION.pending}::interval
    RETURNING id, email, locale`

  return rows[0] as ConfirmedSignup | undefined
}

/** A signup that was just deleted, as much as it takes to tell its owner. */
export interface DeletedSignup {
  email: string
  locale: string
}

/**
 * Deletes a signup, whatever state it's in.
 *
 * @param id - The signup's id.
 *
 * @returns Its address and the locale it signed up in, to confirm the
 *   deletion to them, or `undefined` when it was already gone.
 */
export async function deleteSignup(
  id: string
): Promise<DeletedSignup | undefined> {
  const sql = await connect("DB_WAITLIST_DATABASE_URL", SIGNUPS_SCHEMA)

  const rows = await sql`
    DELETE FROM signups WHERE id = ${id} RETURNING email, locale`

  return rows[0] as DeletedSignup | undefined
}

/** Someone on the list, as much as an email to them needs. */
export interface Recipient {
  email: string
  id: string
  locale: string
}

/**
 * Lists everyone whose address is confirmed, the only people the list may
 * email beyond the confirmation itself.
 *
 * @returns Each of them, longest on the list first.
 */
export async function listConfirmed(): Promise<Recipient[]> {
  const sql = await connect("DB_WAITLIST_DATABASE_URL", SIGNUPS_SCHEMA)

  return (await sql`
    SELECT id, email, locale FROM signups
    WHERE status = 'confirmed'
    ORDER BY confirmed_at`) as Recipient[]
}

/**
 * Deletes what's been kept longer than {@link RETENTION} allows: a signup
 * never confirmed past its link's life, and any signup past the list's.
 *
 * @returns How many were deleted.
 */
export async function deleteExpiredSignups(): Promise<number> {
  const sql = await connect("DB_WAITLIST_DATABASE_URL", SIGNUPS_SCHEMA)

  const deleted = await sql`
    DELETE FROM signups
    WHERE (status = 'pending' AND created_at < now() - ${RETENTION.pending}::interval)
      OR created_at < now() - ${RETENTION.signups}::interval
    RETURNING id`

  return deleted.length
}

/**
 * Stores a proof record.
 *
 * @param proof - The record, sealed here with its own hash.
 */
export async function storeProof(proof: Proof): Promise<void> {
  const sql = await connect("DB_CONSENT_DATABASE_URL", PROOFS_SCHEMA)

  await sql`
    INSERT INTO proofs (id, signup_id, recorded_at, purpose, locale, page,
      notice, notice_version, user_agent, ip_hash, record_hash)
    VALUES (${proof.id}, ${proof.signupId}, ${proof.recordedAt}, ${proof.purpose},
      ${proof.locale}, ${proof.page}, ${proof.notice}, ${proof.noticeVersion},
      ${proof.userAgent}, ${proof.ipHash}, ${hashProof(proof)})`
}

/**
 * Deletes the proof records kept longer than {@link RETENTION} allows.
 *
 * @returns How many were deleted.
 */
export async function deleteExpiredProofs(): Promise<number> {
  const sql = await connect("DB_CONSENT_DATABASE_URL", PROOFS_SCHEMA)

  const deleted = await sql`
    DELETE FROM proofs
    WHERE recorded_at < now() - ${RETENTION.proofs}::interval
    RETURNING id`

  return deleted.length
}

const BROADCASTS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS broadcasts (
    id uuid PRIMARY KEY,
    sent_at timestamptz NOT NULL,
    template text NOT NULL,
    subject text NOT NULL,
    policy_version text NOT NULL,
    recipients integer NOT NULL,
    delivered integer NOT NULL,
    failed integer NOT NULL
  )`

/** What an email to the whole list leaves behind: no address, only counts. */
export interface Broadcast {
  delivered: number
  failed: number
  id: string
  /** The privacy policy's `updated` date when it went out. */
  policyVersion: string
  recipients: number
  sentAt: string
  /** In the default locale. */
  subject: string
  template: string
}

/**
 * Records that an email went out to the list, kept with the consent records
 * as proof of when people were told what, such as a change to a legal page.
 *
 * @param broadcast - When, which email, and how many it reached.
 */
export async function recordBroadcast(broadcast: Broadcast): Promise<void> {
  const sql = await connect("DB_CONSENT_DATABASE_URL", BROADCASTS_SCHEMA)

  await sql`
    INSERT INTO broadcasts (id, sent_at, template, subject, policy_version,
      recipients, delivered, failed)
    VALUES (${broadcast.id}, ${broadcast.sentAt}, ${broadcast.template},
      ${broadcast.subject}, ${broadcast.policyVersion}, ${broadcast.recipients},
      ${broadcast.delivered}, ${broadcast.failed})`
}
