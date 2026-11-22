import type { Locale } from "./i18n.js"

import { readEmailCopy } from "./email-copy.js"
import {
  type Link,
  paragraphs,
  type RenderedEmail,
  renderEmail,
} from "./email-layout.js"

const FIELDS = [
  "anonymity",
  "body",
  "button",
  "fallback",
  "heading",
  "preheader",
  "reason",
  "subject",
  "unsubscribe",
] as const

/** The fixed copy of the survey invitation, one YAML file per locale. */
export type SurveyCopy = Record<(typeof FIELDS)[number], string>

/** The links a survey invitation carries. */
export interface SurveyLinks {
  privacy: Link
  /**
   * The survey on Tally, the same for everyone, because the privacy policy
   * promises the link doesn't identify who opens it.
   */
  survey: string
  unsubscribe: string
}

/**
 * Reads the survey invitation's copy in a locale.
 *
 * @param locale - The recipient's language.
 *
 * @returns The copy.
 *
 * @throws When a field is missing, naming it and the file.
 */
export async function readSurvey(locale: Locale): Promise<SurveyCopy> {
  return readEmailCopy("survey", locale, FIELDS)
}

/**
 * Builds the email inviting someone on the list to a short survey.
 *
 * @param locale - The recipient's language.
 * @param copy - The email's copy.
 * @param links - Where its links point.
 *
 * @returns The subject, a plain-text version and an HTML version.
 */
export function buildSurvey(
  locale: Locale,
  copy: SurveyCopy,
  links: SurveyLinks
): RenderedEmail {
  return renderEmail({
    body: paragraphs(copy.body),
    button: { fallback: copy.fallback, href: links.survey, label: copy.button },
    heading: copy.heading,
    locale,
    notes: [copy.anonymity],
    preheader: copy.preheader,
    privacy: links.privacy,
    reason: copy.reason,
    subject: copy.subject,
    unsubscribe: { href: links.unsubscribe, label: copy.unsubscribe },
  })
}
