import type { RenderedEmail } from "../src/libs/email-layout.js"

import { randomUUID } from "node:crypto"

import { readNotice } from "../src/libs/consent.js"
import { readPrivacyLink } from "../src/libs/email-copy.js"
import { type Email, sendEmail } from "../src/libs/email.js"
import { hasBearer, json, readJson } from "../src/libs/http.js"
import {
  DEFAULT_LOCALE,
  isLocale,
  type Locale,
  LOCALES,
  localizeHref,
} from "../src/libs/i18n.js"
import { buildInvite, readInvite } from "../src/libs/invite.js"
import {
  buildPolicy,
  type PolicyNotice,
  readNoticeInput,
  readPolicy,
} from "../src/libs/policy.js"
import {
  listConfirmed,
  type Recipient,
  recordBroadcast,
} from "../src/libs/storage.js"
import { buildSurvey, readSurvey } from "../src/libs/survey.js"
import { buildUnsubscribe } from "../src/libs/unsubscribe.js"

/**
 * We decided to email the list by hand, one occasion at a time, from
 * `bun run notify`, rather than from a dashboard or a schedule, because each
 * send is rare and goes to everyone: a person deciding to press it is the
 * safeguard. Sending happens here, on Vercel, because the database and Brevo
 * keys are Sensitive variables Vercel never hands out.
 */

/** What a run does: count, send one copy per language to the team, or send. */
const MODES = ["dry-run", "test", "send"] as const

/** The emails that can go to the whole list. */
const TEMPLATES = ["invite", "policy", "survey"] as const

/** How many emails are in flight at once, well inside Brevo's rate limit. */
const BATCH_SIZE = 10

/** How long to wait before retrying an email Brevo didn't take, in ms. */
const RETRY_AFTER = 3000

/**
 * The id a test email's unsubscribe link carries: shaped like a real one and
 * signed, so the link can be tried, but no signup ever has it.
 */
const TEST_ID = "00000000-0000-0000-0000-000000000000"

/** Which email to send, with what it needs that isn't fixed copy. */
type Broadcast =
  | { notice: PolicyNotice; template: "policy" }
  | { template: "invite" | "survey"; url: string }

/** Builds one locale's email, given the recipient's unsubscribe link. */
type Render = (unsubscribe: string) => RenderedEmail

/**
 * Reads which email the trigger asked for.
 *
 * @param body - The parsed request body.
 *
 * @returns The broadcast, or `undefined` when the template is unknown, its
 *   URL isn't an `https:` one, or its notice is incomplete.
 */
function readBroadcast(body: Record<string, unknown>): Broadcast | undefined {
  const template = TEMPLATES.find((candidate) => candidate === body.template)

  if (template === "policy") {
    const notice = readNoticeInput(body.notice)

    return notice && { notice, template }
  }

  if (template === undefined || !URL.canParse(String(body.url))) {
    return undefined
  }

  const url = new URL(String(body.url))

  return url.protocol === "https:" ? { template, url: url.href } : undefined
}

/**
 * Reads one locale's copy and readies its email, so a missing field stops
 * the run before anything goes out rather than halfway through the list.
 *
 * @param broadcast - Which email.
 * @param locale - The language to ready it in.
 * @param origin - The site's origin, which every link starts with.
 *
 * @returns A function building that locale's email for one recipient.
 */
async function prepare(
  broadcast: Broadcast,
  locale: Locale,
  origin: string
): Promise<Render> {
  const privacy = await readPrivacyLink(locale, origin)

  if (broadcast.template === "policy") {
    const copy = await readPolicy(locale)
    const page = `${origin}${localizeHref(broadcast.notice.page, locale)}`

    return (unsubscribe) =>
      buildPolicy(locale, copy, broadcast.notice[locale], {
        page,
        privacy,
        unsubscribe,
      })
  }

  if (broadcast.template === "invite") {
    const copy = await readInvite(locale)

    return (unsubscribe) =>
      buildInvite(locale, copy, { app: broadcast.url, privacy, unsubscribe })
  }

  const copy = await readSurvey(locale)

  return (unsubscribe) =>
    buildSurvey(locale, copy, { privacy, survey: broadcast.url, unsubscribe })
}

/**
 * Readies the email in each language a run needs.
 *
 * @param broadcast - Which email.
 * @param locales - The languages to ready.
 * @param origin - The site's origin.
 *
 * @returns Each language's builder.
 */
async function prepareAll(
  broadcast: Broadcast,
  locales: readonly Locale[],
  origin: string
): Promise<Map<Locale, Render>> {
  const renders = await Promise.all(
    locales.map((locale) => prepare(broadcast, locale, origin))
  )

  return new Map(locales.map((locale, index) => [locale, renders[index]]))
}

/**
 * Picks the language someone gets the email in.
 *
 * @param recipient - Someone on the list.
 *
 * @returns The language they signed up in, or the default one for a value
 *   the site no longer has.
 */
function localeOf(recipient: Recipient): Locale {
  return isLocale(recipient.locale) ? recipient.locale : DEFAULT_LOCALE
}

/**
 * Lists the languages a set of recipients needs, in the site's order.
 *
 * @param recipients - Everyone the run is for.
 *
 * @returns Each language at least one of them reads.
 */
function localesOf(recipients: Recipient[]): Locale[] {
  const used = new Set(recipients.map(localeOf))

  return LOCALES.filter((locale) => used.has(locale))
}

/**
 * Sends one email, retrying once after a moment. Brevo now and then fails
 * briefly (a 5xx, a dropped connection), and the retry carries the same key,
 * so if the first attempt went through Brevo answers `duplicate_parameter`
 * instead of sending it twice.
 *
 * @param email - The email, with its idempotency key.
 *
 * @throws When the retry fails too.
 */
async function deliver(email: Email): Promise<void> {
  await sendEmail(email).catch(async () => {
    await new Promise((resolve) => setTimeout(resolve, RETRY_AFTER))
    await sendEmail(email).catch((error: unknown) => {
      if (!String(error).includes("duplicate_parameter")) throw error
    })
  })
}

/**
 * Counts who a send would reach, by language, after checking every language
 * they need has its copy.
 *
 * @param broadcast - Which email.
 * @param origin - The site's origin.
 *
 * @returns The counts.
 */
async function dryRun(broadcast: Broadcast, origin: string) {
  const recipients = await listConfirmed()

  await prepareAll(broadcast, localesOf(recipients), origin)

  const byLocale = Object.fromEntries(
    LOCALES.map((locale) => [
      locale,
      recipients.filter((recipient) => localeOf(recipient) === locale).length,
    ])
  )

  return {
    byLocale,
    mode: "dry-run",
    recipients: recipients.length,
    template: broadcast.template,
  }
}

/**
 * Sends one copy in every language to `NOTIFY_TEST_EMAIL`, to read them
 * before anyone on the list gets one.
 *
 * @param broadcast - Which email.
 * @param origin - The site's origin.
 *
 * @returns How many copies went out, and where.
 *
 * @throws When `NOTIFY_TEST_EMAIL` isn't set.
 */
async function test(broadcast: Broadcast, origin: string) {
  const to = process.env.NOTIFY_TEST_EMAIL

  if (!to) {
    throw new Error(
      "No inbox for test emails. Set `NOTIFY_TEST_EMAIL` in this Vercel environment."
    )
  }

  const renders = await prepareAll(broadcast, LOCALES, origin)

  for (const [locale, render] of renders) {
    const unsubscribe = buildUnsubscribe(origin, { id: TEST_ID, locale })
    const email = render(unsubscribe.href)

    await sendEmail({
      ...email,
      headers: unsubscribe.headers,
      subject: `[Test, ${locale}] ${email.subject}`,
      tags: [`broadcast-${broadcast.template}`, "test"],
      to: { email: to },
    })
  }

  return { mode: "test", sent: renders.size, to }
}

/**
 * Sends the email to everyone confirmed, each in their language with their
 * own unsubscribe link, and records that it went out.
 *
 * @param broadcast - Which email.
 * @param origin - The site's origin.
 *
 * @returns How many it reached and how many failed, and whether the run was
 *   recorded.
 */
async function send(broadcast: Broadcast, origin: string) {
  const recipients = await listConfirmed()
  const renders = await prepareAll(broadcast, localesOf(recipients), origin)
  const sentAt = new Date().toISOString()
  let delivered = 0
  let failed = 0

  // One email each, so nobody sees anyone else's address, a few at a time.
  for (let start = 0; start < recipients.length; start += BATCH_SIZE) {
    const batch = recipients.slice(start, start + BATCH_SIZE)
    const outcomes = await Promise.allSettled(
      batch.map((recipient) => {
        const locale = localeOf(recipient)
        const unsubscribe = buildUnsubscribe(origin, {
          id: recipient.id,
          locale,
        })

        return deliver({
          ...renders.get(locale)!(unsubscribe.href),
          headers: unsubscribe.headers,
          idempotencyKey: randomUUID(),
          tags: [`broadcast-${broadcast.template}`],
          to: { email: recipient.email },
        })
      })
    )

    for (const outcome of outcomes) {
      if (outcome.status === "fulfilled") {
        delivered += 1
      } else {
        console.error(outcome.reason)
        failed += 1
      }
    }
  }

  const result = {
    delivered,
    failed,
    mode: "send",
    recipients: recipients.length,
  }

  // Everything has gone out by now, so a failure to record it is reported
  // rather than thrown: an error here would invite a second, duplicate send.
  try {
    const subject = (await prepare(broadcast, DEFAULT_LOCALE, origin))(
      ""
    ).subject

    await recordBroadcast({
      delivered,
      failed,
      id: randomUUID(),
      policyVersion: (await readNotice(DEFAULT_LOCALE)).version,
      recipients: recipients.length,
      sentAt,
      subject,
      template: broadcast.template,
    })

    return { ...result, recorded: true }
  } catch (error) {
    console.error(error)

    return { ...result, recorded: false }
  }
}

export default {
  /**
   * Counts, tests or sends an email to everyone confirmed on the waitlist.
   *
   * @param request - A POST carrying `NOTIFY_SECRET` as a bearer token, and
   *   a JSON body naming the `mode`, the `template` and what it needs: a
   *   `url` for `survey` and `invite`, a `notice` for `policy`.
   *
   * @returns What was counted or sent, or the error, in full: only the team
   *   can call this, and the real message is more use to them.
   */
  async fetch(request: Request): Promise<Response> {
    // Without the secret set, anyone could email everyone, so `hasBearer`
    // refuses every request rather than running unguarded.
    if (!hasBearer(request, "NOTIFY_SECRET")) {
      return new Response(null, { status: 401 })
    }

    if (request.method !== "POST") {
      return new Response(null, { headers: { Allow: "POST" }, status: 405 })
    }

    const body = (await readJson(request)) ?? {}
    const mode = MODES.find((candidate) => candidate === body.mode)
    const broadcast = readBroadcast(body)

    if (!mode || !broadcast) {
      return json(
        {
          error: `Send a \`mode\` (${MODES.join(", ")}) and a \`template\` (${TEMPLATES.join(", ")}): \`survey\` and \`invite\` with an https \`url\`, \`policy\` with a \`notice\` holding a subject and a body for each of ${LOCALES.join(", ")}.`,
        },
        400
      )
    }

    const { origin } = new URL(request.url)

    try {
      if (mode === "test") return json(await test(broadcast, origin))
      if (mode === "send") return json(await send(broadcast, origin))

      return json(await dryRun(broadcast, origin))
    } catch (error) {
      console.error(error)

      return json({ error: String(error) }, 500)
    }
  },
}
