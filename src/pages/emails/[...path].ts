import type { RenderedEmail } from "@/libs/email-layout"
import type { APIContext } from "astro"

import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { parse } from "yaml"

import { buildConfirmation, readConfirmation } from "@/libs/confirmation"
import { buildDeletion, readDeletion } from "@/libs/deletion"
import { readPrivacyLink } from "@/libs/email-copy"
import { type Locale, LOCALES, localizeHref } from "@/libs/i18n"
import { buildInvite, readInvite } from "@/libs/invite"
import { buildPolicy, readPolicy } from "@/libs/policy"
import { SITE } from "@/libs/site"
import { buildSurvey, readSurvey } from "@/libs/survey"

/**
 * Previews every email in every language, in development only:
 * `/emails/all/` lists them all, `/emails/<name>/<locale>/` shows one as it would
 * be sent, and `/emails/<name>/<locale>/text/` its plain-text version,
 * built by the same code and copy, with sample links.
 *
 * We decided on a route that builds no pages outside development, rather than
 * a script writing files, so a change to a template or its copy shows on a
 * reload. Production gets no paths, so nothing here is ever deployed.
 */

const EMAILS = {
  confirm: "Confirm the signup",
  survey: "Survey invitation",
  policy: "Policy change",
  invite: "Invitation to the app",
  deletion: "Deletion confirmation",
} as const

type Name = keyof typeof EMAILS

const NAMES = Object.keys(EMAILS) as Name[]

const SAMPLE_UNSUBSCRIBE = (locale: Locale) =>
  `${SITE}${localizeHref("/unsubscribe/?id=sample&signature=sample", locale)}`

/**
 * Lists every preview, under the dev server only.
 */
export function getStaticPaths() {
  if (!import.meta.env.DEV_SERVER) return []

  return [
    { params: { path: "all" } },
    ...NAMES.flatMap((name) =>
      LOCALES.flatMap((locale) => [
        { params: { path: `${name}/${locale}` } },
        { params: { path: `${name}/${locale}/text` } },
      ])
    ),
  ]
}

/**
 * Builds one email in one language, as it would go out.
 *
 * @param name - The email.
 * @param locale - The recipient's language.
 *
 * @returns The rendered email.
 */
async function build(name: Name, locale: Locale): Promise<RenderedEmail> {
  const privacy = await readPrivacyLink(locale, SITE)
  const unsubscribe = SAMPLE_UNSUBSCRIBE(locale)

  switch (name) {
    case "confirm":
      return buildConfirmation(locale, await readConfirmation(locale), {
        confirm: `${SITE}${localizeHref("/confirm/?token=sample", locale)}`,
        privacy,
        unsubscribe,
      })
    case "deletion":
      return buildDeletion(locale, await readDeletion(locale), privacy)
    case "invite":
      return buildInvite(locale, await readInvite(locale), {
        app: "https://app.monetyo.com/",
        privacy,
        unsubscribe,
      })
    case "policy": {
      const example = parse(
        await readFile(join(process.cwd(), "notices/example.yaml"), "utf8")
      ) as Record<string, { body: string; subject: string }>
      return buildPolicy(locale, await readPolicy(locale), example[locale], {
        page: `${SITE}${localizeHref("/privacy/", locale)}`,
        privacy,
        unsubscribe,
      })
    }
    case "survey":
      return buildSurvey(locale, await readSurvey(locale), {
        privacy,
        survey: "https://tally.so/r/sample",
        unsubscribe,
      })
  }
}

/**
 * Lays every email out on one page, each language side by side.
 *
 * @returns The index page.
 */
async function index(): Promise<string> {
  const rows = await Promise.all(
    NAMES.map(async (name) => {
      const cells = await Promise.all(
        LOCALES.map(async (locale) => {
          const { subject } = await build(name, locale)
          const href = `/emails/${name}/${locale}/`
          return `<figure><figcaption><b>${locale.toUpperCase()}</b> ${subject} · <a href="${href}">open</a> · <a href="${href}text/">text</a></figcaption><iframe src="${href}" title="${EMAILS[name]}, ${locale}" loading="lazy"></iframe></figure>`
        })
      )
      return `<section><h2>${EMAILS[name]}</h2><div class="row">${cells.join("")}</div></section>`
    })
  )

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Email previews</title>
<style>
body{margin:0;padding:32px;background:#f4f2ee;font:15px/1.5 Helvetica,Arial,sans-serif;color:#1b1916}
h1{margin:0 0 4px;font-size:28px;letter-spacing:-.02em}p{margin:0 0 32px;color:#5f5a52}
h2{margin:40px 0 12px;font-size:20px}.row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
figure{margin:0;background:#fff;border:1px solid #e5e2db;border-radius:16px;overflow:hidden}
figcaption{padding:10px 14px;font-size:13px;color:#5f5a52;border-bottom:1px solid #e5e2db;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
figcaption b{color:#2341f5;margin-right:6px}a{color:#2341f5}iframe{display:block;width:100%;height:640px;border:0}
</style></head><body><h1>Email previews</h1><p>Every email in every language, built by the real templates and copy, with sample links. Development only.</p>${rows.join("")}</body></html>`
}

/**
 * Answers with the overview, one email, or its plain-text version.
 */
export async function GET({ params }: APIContext) {
  const html = (body: string, type = "text/html") =>
    new Response(body, {
      headers: { "Content-Type": `${type}; charset=utf-8` },
    })

  const path = params.path ?? "all"

  if (path === "all") return html(await index())

  const [name, locale, version] = path.split("/") as [Name, Locale, string?]
  const email = await build(name, locale)

  return version === "text"
    ? html(`Subject: ${email.subject}\n\n${email.text}`, "text/plain")
    : html(email.html)
}
