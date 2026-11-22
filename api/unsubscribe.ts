import { buildDeletion, readDeletion } from "../src/libs/deletion.js"
import { readPrivacyLink } from "../src/libs/email-copy.js"
import { sendEmail } from "../src/libs/email.js"
import { json, readJson, secret, text } from "../src/libs/http.js"
import { DEFAULT_LOCALE, isLocale, type Locale } from "../src/libs/i18n.js"
import { recordProof } from "../src/libs/proofs.js"
import { deleteSignup } from "../src/libs/storage.js"
import { verifyId } from "../src/libs/tokens.js"

/**
 * Reads which signup to remove: from the JSON the unsubscribe page sends, or
 * from the query string, where a mail client's one-click unsubscribe puts it
 * (RFC 8058) alongside a form-encoded body of its own.
 *
 * @param request - The incoming POST.
 *
 * @returns The id, the signature and the page it came from.
 */
async function read(request: Request) {
  const query = new URL(request.url).searchParams
  const isJson = request.headers
    .get("content-type")
    ?.startsWith("application/json")
  const data = (isJson && (await readJson(request))) || {}

  return {
    id: text(data, "id") || (query.get("id") ?? ""),
    page: text(data, "page") || "one-click",
    signature: text(data, "signature") || (query.get("signature") ?? ""),
  }
}

/**
 * Emails someone who just left, confirming their address is gone.
 *
 * @param request - The unsubscribe request, whose origin the footer's link
 *   points at.
 * @param email - The address that was deleted.
 * @param locale - The language it signed up in.
 */
async function sendDeletion(
  request: Request,
  email: string,
  locale: Locale
): Promise<void> {
  const { origin } = new URL(request.url)
  const [copy, privacy] = await Promise.all([
    readDeletion(locale),
    readPrivacyLink(locale, origin),
  ])

  await sendEmail({
    ...buildDeletion(locale, copy, privacy),
    tags: ["waitlist-deletion"],
    to: { email },
  })
}

export default {
  /**
   * Takes an address off the waitlist for good.
   *
   * @param request - The unsubscribe page's POST, or a mail client's
   *   one-click one.
   *
   * @returns `{ ok }`, also when the address was already gone, so a second
   *   click reads as the success it is; `{ error: "invalid" }` for a link that
   *   was tampered with; or `{ error: "generic" }`.
   */
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response(null, { headers: { Allow: "POST" }, status: 405 })
    }

    const { id, page, signature } = await read(request)

    try {
      if (!id || !verifyId(id, signature, secret("UNSUBSCRIBE_SECRET"))) {
        return json({ error: "invalid" }, 400)
      }

      const signup = await deleteSignup(id)

      if (signup !== undefined) {
        const locale = isLocale(signup.locale) ? signup.locale : DEFAULT_LOCALE

        // The address is already gone, so neither of these failing may turn
        // the answer into an error the Visitor would retry.
        const outcomes = await Promise.allSettled([
          recordProof(request, {
            locale,
            page,
            purpose: "withdrawal",
            signupId: id,
          }),
          sendDeletion(request, signup.email, locale),
        ])

        for (const outcome of outcomes) {
          if (outcome.status === "rejected") console.error(outcome.reason)
        }
      }
    } catch (error) {
      console.error(error)

      return json({ error: "generic" }, 502)
    }

    return json({ ok: true })
  },
}
