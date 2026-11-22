/**
 * The owner's details the law asks the site to show, which scrapers shouldn't
 * be able to lift as plain text. Email addresses are found on their own.
 */
const DETAILS = [
  "Luca Pipolo",
  "Y4675193C",
  "Carrer de Bailèn 41, 1º 2ªB, 08010 Barcelona",
]

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]*\w/

const MAILTO = new RegExp(`<a href="mailto:(${EMAIL.source})">\\1</a>`, "g")

const PROTECTED = new RegExp(
  [
    EMAIL.source,
    ...DETAILS.map((detail) => detail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  ].join("|"),
  "g"
)

/** Reverses a string by character, so accented letters stay whole. */
const reverse = (text: string) => [...text].reverse().join("")

/**
 * Hides email addresses and the owner's details from scrapers in a piece of
 * our own HTML, without hiding them from people.
 *
 * We decided to write them reversed, shown the right way round by CSS
 * (`.protected` in `_base.css`) and restored by `scripts/protected.ts`,
 * because it needs no third party and keeps the details readable without
 * JavaScript, as the legal notice must be. A mailto link loses its `href`
 * until the script puts it back, so a scraper finds no address in it.
 *
 * @param html - Trusted HTML from the site's own content.
 *
 * @returns The same HTML, with every protected value reversed and marked.
 */
export function protect(html: string): string {
  const linked = html.replace(
    MAILTO,
    (_, email: string) =>
      `<a class="protected" data-mailto="">${reverse(email)}</a>`
  )

  // Text between tags only, so attributes such as an href are left alone,
  // and never text a mailto link above has already reversed.
  return linked.replace(
    /(^|<[^>]*>)([^<]*)/g,
    (_, tag: string, text: string) =>
      tag.includes('class="protected"')
        ? `${tag}${text}`
        : `${tag}${text.replace(
            PROTECTED,
            (value) => `<span class="protected">${reverse(value)}</span>`
          )}`
  )
}

/**
 * Escapes plain text, then protects it like {@link protect}.
 *
 * @param text - Plain text, such as a line of copy from a YAML file.
 *
 * @returns HTML safe to render with `set:html`.
 */
export function protectText(text: string): string {
  return protect(
    text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
  )
}
