import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto"

/**
 * We decided to email a random token and keep only its hash, so that someone
 * reading the database still can't confirm an address that isn't theirs. The
 * unsubscribe link is signed instead, because it has to keep working for as
 * long as the address stays on the list, long after any token would expire.
 */

/**
 * Creates a token for a confirmation link.
 *
 * @returns 32 random bytes, base64url encoded so they sit in a URL as-is.
 */
export function createToken(): string {
  return randomBytes(32).toString("base64url")
}

/**
 * Hashes a token for storage and lookup.
 *
 * @param token - The token as the link carries it.
 *
 * @returns The SHA-256, hex encoded.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/**
 * Signs a signup id for an unsubscribe link.
 *
 * @param id - The signup's id.
 * @param secret - The key only the server knows.
 *
 * @returns The HMAC-SHA-256, base64url encoded.
 */
export function signId(id: string, secret: string): string {
  return createHmac("sha256", secret).update(id).digest("base64url")
}

/**
 * Checks an unsubscribe link's signature, in constant time so its timing gives
 * nothing away about how close a guess came.
 *
 * @param id - The signup id the link names.
 * @param signature - The signature the link carries.
 * @param secret - The key it was signed with.
 *
 * @returns Whether the signature is genuine.
 */
export function verifyId(
  id: string,
  signature: string,
  secret: string
): boolean {
  const expected = Buffer.from(signId(id, secret))
  const given = Buffer.from(signature)

  return expected.length === given.length && timingSafeEqual(expected, given)
}
