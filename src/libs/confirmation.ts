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
  "button",
  "fallback",
  "heading",
  "ignore",
  "preheader",
  "subject",
  "unsubscribe",
] as const

/** The fixed copy of the confirmation email, one YAML file per locale. */
export type ConfirmationCopy = Record<(typeof FIELDS)[number], string>

/** The links every confirmation email carries. */
export interface ConfirmationLinks {
  confirm: string
  privacy: Link
  unsubscribe: string
}

/**
 * Reads the confirmation email's copy in a locale.
 *
 * @param locale - The language the Visitor signed up in.
 *
 * @returns The copy.
 *
 * @throws When the file is missing, or a field in it is, because an email
 *   with a hole in it would go out to someone who just trusted the site.
 */
export async function readConfirmation(
  locale: Locale
): Promise<ConfirmationCopy> {
  return readEmailCopy("confirm", locale, FIELDS, { label: "confirmation" })
}

/**
 * Builds the confirmation email.
 *
 * @param locale - The Visitor's language.
 * @param copy - The email's copy in that language.
 * @param links - Where its links point.
 *
 * @returns The subject, a plain-text version and an HTML version.
 */
export function buildConfirmation(
  locale: Locale,
  copy: ConfirmationCopy,
  links: ConfirmationLinks
): RenderedEmail {
  return renderEmail({
    body: paragraphs(copy.body),
    button: {
      fallback: copy.fallback,
      href: links.confirm,
      label: copy.button,
    },
    heading: copy.heading,
    locale,
    notes: [copy.ignore],
    preheader: copy.preheader,
    privacy: links.privacy,
    subject: copy.subject,
    unsubscribe: { href: links.unsubscribe, label: copy.unsubscribe },
  })
}
