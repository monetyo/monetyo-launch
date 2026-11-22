import { readEmailCopy } from "./email-copy.js"
import {
  type Link,
  paragraphs,
  type RenderedEmail,
  renderEmail,
} from "./email-layout.js"
import { type Locale, LOCALES } from "./i18n.js"

/**
 * We decided the parts of a policy notice that never change (why someone is
 * getting it, where to read the page, how to object) live in content the
 * server reads, rather than in each notice, so a notice can't go out without
 * them. Only the subject and the body are written for each occasion, in a
 * `notices/` file the repository keeps as a record of what was sent.
 */

const FIELDS = [
  "button",
  "fallback",
  "preheader",
  "reason",
  "rights",
  "unsubscribe",
] as const

/** The legal pages a notice can be about, by their English path. */
export const LEGAL_PAGES = [
  "/privacy/",
  "/cookies/",
  "/legal-notice/",
  "/security/",
  "/ai-content/",
] as const

/** The fixed copy around every policy notice, one YAML file per locale. */
export type PolicyCopy = Record<(typeof FIELDS)[number], string>

/** What's written for one notice, in one language. */
export interface NoticeCopy {
  /** Paragraphs separated by a blank line. Plain text: no markup. */
  body: string
  subject: string
}

/** One notice, in every language the site has, and the page it's about. */
export type PolicyNotice = Record<Locale, NoticeCopy> & {
  page: (typeof LEGAL_PAGES)[number]
}

/** The links a policy notice carries. */
export interface PolicyLinks {
  /** The changed page, in the recipient's language. */
  page: string
  privacy: Link
  unsubscribe: string
}

/**
 * Checks that what the trigger sent is a complete notice.
 *
 * @param value - The parsed request body's `notice`.
 *
 * @returns The notice, its `page` defaulting to the privacy policy, or
 *   `undefined` when a language, a field or the page isn't right.
 */
export function readNoticeInput(value: unknown): PolicyNotice | undefined {
  if (typeof value !== "object" || value === null) return undefined

  const notice = value as Record<string, unknown>
  const page = notice.page ?? "/privacy/"

  if (!LEGAL_PAGES.some((candidate) => candidate === page)) return undefined

  for (const locale of LOCALES) {
    const copy = notice[locale] as Partial<NoticeCopy> | undefined

    if (
      typeof copy?.subject !== "string" ||
      typeof copy.body !== "string" ||
      !copy.subject.trim() ||
      !copy.body.trim()
    ) {
      return undefined
    }
  }

  return { ...notice, page } as PolicyNotice
}

/**
 * Reads the fixed copy around a policy notice in a locale.
 *
 * @param locale - The recipient's language.
 *
 * @returns The copy.
 *
 * @throws When a field is missing, naming it and the file.
 */
export async function readPolicy(locale: Locale): Promise<PolicyCopy> {
  return readEmailCopy("policy", locale, FIELDS)
}

/**
 * Builds the email telling someone on the list that a legal page changed.
 *
 * @param locale - The recipient's language.
 * @param copy - The fixed copy around the notice.
 * @param notice - The notice in that language.
 * @param links - Where its links point.
 *
 * @returns The subject, a plain-text version and an HTML version.
 */
export function buildPolicy(
  locale: Locale,
  copy: PolicyCopy,
  notice: NoticeCopy,
  links: PolicyLinks
): RenderedEmail {
  const subject = notice.subject.trim()

  return renderEmail({
    body: paragraphs(notice.body),
    button: { fallback: copy.fallback, href: links.page, label: copy.button },
    heading: subject,
    locale,
    notes: [copy.rights],
    preheader: copy.preheader,
    privacy: links.privacy,
    reason: copy.reason,
    subject,
    unsubscribe: { href: links.unsubscribe, label: copy.unsubscribe },
  })
}
