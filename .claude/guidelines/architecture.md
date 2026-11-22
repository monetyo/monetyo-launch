# Architecture

## Astro

`content.config.ts` defines every collection with a Zod schema, the single place to add a field. A page under
`src/content/pages/<name>/` and `src/content/settings/` need a file for every locale (`en`, `es`, `ca`, `it`) or the
build throws. An email collection is schema-checked too, but the build doesn't require a file per locale there,
though every email needs one (see Emails).

`src/pages/404.astro` builds `404.html` in the default locale, because Vercel serves that one file for every
missing path. A missing path under another locale's prefix is sent instead, by the `rewrites` in `vercel.json` (which
apply only when no file matches), to `api/not-found.ts`, which answers with that locale's page from
`[...locale]/not-found.astro` (`/es/not-found/`, noindex) and a 404 status. The dev server renders `404.astro` for
the missing path itself, so there it follows the path's locale directly. Vercel redirects every path to its trailing-slash form
(`trailingSlash: true` in `vercel.json`); in development the `monetyo:trailing-slash` Vite plugin in
`astro.config.mjs` mirrors that with a 308, rather than relaxing Astro's `trailingSlash: "always"`, so the dev server
shows the site's 404 instead of Astro's and a link Vercel would redirect still shows up.

## Alpine

The site aims for a maximum-grade Content-Security-Policy (see Vercel): no `unsafe-inline`, no `eval`, no
`unsafe-eval`. Alpine's default build compiles its directives through `eval`, which that policy blocks, so the
site uses Alpine's dedicated CSP build (`@alpinejs/csp`) instead, wired in `src/scripts/alpine.ts`. The package is
patched (`patches/`, listed under `patchedDependencies` in `package.json`), so the patch has to be redone whenever
its version changes.

Section scripts are per-component: for example, `Roadmap.astro` imports `@/scripts/idea-board` and
`WaitlistForm.astro` imports `@/scripts/waitlist`, each in its own `<script>` tag, so Astro only bundles a
section's script onto a page that actually renders that section. Because each is its own module with no fixed load
order, `register()` (`src/scripts/alpine.ts`) tracks which `x-data` names the rendered markup still needs and only
starts Alpine once every one of them has registered. A name still missing at `load` means its script 404'd, which
happens for a few seconds while a Vercel deploy goes live and the page and its scripts come from different
deployments: the page reloads once, and if the name is still missing, Alpine starts without it (`x-ignore`) and
logs one `console.error` naming it. The decision itself lives in `src/libs/components.ts`, where it is tested.

## Languages

Locale is a route param, not a subtree: `src/libs/i18n.ts` defines `LOCALES` (`en` default, `es`, `ca`, `it`), and every
route lives under `src/pages/[...locale]/`. `getLocalizedStaticPaths()` (`src/libs/content.ts`) builds one route
per locale from a collection; the default locale's route gets no prefix. Paths are translated too (`/privacy/`,
`/es/privacidad/`): `i18n.ts` maps each page (`PAGE_SLUGS`) and home page section anchor (`ANCHORS`) to its slug
per locale, a page's route file is named after it (`[privacy].astro`, `[legal_notice].astro`) and takes that slug as
its param. Links are written locale-less and in English (`/privacy/`, `/#roadmap`) and passed through
`localizeHref(href, locale)` at render time, which prefixes and translates them; `LegalPage.astro` does the same for
the links inside a legal page's HTML copy. Every page hands the layout its `alternates`, its own path in each
locale, from which the canonical, the `hreflang` links and the language switcher are all built. The switcher
(`SiteHeader/LanguageSwitch.astro`) is a dropdown in the header (`menu`, driven by `src/scripts/language-menu.ts`)
and a plain list in the narrow-screen menu (`list`); a locale missing from `alternates` links to its home page.
Picking a language writes the `locale` cookie (`src/scripts/locale.ts`). Request-time language negotiation happens
in Vercel's Routing Middleware, ahead of the cache (see Vercel).

## Discovery

`sitemap.xml` (`src/pages/sitemap.xml.ts`) is built by `buildSitemap()` (`src/libs/sitemap.ts`) from `INDEXED`, the
list of pages search engines should know about, each listed in every locale with its `hreflang` alternates. A new
indexable page needs its entry in `INDEXED`, besides the one in `PAGE_SLUGS` its routing requires. `robots.txt`
lets every crawler in and points at the sitemap. `sitemap.xml` links `public/sitemap.css`, a CSS stylesheet rather
than XSL (browsers are dropping XSLT), so a person can read it too. `public/.well-known/security.txt` points at
`privacy@monetyo.com` and the `/security/` page, and carries an `Expires` date that has to be renewed. The canonical,
`hreflang` and Open Graph tags each page carries come from the layout, as does `noindex` on the confirm,
unsubscribe and 404 pages.

## Obfuscation

Email addresses and the owner's legal details (name, NIF, address, listed in `DETAILS` in `src/libs/obfuscate.ts`)
are written reversed in the HTML so scrapers can't lift them, shown the right way round by `.protected`
(`unicode-bidi: bidi-override; direction: rtl` in `src/styles/_base.css`), and restored to plain text by
`src/scripts/protected.ts`, which also puts back the `href` a `mailto:` link loses. It needs no JavaScript to stay
readable, as the legal notice must. `protect(html)` takes trusted HTML and `protectText(text)` escapes plain text
first; `LegalPage.astro`, `WaitlistForm.astro` and `EmailAction.astro` use them, so copy writes addresses plainly.

## Favicon

`public/favicon.svg` is the static icon; `src/scripts/favicon.ts`, loaded by the layout, draws the mark's two coins
drifting apart and back on a canvas and swaps the icon's `href` frame by frame, because browsers don't run
animations inside a favicon SVG. It pauses while the tab is hidden and never starts (or stops and restores the SVG)
under `prefers-reduced-motion`. In the SVGs (`favicon.svg`, `src/icons/mark.svg`) and the canvas, the lens where the
coins overlap is stroked in its own colour so its shared edges leave no antialiasing fringe.

## Waitlist

`api/waitlist.ts` runs its checks cheapest first: the honeypot field and the minimum fill time (bots are told it
worked), the shared form rules in `src/libs/waitlist.ts` (imported by the browser script too, so the two can't
drift), the locale, then Cloudflare Turnstile. A passing signup is stored as pending with only the hash of its
confirmation token (`src/libs/tokens.ts`), and a confirmation email goes out through Brevo (`src/libs/email.ts`,
copy from `src/content/emails/confirm/`). No answer ever reveals whether an address was already on the list.

The email links to the localized `/confirm/?token=…` page. It and the `/unsubscribe/?id=…&signature=…` page
(`[confirm].astro`, `[unsubscribe].astro`) share `EmailAction.astro` and `src/scripts/email-action.ts`: the link's
query parameters are POSTed to `api/confirm.ts` or `api/unsubscribe.ts` only when the Visitor presses the button,
never on load, because mail scanners open links and a GET that acted would confirm or delete addresses. Unsubscribe
links are HMAC-signed rather than tokenised (`src/libs/unsubscribe.ts` builds them and the `List-Unsubscribe`
headers), because they must keep working for as long as the address stays on the list; `api/unsubscribe.ts` also
accepts a mail client's one-click POST (RFC 8058). Once it deletes a signup it sends the deletion email; a failure
there, or in storing the withdrawal proof, is logged and never turns the answer into an error.

Signups and consent records live in two separate Neon databases (`src/libs/storage.ts`), each creating its table on
first use. Signing up, confirming and unsubscribing each store a proof (`src/libs/proofs.ts`): the notice text read
from the same YAML the page was built from (`src/libs/consent.ts`), never from the browser, versioned by the privacy
policy's `updated` date, with a keyed hash of the IP instead of the IP itself. `api/cleanup.ts`, a daily Vercel Cron
Job, deletes everything past `RETENTION` in `storage.ts`, the periods the privacy policy promises.

## Emails

Every email goes through `renderEmail()` (`src/libs/email-layout.ts`): nested tables with inline styles, a
plain-text version, and the footer the law asks for. One module per email reads its copy and builds it
(`confirmation.ts`, `deletion.ts`, `survey.ts`, `invite.ts`, `policy.ts`), and `src/libs/email.ts` sends it through
Brevo from `SENDER`. Copy is read from `src/content/emails/<name>/<locale>.yaml` at request time by
`readEmailCopy()` (`src/libs/email-copy.ts`), which throws on a missing file or field: there is no fallback to
another locale, because an email in the wrong language is as bad as one with a hole in it. Nothing checks a file
per locale at build time, so a missing one only fails when that email is sent (a `dry-run` of `notify` catches it
for the list emails). In development, `src/pages/emails/[...path].ts` previews every email in every locale at
`/emails/all/`, built by the same code with sample links; it builds no pages outside `astro dev` (the
`import.meta.env.DEV_SERVER` flag `astro.config.mjs` defines), so it never ships. `readPrivacyLink()` takes the footer's privacy link from `settings/<locale>.yaml`.

`api/notify.ts` emails everyone confirmed (`listConfirmed()`), triggered by `bun run notify` (`scripts/notify.ts`)
with `NOTIFY_SECRET` as a bearer token; without the secret set it refuses every request. We send from Vercel
because the database and Brevo keys are Sensitive variables it never hands out. A run is a `dry-run` (readies every
needed locale's copy and counts recipients by locale), a `test` (one copy per locale to `NOTIFY_TEST_EMAIL`, with
a signed unsubscribe link for an id no signup has) or a `send` (batches of 10, one retry per email with the same
Brevo idempotency key). Templates are `survey` and `invite`, which take an `https:` URL, and `policy`, which takes a
notice from `notices/` (see `notices/example.yaml`) with a subject and body for every locale in `LOCALES` and the
legal page it is about (`LEGAL_PAGES` in `policy.ts`). A send is recorded in the `broadcasts` table of the consent
database (`recordBroadcast()`), counts only, with no addresses; a failure to record it is reported, not thrown, so
nobody re-sends.

## Vercel

`middleware.ts`, at the project root because it follows Vercel's own Routing Middleware convention rather than
Astro's `src/middleware.ts`, runs on the Node.js runtime and negotiates `Accept-Language`/a `locale` cookie at the
root ahead of the cache, and folds `/en/…` onto `/…`. `vercel.json` declares the Content-Security-Policy (which
allows `challenges.cloudflare.com` for Turnstile) and the rest of the security headers, the `fra1` region, the
cleanup cron, `trailingSlash: true`, and the `includeFiles` each function needs: the content YAML it reads at
request time (`settings` and `pages/privacy` for all four, plus `emails/confirm` for `waitlist`, `emails/deletion`
for `unsubscribe`, and `emails/{survey,policy,invite}` for `notify`). A function
that starts reading another content file needs that file added there, or it fails only once deployed.
`bun run check:csp` (`check-csp.mjs`) walks the built `dist/` HTML and fails the build over any inline `style`
attribute or an inline `<script>`/`<style>` whose hash isn't allowlisted in that policy.

`api/` holds Vercel Functions, compiled file by file and run as ES modules on Node rather than bundled, so a
relative import there needs its `.js` extension (`../src/libs/storage.js`). Bun resolves it without one, so a
missing extension only fails once deployed.
