import type { Locale } from "./i18n.js"

import { readEmailCopy } from "./email-copy.js"
import {
  type Link,
  paragraphs,
  type RenderedEmail,
  renderEmail,
} from "./email-layout.js"

const FIELDS = [
  "body",
  "heading",
  "preheader",
  "records",
  "rejoin",
  "subject",
] as const

/** The fixed copy of the email confirming an unsubscribe, one per locale. */
export type DeletionCopy = Record<(typeof FIELDS)[number], string>

/**
 * Reads the deletion email's copy in a locale.
 *
 * @param locale - The language the address signed up in.
 *
 * @returns The copy.
 *
 * @throws When a field is missing, naming it and the file.
 */
export async function readDeletion(locale: Locale): Promise<DeletionCopy> {
  return readEmailCopy("deletion", locale, FIELDS)
}

/**
 * Builds the email confirming an address was deleted from the waitlist. It
 * has no unsubscribe link: there is nothing left to unsubscribe from.
 *
 * @param locale - The recipient's language.
 * @param copy - The email's copy.
 * @param privacy - The footer's link to the privacy policy.
 *
 * @returns The subject, a plain-text version and an HTML version.
 */
export function buildDeletion(
  locale: Locale,
  copy: DeletionCopy,
  privacy: Link
): RenderedEmail {
  return renderEmail({
    body: paragraphs(copy.body),
    heading: copy.heading,
    locale,
    notes: [copy.records, copy.rejoin],
    preheader: copy.preheader,
    privacy,
    subject: copy.subject,
  })
}
