import { secret } from "./http.js"
import { type Locale, localizeHref } from "./i18n.js"
import { signId } from "./tokens.js"

/** How one email to the list lets its recipient leave it. */
export interface UnsubscribeLinks {
  /**
   * `List-Unsubscribe` and `List-Unsubscribe-Post`, for the button a mail
   * client shows beside the sender (RFC 8058).
   */
  headers: Record<string, string>
  /** The unsubscribe page, in the recipient's language. */
  href: string
}

/**
 * Builds the links that take a signup off the list, signed with
 * `UNSUBSCRIBE_SECRET` so nobody can remove anyone else.
 *
 * @param origin - The site's origin, so a preview's email leads back to that
 *   preview.
 * @param signup - The signup's id, and the language its page is shown in.
 *
 * @returns The page link and the one-click headers.
 *
 * @throws When `UNSUBSCRIBE_SECRET` isn't set.
 */
export function buildUnsubscribe(
  origin: string,
  signup: { id: string; locale: Locale }
): UnsubscribeLinks {
  const query = `?id=${signup.id}&signature=${signId(signup.id, secret("UNSUBSCRIBE_SECRET"))}`

  return {
    headers: {
      "List-Unsubscribe": `<${origin}/api/unsubscribe/${query}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    href: `${origin}${localizeHref(`/unsubscribe/${query}`, signup.locale)}`,
  }
}
