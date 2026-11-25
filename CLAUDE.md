# CLAUDE.md

This project is the pre-launch landing site of Monetyo, a household money app. It presents the product and runs its
waitlist: a double opt-in signup form, confirmation and unsubscribe flows, the consent records that prove them, and
the emails sent to the whole list. The content is written in four languages: English (UK, default), Spanish (Spain),
Catalan and Italian.

## Foundational Context

This is an Astro application with static output and no server adapter, plus Vercel Functions in `api/`, deployed on
Vercel. See Architecture below for details.

- astro — 7
- @monetyo/brand — 0 (palette, type styles, font, logos, icons, tokens.json)
- typescript — 6
- vitest — 5
- tailwindcss — 4
- @alpinejs/csp — 3
- astro-icon — 1
- @neondatabase/serverless — 1
- @vercel/functions — 3
- yaml — 2
- prettier — 3
- eslint — 10
- husky — 9
- lint-staged — 17
- commitlint — 21

## Project structure

```
src/
├── pages/[...locale]/         routes — getStaticPaths() drives locale routing
├── pages/*.xml.ts, *.txt.ts   sitemap.xml and robots.txt
├── pages/favicon.ico.ts       favicon.ico, copied from @monetyo/brand at build time
├── content.config.ts          Zod schema for every collection below
├── content/
│   ├── emails/<name>/<locale>.yaml  fixed copy of the emails api/ sends (confirm, deletion, survey, invite, policy)
│   ├── pages/<name>/<locale>.yaml   per-locale page copy (home, legal pages, confirm, unsubscribe, not-found)
│   └── settings/<locale>.yaml       shared site copy — header, footer, waitlist form
├── components/
│   ├── common/                 generic, reusable primitives
│   ├── legal/                  the layout every legal page shares
│   └── sections/               named page sections (Hero, Roadmap, Privacy, SiteHeader, EmailAction…)
├── layouts/main.astro          shared HTML shell — header, footer, meta
├── libs/                       i18n, content loaders, storage, emails, tokens, obfuscation, utils
├── scripts/                    client-side browser scripts (Alpine, waitlist, menus, favicon…)
├── styles/                     Tailwind config-in-CSS + partials
├── types/                      type declarations for untyped packages
└── icons/                      hand-authored SVGs

api/                            Vercel Functions — waitlist, confirm, unsubscribe, cleanup cron, notify
scripts/notify.ts               `bun run notify`: triggers api/notify from the command line
notices/                        policy notices sent to the list, kept as a record
public/                         sitemap.css, .well-known/security.txt
middleware.ts                   Vercel Routing Middleware, on Node.js: locale negotiation
vercel.json                     Vercel HTTP response headers (CSP, HSTS, …), function files, crons
rift.yaml                       local dev environment — Rift settings
compose.yaml                    local dev containers
check-csp.mjs                   build-time CSP check
tests/                          Vitest unit tests, mirroring src/libs/ and api/
vitest.config.ts                test runner and coverage settings
```

## Development environment

The dev environment is built for AI agents working in parallel: Rift plus git worktrees, one isolated container
set and HTTPS domain per worktree. See more about the Rift development workflow in @.claude/guidelines/dev-env.md

## Architecture

How Astro's content model, Alpine's CSP build, locale routing, the waitlist, and Vercel fit together:
@.claude/guidelines/architecture.md

## Git

When to commit, what makes a commit atomic, and how content and code commits stay separate:
@.claude/guidelines/git.md

## Docs

What `README.md`, `CONTRIBUTING.md` and `SECURITY.md` must cover, and when to update or add to them:
@.claude/guidelines/docs.md
