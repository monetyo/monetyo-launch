import type { Locale } from "./i18n.js"

import { createHash, createHmac } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { parse } from "yaml"

/**
 * We decided to read the notice straight from the YAML the page was built
 * from, rather than trust the browser to send it, because a proof record is
 * only worth something if the Visitor can't have written it. `vercel.json`
 * ships these files alongside the `api/` functions, which can't import them.
 */

const CONTENT = join(process.cwd(), "src/content")

/** What a Visitor was shown when they joined the waitlist. */
export interface Notice {
  /**
   * The consent statement under the form's button and the data protection
   * notice, exactly as worded.
   */
  text: string
  /** The privacy policy's "last updated" date, which versions the notice. */
  version: string
}

/**
 * What a proof record proves: that someone joined, that they confirmed the
 * address was theirs, or that they left.
 */
export type Purpose = "confirmation" | "signup" | "withdrawal"

/** Everything a proof record keeps, before it's hashed. */
export interface Proof {
  id: string
  ipHash: string
  locale: Locale
  notice: string
  noticeVersion: string
  page: string
  purpose: Purpose
  recordedAt: string
  /** The signup it's about. Not a key: the two live in separate databases. */
  signupId: string
  userAgent: string
}

/**
 * Reads the notice the waitlist form shows in a locale.
 *
 * @param locale - The page's language, already checked to be one the site has.
 *
 * @returns The notice and the version of the privacy policy it points to.
 *
 * @throws When the content files aren't there, which on Vercel means
 *   `includeFiles` in `vercel.json` no longer covers them.
 */
export async function readNotice(locale: Locale): Promise<Notice> {
  const [settings, privacy] = await Promise.all(
    [`settings/${locale}.yaml`, `pages/privacy/${locale}.yaml`].map(
      async (path) => parse(await readFile(join(CONTENT, path), "utf8"))
    )
  )

  const { consent, notice, privacyLink } = settings.waitlist
  const items = (notice.items as { description: string; term: string }[]).map(
    ({ description, term }) => `${term}: ${description}`
  )

  return {
    // The page shows the consent sentence, then the privacy policy link on
    // its own line, so the proof keeps both exactly as they read.
    text: [consent, privacyLink, notice.heading, ...items].join("\n"),
    version: String(privacy.updated),
  }
}

/**
 * Pseudonymises an IP address: the same address always gives the same hash,
 * which is enough to tell a pattern apart, but without the secret it can't be
 * turned back into the address.
 *
 * @param ip - The Visitor's address.
 * @param secret - The key that makes the hash unguessable.
 *
 * @returns The HMAC-SHA-256, hex encoded.
 */
export function hashIp(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(ip).digest("hex")
}

/**
 * Seals a proof record, so any later change to a stored row shows.
 *
 * @param proof - The record, with every field it will be stored with.
 *
 * @returns The SHA-256 of its fields in a fixed order, hex encoded.
 */
export function hashProof(proof: Proof): string {
  const ordered = Object.fromEntries(
    Object.entries(proof).sort(([a], [b]) => a.localeCompare(b))
  )

  return createHash("sha256").update(JSON.stringify(ordered)).digest("hex")
}
