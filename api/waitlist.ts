import { ipAddress } from "@vercel/functions"
import { randomUUID } from "node:crypto"

import {
  buildConfirmation,
  readConfirmation,
} from "../src/libs/confirmation.js"
import { readPrivacyLink } from "../src/libs/email-copy.js"
import { sendEmail } from "../src/libs/email.js"
import { json, readJson, text } from "../src/libs/http.js"
import { isLocale, type Locale, localizeHref } from "../src/libs/i18n.js"
import { recordProof } from "../src/libs/proofs.js"
import { storePending } from "../src/libs/storage.js"
import { createToken, hashToken } from "../src/libs/tokens.js"
import { verifyTurnstile } from "../src/libs/turnstile.js"
import { buildUnsubscribe } from "../src/libs/unsubscribe.js"
import {
  checkSignup,
  MIN_ELAPSED,
  normalizeEmail,
  type WaitlistInput,
} from "../src/libs/waitlist.js"

/**
 * We decided to check every signup here, in this order, from the cheapest
 * check to the one that calls Cloudflare, because each one that fails saves
 * the next: a bot caught by the hidden field never costs a Turnstile lookup.
 *
 * Nothing about the answer says whether an address was already on the list,
 * so the form can't be used to find out who signed up.
 */

/** What the form sends, as far as anything about it is trusted. */
interface Submission extends WaitlistInput {
  elapsed: number
  locale: string
  page: string
  token: string
  website: string
}

/**
 * Reads the request body into a submission.
 *
 * @param data - The parsed JSON.
 *
 * @returns The submission.
 */
function read(data: Record<string, unknown>): Submission {
  return {
    elapsed: typeof data.elapsed === "number" ? data.elapsed : 0,
    email: text(data, "email"),
    household: text(data, "household"),
    locale: text(data, "locale"),
    page: text(data, "page"),
    token: text(data, "token"),
    website: text(data, "website"),
  }
}

/**
 * Emails the link that confirms the address belongs to whoever typed it.
 *
 * @param request - The signup's request, whose origin the links point at, so
 *   a preview deployment's email leads back to that preview.
 * @param signup - Who to send it to, and in which language.
 * @param token - The token the confirmation link carries.
 */
async function sendConfirmation(
  request: Request,
  signup: { email: string; id: string; locale: Locale },
  token: string
): Promise<void> {
  const { origin } = new URL(request.url)
  const unsubscribe = buildUnsubscribe(origin, signup)
  const [copy, privacy] = await Promise.all([
    readConfirmation(signup.locale),
    readPrivacyLink(signup.locale, origin),
  ])
  const email = buildConfirmation(signup.locale, copy, {
    confirm: `${origin}${localizeHref(`/confirm/?token=${token}`, signup.locale)}`,
    privacy,
    unsubscribe: unsubscribe.href,
  })

  await sendEmail({
    ...email,
    headers: unsubscribe.headers,
    tags: ["waitlist-confirmation"],
    to: { email: signup.email },
  })
}

export default {
  /**
   * Checks a waitlist signup, keeps it pending and sends its confirmation.
   *
   * @param request - The form's POST.
   *
   * @returns `{ ok }`, or what went wrong in the shape the form reads.
   */
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response(null, { headers: { Allow: "POST" }, status: 405 })
    }

    const data = await readJson(request)

    if (!data) return json({ error: "generic" }, 400)

    const submission = read(data)

    // Bots are told it worked, so they have no reason to try again any
    // differently.
    if (submission.website || submission.elapsed < MIN_ELAPSED) {
      return json({ ok: true })
    }

    const fields = checkSignup(submission)

    if (Object.keys(fields).length > 0) return json({ fields }, 422)

    // The locale picks which files are read from disk, so nothing else may
    // get that far.
    const { locale } = submission

    if (!isLocale(locale)) return json({ error: "generic" }, 400)

    try {
      if (!(await verifyTurnstile(submission.token, ipAddress(request)))) {
        return json({ error: "verification" }, 403)
      }
    } catch (error) {
      console.error(error)

      return json({ error: "generic" }, 502)
    }

    const token = createToken()
    const email = normalizeEmail(submission.email)
    let id: string | undefined

    try {
      id = await storePending({
        createdAt: new Date().toISOString(),
        email,
        household: submission.household || null,
        id: randomUUID(),
        locale,
        page: submission.page,
        tokenHash: hashToken(token),
      })
    } catch (error) {
      console.error(error)

      return json({ error: "generic" }, 502)
    }

    // Already confirmed: there is nothing to send, and saying so would tell
    // anyone who types an address that it's on the list.
    if (!id) return json({ ok: true })

    const [proved, sent] = await Promise.allSettled([
      recordProof(request, {
        locale,
        page: submission.page,
        purpose: "signup",
        signupId: id,
      }),
      sendConfirmation(request, { email, id, locale }, token),
    ])

    for (const outcome of [proved, sent]) {
      if (outcome.status === "rejected") console.error(outcome.reason)
    }

    // Without the email the signup can never be confirmed, so the Visitor is
    // asked to try again; the confirmation records its own proof either way.
    if (sent.status === "rejected") return json({ error: "generic" }, 502)

    return json({ ok: true })
  },
}
