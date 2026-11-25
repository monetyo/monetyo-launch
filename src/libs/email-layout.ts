import type { Locale } from "./i18n.js"

import tokens from "@monetyo/brand/tokens.json" with { type: "json" }

/**
 * We decided every email the site sends goes through this one layout, so the
 * brand, the footer the law asks for and the quirks of each mail client are
 * dealt with once. The HTML is nested tables with inline styles and no
 * `<style>` block, because that is the one subset Gmail, Apple Mail and
 * Outlook all render the same way. Every cell sets its own background and
 * text colour, so a client that recolours an email for dark mode never leaves
 * dark text on a dark background.
 */

/** A link, with the words it's shown as. */
export interface Link {
  href: string
  label: string
}

/** The one call to action an email can carry. */
export interface Button extends Link {
  /** Introduces the link written out in full, for a button that won't open. */
  fallback: string
}

/** Everything the layout puts around an email's own copy. */
export interface Layout {
  /** Paragraphs above the button. */
  body: string[]
  button?: Button
  heading: string
  locale: Locale
  /** Smaller paragraphs below the button, still inside the card. */
  notes?: string[]
  /** The line inbox lists show after the subject. */
  preheader: string
  privacy: Link
  /** Why the recipient is getting a message sent to the whole list. */
  reason?: string
  subject: string
  /** Only on emails to the list; an address that has left has nothing to leave. */
  unsubscribe?: Link
}

/** An email, ready for {@link sendEmail}. */
export interface RenderedEmail {
  html: string
  subject: string
  text: string
}

const { color } = tokens

const COLORS = {
  blue: color.blue["500"],
  body: color.sand["750"],
  border: color.sand["300"],
  coral: color.coral["500"],
  footer: color.sand["600"],
  ink: color.ink,
  sand: color.sand["100"],
  white: color.white,
} as const

const FONT = "Helvetica,Arial,sans-serif"

const ESCAPES: Record<string, string> = {
  '"': "&quot;",
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
}

/**
 * Escapes text for an HTML email.
 *
 * @param text - Plain text, copy or a link alike.
 *
 * @returns The text, safe between tags or inside a double-quoted attribute,
 *   the only kind this layout writes.
 */
export function escapeHtml(text: string): string {
  return text.replace(/["&<>]/g, (character) => ESCAPES[character])
}

/**
 * Splits copy into its paragraphs.
 *
 * @param text - Paragraphs separated by a blank line, as a YAML block writes
 *   them.
 *
 * @returns Each paragraph, its own line breaks folded into spaces, and none
 *   that are empty.
 */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean)
}

/**
 * Builds the brand mark, a coin over a house, from markup alone: images are
 * blocked by default in many inboxes, and Gmail drops SVG. Plain boxes can't
 * clip, so the house sits on the coin without the dark shared space.
 *
 * The coin's top padding sets the house down, because a margin would collapse
 * through the coin. Outlook on Windows gets the same shapes drawn in VML.
 *
 * @returns The mark, 24 by 24 pixels.
 */
function mark(): string {
  const box = "font-size:0;line-height:0;"
  const coin = `${box}width:18px;height:11px;padding-top:7px;border-radius:9px;background-color:${COLORS.blue};`
  const roof = `${box}width:0;height:0;margin-left:8px;border-right:8px solid transparent;border-bottom:7px solid ${COLORS.coral};border-left:8px solid transparent;`
  const walls = `${box}width:16px;height:10px;margin-left:8px;border-radius:0 0 2px 2px;background-color:${COLORS.coral};`

  return `<!--[if mso]><v:group xmlns:v="urn:schemas-microsoft-com:vml" style="width:24px;height:24px;" coordsize="24,24"><v:oval style="position:absolute;left:0;top:0;width:18;height:18;" fillcolor="${COLORS.blue}" stroked="f"/><v:shape style="position:absolute;left:0;top:0;width:24;height:24;" coordsize="24,24" path="m 8,24 l 8,14 16,7 24,14 24,24 x e" fillcolor="${COLORS.coral}" stroked="f"/></v:group><![endif]--><!--[if !mso]><!--><div style="${coin}"><div style="${roof}"></div><div style="${walls}"></div></div><!--<![endif]-->`
}

/**
 * Builds a paragraph.
 *
 * @param text - Plain text, escaped here.
 * @param style - The size, colour and spacing it's set in.
 *
 * @returns The `<p>`.
 */
function paragraph(text: string, style: string): string {
  return `<p style="margin:0;font-family:${FONT};${style}">${escapeHtml(text)}</p>`
}

/**
 * Builds a link set inline in a line of text.
 *
 * @param link - Where it goes and what it says.
 * @param extra - Any styles beyond the colour.
 *
 * @returns The `<a>`.
 */
function anchor(link: Link, extra = ""): string {
  return `<a href="${escapeHtml(link.href)}" style="color:${COLORS.blue};text-decoration:underline;${extra}">${escapeHtml(link.label)}</a>`
}

/**
 * Builds the pill button, with the link written out under it for a client
 * that won't open it. Outlook ignores padding on a link, so it reads the
 * padding from the cell instead (`mso-padding-alt`).
 *
 * @param button - Where it goes, what it says, and the line before the link.
 *
 * @returns The button's rows.
 */
function buttonRows(button: Button): string {
  const href = escapeHtml(button.href)

  return `<tr><td style="padding:12px 0 28px;background-color:${COLORS.white};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="center" bgcolor="${COLORS.blue}" style="background-color:${COLORS.blue};border-radius:999px;mso-padding-alt:15px 30px;">
<a href="${href}" style="display:inline-block;padding:15px 30px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:700;color:${COLORS.white};text-decoration:none;border-radius:999px;">${escapeHtml(button.label)}</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:0 0 4px;background-color:${COLORS.white};">${paragraph(button.fallback, `font-size:13px;line-height:20px;color:${COLORS.footer};`)}</td></tr>
<tr><td style="padding:0 0 8px;background-color:${COLORS.white};font-family:${FONT};font-size:13px;line-height:20px;word-break:break-all;">${anchor({ href: button.href, label: button.href })}</td></tr>`
}

/**
 * Builds the plain-text version, for clients that don't show HTML and for
 * spam filters, which trust an email with one more.
 *
 * @param layout - The email.
 *
 * @returns The text, every link written out in full.
 */
function plainText(layout: Layout): string {
  const footer = [
    layout.reason,
    `${layout.privacy.label}: ${layout.privacy.href}`,
    layout.unsubscribe &&
      `${layout.unsubscribe.label}: ${layout.unsubscribe.href}`,
  ].filter((line) => line !== undefined)

  return [
    layout.heading,
    ...layout.body,
    ...(layout.button ? [`${layout.button.label}: ${layout.button.href}`] : []),
    ...(layout.notes ?? []),
    ["--", ...footer].join("\n"),
  ].join("\n\n")
}

/**
 * Builds an email on the Monetyo layout.
 *
 * @param layout - The email's copy and links, all plain text: everything is
 *   escaped here, the links included, even though the site writes them all.
 *
 * @returns The subject, a plain-text version and an HTML version.
 */
export function renderEmail(layout: Layout): RenderedEmail {
  const cell = (padding: string) =>
    `padding:${padding};background-color:${COLORS.white};`

  const body = layout.body
    .map(
      (text) =>
        `<tr><td style="${cell("0 0 16px")}">${paragraph(text, `font-size:16px;line-height:26px;color:${COLORS.body};`)}</td></tr>`
    )
    .join("\n")

  const notes = (layout.notes ?? [])
    .map(
      (text, index) =>
        `<tr><td style="${cell(index === 0 ? "20px 0 0" : "12px 0 0")}${index === 0 ? `border-top:1px solid ${COLORS.border};` : ""}">${paragraph(text, `font-size:14px;line-height:22px;color:${COLORS.body};`)}</td></tr>`
    )
    .join("\n")

  const footerLine = (content: string, padding = "0 0 8px") =>
    `<tr><td align="center" style="padding:${padding};background-color:${COLORS.sand};font-family:${FONT};font-size:12px;line-height:19px;color:${COLORS.footer};text-align:center;">${content}</td></tr>`

  const links = [layout.privacy, layout.unsubscribe]
    .filter((link) => link !== undefined)
    .map((link) => anchor(link, "font-size:12px;"))
    .join(`&nbsp;&nbsp;&middot;&nbsp;&nbsp;`)

  // Filler after the preheader keeps inbox lists from showing the body's
  // first words after it.
  const filler = "&#847;&zwnj;&nbsp;".repeat(40)

  const html = `<!doctype html>
<html lang="${layout.locale}" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${escapeHtml(layout.subject)}</title>
</head>
<body style="margin:0;padding:0;width:100%;background-color:${COLORS.sand};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${COLORS.sand};">${escapeHtml(layout.preheader)}${filler}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.sand}" style="background-color:${COLORS.sand};">
<tr><td align="center" style="padding:32px 12px;background-color:${COLORS.sand};">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
<tr><td style="padding:0 12px 24px;background-color:${COLORS.sand};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="24" height="24" valign="middle" style="width:24px;height:24px;">${mark()}</td>
<td valign="middle" style="padding-left:10px;font-family:${FONT};font-size:24px;line-height:28px;font-weight:700;letter-spacing:-0.03em;color:${COLORS.ink};">monetyo</td>
</tr></table>
</td></tr>
<tr><td bgcolor="${COLORS.white}" style="padding:40px 32px 36px;background-color:${COLORS.white};border-radius:28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="${cell("0 0 16px")}"><h1 style="margin:0;font-family:${FONT};font-size:28px;line-height:34px;font-weight:700;letter-spacing:-0.02em;color:${COLORS.ink};">${escapeHtml(layout.heading)}</h1></td></tr>
${body}
${layout.button ? buttonRows(layout.button) : ""}
${notes}
</table>
</td></tr>
<tr><td style="padding:28px 24px 0;background-color:${COLORS.sand};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${layout.reason ? footerLine(escapeHtml(layout.reason)) : ""}
${footerLine(links, "4px 0 0")}
</table>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`

  return { html, subject: layout.subject, text: plainText(layout) }
}
