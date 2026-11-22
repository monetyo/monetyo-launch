import { json, readJson, text } from "../src/libs/http.js"
import { DEFAULT_LOCALE, isLocale } from "../src/libs/i18n.js"
import { recordProof } from "../src/libs/proofs.js"
import { confirmPending } from "../src/libs/storage.js"
import { hashToken } from "../src/libs/tokens.js"

/**
 * We decided the confirmation link opens a page with a button rather than
 * confirming on its own, because mail scanners open every link in an email to
 * check it, and a GET that confirmed would sign people up without them.
 */

export default {
  /**
   * Confirms the address a confirmation link was sent to.
   *
   * @param request - The confirmation page's POST, carrying the link's token.
   *
   * @returns `{ ok }`, `{ error: "expired" }` for a link that no longer
   *   works, or `{ error: "generic" }`.
   */
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response(null, { headers: { Allow: "POST" }, status: 405 })
    }

    const data = (await readJson(request)) ?? {}
    const token = text(data, "token")

    if (!token) return json({ error: "expired" }, 410)

    let signup: Awaited<ReturnType<typeof confirmPending>>

    try {
      signup = await confirmPending(hashToken(token))
    } catch (error) {
      console.error(error)

      return json({ error: "generic" }, 502)
    }

    if (!signup) return json({ error: "expired" }, 410)

    // The address is confirmed either way; a proof that fails to store is the
    // site's problem to notice, not the Visitor's to retry.
    try {
      await recordProof(request, {
        locale: isLocale(signup.locale) ? signup.locale : DEFAULT_LOCALE,
        page: text(data, "page"),
        purpose: "confirmation",
        signupId: signup.id,
      })
    } catch (error) {
      console.error(error)
    }

    return json({ ok: true })
  },
}
