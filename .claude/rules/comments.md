---
paths:
  - "src/**/*.astro"
  - "src/**/*.ts"
  - "api/**/*.ts"
  - "middleware.ts"
---

# Comments

A comment explains code from a bird's-eye view: intent, and why, never a step-by-step restatement of what the
next line already says. If a comment could be deleted after reading the code once, delete it. Never add one
indiscriminately, on every function or every block out of habit; most lines need none. Keep the ones that remain
short: a comment that goes deep into implementation detail has usually drifted into restating the code.

## Functions and methods

Every exported function or method gets a doc block, `@param`/`@returns`/`@throws` where applicable (skip a tag
that doesn't apply; never write `@returns` on a function that returns nothing). The title starts with a verb,
third-person present tense, matching every title already in this codebase: `Builds`, `Puts`, `Reads`, `Registers`,
`Narrows`, never a noun phrase. Verified pattern, from `src/libs/content.ts`:

```ts
/**
 * Reads the values shared across the site, so that a nested component can get
 * one without having it threaded down through props.
 *
 * @param locale - The reader's locale, usually `Astro.currentLocale`. Anything
 *   unsupported, `undefined` included, falls back to {@link DEFAULT_LOCALE}.
 *
 * @returns The settings entry for that locale.
 *
 * @throws When a supported locale has no file, because a shared value that
 *   silently renders empty is harder to notice than a build that fails.
 */
```

A one-line title is enough when it already says everything worth knowing; add a description only when the title
alone leaves something genuinely unclear. Verified pattern, from `src/scripts/alpine.ts`:

```ts
/**
 * Hands the page over to Alpine, which happens once and never again.
 */
```

## Inline comments

Outside a doc block, a `//` comment is for the rare line where the code alone doesn't explain itself: a
non-obvious constraint, a workaround, an edge case a reader would otherwise trip over. Two lines at most, and it
explains why, not what the next line does. Verified pattern, from `src/libs/storage.ts`:

```ts
// Each preview starts on a fresh copy of the database, so the tables are
// created on first use rather than by a migration someone has to remember.
```

If code exists because of something found online, a PR, an issue, a changelog entry, link it with `@see` rather
than re-explaining the reasoning inline:

```ts
// @see https://github.com/withastro/astro/issues/1234
```

## Architectural comments

A comment about a design decision rather than one function follows the same bar as everywhere else: bird's-eye,
short, only where the code genuinely can't explain itself. State the decision first, then why it was made: "We
decided {choice} because {reason}," followed by further context only if the reason alone leaves something
unclear. Verified pattern, from `api/confirm.ts`:

```ts
/**
 * We decided the confirmation link opens a page with a button rather than
 * confirming on its own, because mail scanners open every link in an email to
 * check it, and a GET that confirmed would sign people up without them.
 */
```

## In short

Not too many comments. The ones that exist are short, in plain language, and earn their place.
