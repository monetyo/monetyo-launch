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
  "feedback",
  "heading",
  "preheader",
  "reason",
  "subject",
  "unsubscribe",
] as const

/** The fixed copy of the invitation to try the app, one file per locale. */
export type InviteCopy = Record<(typeof FIELDS)[number], string>

/** The links an invitation carries. */
export interface InviteLinks {
  /** Where to get the app, given at send time. */
  app: string
  privacy: Link
  unsubscribe: string
}

/**
 * Reads the invitation's copy in a locale.
 *
 * @param locale - The recipient's language.
 *
 * @returns The copy.
 *
 * @throws When a field is missing, naming it and the file.
 */
export async function readInvite(locale: Locale): Promise<InviteCopy> {
  return readEmailCopy("invite", locale, FIELDS)
}

/**
 * Builds the email inviting someone on the list to try the Monetyo app.
 *
 * @param locale - The recipient's language.
 * @param copy - The email's copy.
 * @param links - Where its links point.
 *
 * @returns The subject, a plain-text version and an HTML version.
 */
export function buildInvite(
  locale: Locale,
  copy: InviteCopy,
  links: InviteLinks
): RenderedEmail {
  return renderEmail({
    body: paragraphs(copy.body),
    button: { fallback: copy.fallback, href: links.app, label: copy.button },
    heading: copy.heading,
    locale,
    notes: [copy.feedback],
    preheader: copy.preheader,
    privacy: links.privacy,
    reason: copy.reason,
    subject: copy.subject,
    unsubscribe: { href: links.unsubscribe, label: copy.unsubscribe },
  })
}
