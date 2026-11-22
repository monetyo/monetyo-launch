import type { Link } from "./email-layout.js"

import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { parse } from "yaml"

import { type Locale, localizeHref } from "./i18n.js"

/**
 * We decided emails read their copy from YAML at request time, rather than
 * importing it, because `api/` functions are compiled file by file and can't
 * import content; `vercel.json` ships the files alongside them.
 */

interface Options {
  /** How the error names the email, when it's clearer than its folder. */
  label?: string
}

/**
 * Reads the YAML file at a path under the project root.
 *
 * @param path - The file, from the project root.
 *
 * @returns Its contents, parsed.
 */
async function readYaml(path: string): Promise<unknown> {
  return parse(await readFile(join(process.cwd(), path), "utf8"))
}

/**
 * Reads an email's copy in a locale and checks every field is there.
 *
 * @param name - The email's folder under `src/content/emails/`.
 * @param locale - The recipient's language.
 * @param fields - The fields the email needs, each a string.
 * @param options - How to name the email in an error.
 *
 * @returns The copy.
 *
 * @throws When the file is missing, or a field in it is, naming the field and
 *   the file, because an email with a hole in it, or in another language,
 *   would go out to someone who trusted the site with their address.
 */
export async function readEmailCopy<Field extends string>(
  name: string,
  locale: Locale,
  fields: readonly Field[],
  options: Options = {}
): Promise<Record<Field, string>> {
  const path = `src/content/emails/${name}/${locale}.yaml`
  const copy = await readYaml(path)

  for (const field of fields) {
    if (typeof (copy as Record<string, unknown> | null)?.[field] !== "string") {
      throw new Error(
        `The ${options.label ?? name} email has no \`${field}\`. Add it to ${path}.`
      )
    }
  }

  return copy as Record<Field, string>
}

/**
 * Reads the link to the privacy policy every email's footer carries, worded
 * as the site's own footer words it, so it reads the same in every language
 * the site has.
 *
 * @param locale - The recipient's language.
 * @param origin - The site's origin, which makes the link absolute.
 *
 * @returns The link, in that language.
 *
 * @throws When the settings file is missing, or its footer has no link to
 *   `/privacy/`.
 */
export async function readPrivacyLink(
  locale: Locale,
  origin: string
): Promise<Link> {
  const path = `src/content/settings/${locale}.yaml`
  const settings = (await readYaml(path)) as {
    footer?: { links?: Partial<Link>[] }
  } | null
  const label = settings?.footer?.links?.find(
    (link) => link.href === "/privacy/"
  )?.label

  if (typeof label !== "string") {
    throw new Error(
      `No privacy policy link in ${path}. Add one to \`footer.links\` with \`href: /privacy/\`.`
    )
  }

  return { href: `${origin}${localizeHref("/privacy/", locale)}`, label }
}
