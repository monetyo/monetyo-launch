---
paths:
  - "src/content/**/*.yaml"
---

# Content

## Placeholders

A string can carry `{name}` tokens, filled at render time rather than assembled from parts, so a translator keeps
the whole sentence and decides where the value sits in it. A placeholder with no matching value is left as-is
rather than blanked, so a mistyped name shows up in the page instead of quietly leaving a hole.

- `fillPlaceholders(text, values)` (`@/libs/template`) substitutes plain text:
  `copyright: © {year} Monetyo. The smart way to manage family money.` (see `SiteFooter.astro`), or
  `updatedLabel: Last updated {date}` on the legal pages, which the schema requires to contain `{date}`.
- `splitPlaceholders(text)` is for a placeholder that stands for markup a string can't hold. It splits the string
  into parts, and the caller renders each `{name}` it recognises: a `privacy` or `faq` item names a standard as
  `{id}` and lists it under `terms`, and `TextWithTerms.astro` renders it with its tooltip.

## Per-locale pages

A page under `src/content/pages/<name>/`, and `src/content/settings/`, need one file per locale in `LOCALES`
(`en`, `es`, `ca`, `it`), or the build throws. There is no fallback between languages: add the file for every locale
when adding the page. `not-found` included: every locale's file builds its 404 page (see the 404 in
`.claude/guidelines/architecture.md`).

## Links

Links in copy are written in English and without a locale prefix: `/privacy/`, `/#roadmap`. Never write
`/es/privacidad/` by hand. A `href` field (header, footer) is translated per locale by the component that renders
it, through `localizeHref()`. Links inside HTML copy are only translated on the legal pages, by `LegalPage.astro`;
anywhere else, such as a home page `faq` answer, an HTML link is rendered as written. A new page or home page
anchor needs its slugs in `PAGE_SLUGS` or `ANCHORS` (`src/libs/i18n.ts`) first.

## Legal pages

`privacy`, `cookies`, `legal-notice`, `security`, and `ai-content` share one schema, `legal` in
`content.config.ts`: `title`, `description`, `updated` (a date), `updatedLabel`, `intro`, and `sections[]`, each a
`heading` with an optional `body` (a string or a list of paragraphs) and/or an optional `items[]` of
`{ term, description }` pairs rendered as a definition list.

## Contact details

Write email addresses as plain text or a plain `<a href="mailto:x">x</a>` link. `LegalPage.astro`, the waitlist
form and the confirm and unsubscribe pages pass copy through `protect()`/`protectText()` (`@/libs/obfuscate`), which
hides addresses and the owner's details listed in `DETAILS` from scrapers; a mailto link with any other attribute or
text is not recognised as one.

## Copy that is evidence

Every consent record stores the waitlist's `consent`, `privacyLink` and `notice` (in `settings/<locale>.yaml`)
exactly as worded, versioned by the privacy policy's `updated` date. Bump that date whenever a privacy change affects
what people agree to. The retention periods the privacy policy states must match `RETENTION` in
`src/libs/storage.ts`, in every language.

## Emails

`src/content/emails/<name>/<locale>.yaml` is read at request time by `api/`, not by any page; each folder is a
collection only so a missing field fails the build. Which function reads which: `confirm` by `api/waitlist.ts`,
`deletion` by `api/unsubscribe.ts`, `survey`, `invite` and `policy` by `api/notify.ts`. A new email folder also
needs adding to its function's `includeFiles` in `vercel.json`, or it fails only once deployed.

Every email needs a file per locale, with no fallback between languages, but nothing at build time checks it: a
missing file only fails when that email is sent (at signup for `confirm`, after unsubscribing for `deletion`, and in
`bun run notify`'s dry run for the list emails). Add the file for every locale when adding an email. `policy` is only the frame around a notice: each notice's subject and body are written for
every locale in its own `notices/<date>-<change>.yaml` (copy `notices/example.yaml`), as plain text with paragraphs
separated by a blank line and no markup.

## Limits

`title` is capped at 60 characters and `description` at 160, what search results show; the build fails over a
longer one.
