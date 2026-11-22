---
paths:
  - "src/libs/**"
  - "api/**"
  - "tests/**"
  - "vitest.config.ts"
---

# Tests

Unit tests run on [Vitest](https://vitest.dev/), configured in `vitest.config.ts` through Astro's `getViteConfig()`,
so a test resolves `@/` and loads modules the way the build does.

## Where they go

`tests/` mirrors the source: `src/libs/i18n.ts` is tested in `tests/libs/i18n.test.ts`, `api/waitlist.ts` in
`tests/api/waitlist.test.ts`. Never put a test inside `api/`: Vercel deploys every file there as a function, so it
would ship as a public endpoint.

## Coverage

Every file under `src/libs/` and `api/` is held to 100% lines, branches, functions and statements, each file on its
own, so a new module lands with its tests in the same commit or the run fails.

When a branch can't be reached by any input, it is dead code: remove it in its own `refactor:` commit ahead of the
tests, and check the built site is unchanged. Never silence it with an ignore comment.

A module that only holds constants (`button.ts`, `palette.ts`, `site.ts`) gets no test, since one that could only
repeat the values back catches nothing; list it in `coverage.exclude` instead.

## What a test does

- Test what the code promises, as its doc block states it: the edge cases it names are the tests to write.
- Run the real thing where it is cheap: hashing, signing and token checks in `tokens.ts` and `consent.ts` run for
  real, not against a stub. Mock only what leaves the process, such as `fetch` (`vi.stubGlobal`) for Brevo and
  Turnstile, environment variables (`vi.stubEnv`) and the Neon client (`@neondatabase/serverless`), and undo it in
  `afterEach`.
- Code that reads content collections runs against `tests/support/astro-content.ts`, a stand-in for
  `astro:content` that each test fills with only the entries it needs, never against `src/content/`, which changes
  whenever the copy does.
- Code that reads content files at request time (`api/` and what it imports, such as `consent.ts` and
  `confirmation.ts`) runs against `tests/support/files.ts`, a stand-in for `node:fs/promises` filled the same way.
- An `api/` handler's test mocks the libs it calls, already tested on their own (`@/libs/storage`, `@/libs/email`,
  `@/libs/proofs`, `@/libs/turnstile`...), and checks what the handler stores, sends and answers. Exercise each
  guard with the input it really guards against: a missing or wrong `CRON_SECRET`, a tampered unsubscribe signature,
  a filled honeypot, a non-POST method.
- Before trusting a new test, see it fail: break the code or the expectation once. A test that passes for the wrong
  reason hides the gap it was meant to close.
- Name each test as a plain sentence about behaviour: `leaves a placeholder with no value as it is`.

## Running them

```bash
docker compose exec app bun run test
docker compose exec app bun run test:coverage
```

The `pre-push` hook runs `test:coverage`.
