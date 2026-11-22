/**
 * We decided to keep the waitlist form's rules in one module that both the
 * browser and the `api/waitlist` function import, because two copies drift: an
 * address the page lets through and the server turns down reads as a bug to
 * whoever typed it.
 */

/**
 * Who a Visitor is budgeting for. Optional on the form, and the first thing
 * the launch questionnaires are segmented by.
 */
export const HOUSEHOLDS = [
  "solo",
  "couple",
  "family",
  "shared",
  "other",
] as const

export type Household = (typeof HOUSEHOLDS)[number]

/** The longest address a mail server is required to accept, in characters. */
export const LIMITS = { email: 254 } as const

/**
 * The quickest a person fills the form in, in ms. Shorter than a contact
 * form's, since a browser's autofill can put an address in at once, but still
 * slower than a script that never pauses to read.
 */
export const MIN_ELAPSED = 1500

/** What a failed check is called, matching the page's `errors` copy. */
export type WaitlistError = "email" | "household" | "required" | "tooLong"

/** A field that can carry an error, in the order the form shows them. */
export type WaitlistField = "email" | "household"

/**
 * What the form sends, before anything about it is trusted.
 *
 * There's no consent checkbox: the form does one thing, subscribing, so
 * sending it is the clear affirmative act GDPR asks for (Article 4(11),
 * Recital 32), made under the statement of what the Visitor will receive, and
 * the confirmation link proves it. A second purpose added to the form would
 * need its own, separate consent.
 */
export interface WaitlistInput {
  email: string
  household: string
}

// Deliberately loose: the only proof an address works is the confirmation
// email reaching it, so this just catches the typo that leaves nowhere to send.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Checks an email address.
 *
 * @param value - What was typed, untrimmed.
 *
 * @returns The first rule it breaks, or `undefined` when it passes.
 */
export function checkEmail(value: string): WaitlistError | undefined {
  const text = value.trim()

  if (!text) return "required"
  if (!EMAIL.test(text)) return "email"
  if (text.length > LIMITS.email) return "tooLong"

  return undefined
}

/**
 * Checks a whole signup.
 *
 * @param input - What the form sent.
 *
 * @returns Every field that fails, keyed by name; empty when all pass. The
 *   household may be left empty, but anything else must be one the form
 *   offers, since the server can't trust the page to send one.
 */
export function checkSignup(
  input: WaitlistInput
): Partial<Record<WaitlistField, WaitlistError>> {
  const errors: Partial<Record<WaitlistField, WaitlistError>> = {}
  const email = checkEmail(input.email)

  if (email) errors.email = email

  if (
    input.household !== "" &&
    !HOUSEHOLDS.includes(input.household as Household)
  ) {
    errors.household = "household"
  }

  return errors
}

/**
 * Puts an address in the one form it's stored and compared in.
 *
 * Mail servers treat the local part as case-sensitive in theory and never in
 * practice, so lowercasing it is what stops one person signing up twice.
 *
 * @param value - The address as typed.
 *
 * @returns It trimmed and lowercased.
 */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}
