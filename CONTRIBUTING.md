# Contributing

This guide covers how we work on this project, from local development and code conventions to testing, pull requests
and deployment. It also documents the AI tools we use and the server-side services that need occasional maintenance.

For an overview of the website and the quickest way to get it running, start with the [README](README.md).

## Running this site locally

We normally use [Rift](https://github.com/LucaPipolo/rift), as described in the [README](README.md#running-locally).
You can also run the project directly with Docker Compose or Bun.

### With Docker Compose

The project's `compose.yaml` works without Rift, although you'll need to configure a few values that Rift normally
handles for you.

1. Install [Docker](https://docs.docker.com/get-started/), or [OrbStack](https://docs.orbstack.dev/) on macOS, and make
   sure it's running.

2. Clone the repository and move into it:

   ```bash
   cd monetyo-launch
   ```

3. Create an `.env` file:

   ```bash
   cp .env.example .env
   ```

   Set the following values:

   - `GIT_COMMON_DIR`: the absolute path returned by `git rev-parse --path-format=absolute --git-common-dir`.
   - `ASTRO_DEV_HMR_CLIENT_PORT`: the same value as `APP_PORT`, which defaults to `4321`. This lets hot module
     replacement work without the HTTPS router.

4. Create the Docker network expected by `compose.yaml`. Its name comes from `ROUTER_NAME`, which defaults to
   `rift-router`. You only need to create it once:

   ```bash
   docker network create rift-router
   ```

5. Start the containers:

   ```bash
   docker compose up --build
   ```

6. Open **http://localhost:4321**.

This runs the Vite development server directly over HTTP, without Rift's shared HTTPS router. The Compose configuration
still connects to the router network so it can be used with either setup.

When you're finished, stop the containers with `docker compose down`.

> [!NOTE]
> If you want to run several checkouts using Docker Compose directly, give each one a different `COMPOSE_PROJECT_NAME`
> and `APP_PORT` in its `.env` file. Without Rift, these values aren't assigned automatically.

### Without Docker

If you'd rather run everything directly on your machine, all you need is [Bun](https://bun.sh/docs/installation).

From the root of the cloned repository, install the dependencies and start the development server:

```bash
bun install
bun run dev
```

The site will be available at **http://localhost:4321**. You'll get the same development server and hot reloading, but
without the Docker environment or local HTTPS.

> [!CAUTION]
> The repository's [Git hooks](#git-hooks-and-ci) run commands inside the Docker container. If you're working without Docker,
> you'll need to use `git commit --no-verify` and `git push --no-verify`, or run the equivalent checks manually. The
> hooks work normally with Rift or Docker Compose.

### Project scripts

When using Rift or Docker Compose, run project scripts inside the application container from the root of the current
checkout:

```bash
docker compose exec app bun run <script>
```

| Script          | What it does                                                                        |
| --------------- | ----------------------------------------------------------------------------------- |
| `dev`           | Start the development server                                                        |
| `build`         | Build the website and check the generated output against the CSP                    |
| `preview`       | Serve the production build locally                                                  |
| `test`          | Run the unit tests                                                                  |
| `test:coverage` | Run the tests and enforce 100% coverage                                             |
| `lint`          | Run ESLint                                                                          |
| `format`        | Apply automatic fixes with ESLint and Prettier                                      |
| `format:check`  | Check lint and formatting without changing files                                    |
| `check:type`    | Run `astro check`                                                                   |
| `check:audit`   | Check dependencies for known vulnerabilities                                        |
| `check:csp`     | Check the generated output for scripts and styles that violate the CSP              |
| `notify`        | Email everyone on the waitlist, see [Emailing the waitlist](#emailing-the-waitlist) |

## Project structure

The application lives mainly in `src/`, while Vercel Functions and development configuration are kept at the
repository root.

```text
src/
├── pages/[...locale]/                Routes for each language
├── pages/sitemap.xml.ts              Sitemap
├── pages/robots.txt.ts               robots.txt
├── content.config.ts                 Schemas for every content collection
├── content/                          Pages, settings and email copy
├── components/
│   ├── common/                       Shared UI components
│   ├── legal/                        Layout shared by the legal pages
│   └── sections/                     Page sections
├── layouts/main.astro                Shared HTML layout
├── libs/                             i18n, content loaders, storage, email and utilities
├── scripts/                          Browser-side JavaScript
├── styles/                           Tailwind CSS and stylesheets
├── types/                            Type declarations for dependencies
└── icons/                            Custom SVG icons

api/waitlist.ts                       Waitlist signup endpoint
api/confirm.ts                        Email address confirmation
api/unsubscribe.ts                    Unsubscribe, including one-click unsubscribe
api/cleanup.ts                        Scheduled deletion of expired data
api/notify.ts                         Emails to everyone on the waitlist
api/not-found.ts                      The 404 page in a translated path's language
scripts/notify.ts                     Triggers api/notify.ts, as bun run notify
notices/                              The legal page notices sent to the list
public/                               Sitemap stylesheet and security.txt
tests/                                Vitest unit tests
vitest.config.ts                      Test and coverage configuration
patches/                              Temporary fixes for dependencies
middleware.ts                         Locale negotiation ahead of the cache
vercel.json                           Security headers, function files and cron jobs
rift.yaml                             Rift development configuration
compose.yaml                          Development containers
check-csp.mjs                         Build-time CSP validation
SECURITY.md                           Vulnerability reporting instructions
```

Tests live outside `api/` because Vercel deploys every file in that directory as a function. Keeping test files there
would create unwanted endpoints.

## Editing content

All the site's copy lives in YAML files under `src/content/`, one file per language: `en.yaml` (English, the
default), `es.yaml` (Spanish), `ca.yaml` (Catalan) and `it.yaml` (Italian). The languages and the translated URL of
every page are defined in `src/libs/i18n.ts`. The
schema for every collection is in `src/content.config.ts`, so a missing or misnamed field fails the build rather than
leaving a gap on the page.

- `src/content/pages/<name>/` holds the copy for one page, such as `home` or `privacy`.
- `src/content/settings/` holds copy shared across the site, such as the header, footer and waitlist form.
- `src/content/emails/<name>/` holds the fixed copy of each email: `confirm`, `deletion` (sent after unsubscribing),
  and `survey`, `invite` and `policy` (sent to the whole list). The `api/` functions read these files at request
  time, so `vercel.json` lists them under `includeFiles` for the function that sends each one.

Every page and the settings need a file for every language, or the build fails. There is no fallback from one
language to another.

Emails need a file for every language too, and there is no fallback for them either, but the build doesn't check
that: their files are read only when an email is sent. A missing file makes that email fail. For the emails sent to
the whole list, a dry run of `bun run notify` catches it before anything goes out.

Links in content are written in English and without a language prefix, such as `/privacy/` or `/#roadmap`. Link
fields, such as the header and footer navigation, and links inside the legal pages' text are translated for each
language when the page is rendered, so the Spanish pages link to `/es/privacidad/` and `/es/#hoja-de-ruta`. Links
inside other HTML copy, such as an FAQ answer, are rendered as written.

Email addresses in the legal pages, the waitlist form and the confirm and unsubscribe pages are hidden from scrapers
automatically by `src/libs/obfuscate.ts`, so write them as plain text or as a `mailto:` link.

> [!CAUTION]
> Every consent record stores the waitlist's consent statement and data protection notice exactly as worded, read from
> `waitlist` in `src/content/settings/`, together with the privacy policy's `updated` date as the notice's version.
> Update that date whenever a change to the privacy policy affects what people agree to, so later records point to the
> right version.

## Tests and coverage

Unit tests use [Vitest](https://vitest.dev/) and live in `tests/`, following the structure of `src/libs/` and `api/`.

Every module containing application logic in those directories must have **100% unit test coverage** from the moment
it's introduced. Modules that only export constants are excluded, and are listed explicitly in `vitest.config.ts`.

Run the full suite with coverage using:

```bash
docker compose exec app bun run test:coverage
```

The command also generates an HTML coverage report in `coverage/`, which is useful when you need to see which branches
or statements are missing tests.

## Code style

Formatting and linting are handled automatically, so there's no need to spend time debating individual formatting
choices.

- [Prettier](https://prettier.io/) handles formatting. The project uses double quotes, no semicolons and an 80-column
  print width. The [Astro plugin](https://github.com/withastro/prettier-plugin-astro) formats `.astro` files, while
  the [Tailwind CSS plugin](https://github.com/tailwindlabs/prettier-plugin-tailwindcss) sorts utility classes. The
  remaining options are in `.prettierrc`.
- [ESLint](https://eslint.org/) checks JavaScript, TypeScript and Astro code, including accessibility
  rules. [typescript-eslint](https://typescript-eslint.io/) provides the TypeScript rules,
  while [Perfectionist](https://perfectionist.dev/) keeps imports organised into groups. The grouping conventions are
  documented in `eslint.config.js`.
- [EditorConfig](https://editorconfig.org/) keeps indentation and line endings consistent across editors.

Comments should explain decisions, assumptions or behaviour that isn't obvious from the code. Avoid comments that simply
repeat what the next line does.

To apply automatic fixes, run:

```bash
docker compose exec app bun run format
```

To check lint and formatting without changing any files:

```bash
docker compose exec app bun run format:check
```

## Branches, commits and pull requests

Create branches from `main` and name them using `<type>/<short-description>`, for example `feat/waitlist-form` or
`fix/locale-redirect`.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/), enforced
by [commitlint](https://commitlint.js.org/):

```text
<type>: <description>
```

Alongside the standard commit types, this repository uses two additional ones:

- `ai` for AI-related configuration, such as `CLAUDE.md`, agent instructions or skills.
- `content` for changes to the site's written content under `src/content/`.

Commit scopes aren't used. Write `feat: add a waitlist form`, rather than `feat(waitlist): add a waitlist form`.

### Keeping commits independent

Each commit should represent one coherent change and leave the project in a working state. If someone checks it out on
its own, the site should build and the tests should pass.

Keep code and content changes in separate commits. When introducing a new field in a content collection, first add it as
an optional field in `src/content.config.ts`. Add the corresponding content for every language in a separate commit.

If you need to correct an earlier commit on the same branch, use `git commit --fixup=<sha>` rather than amending it.

### Pull requests

Pull requests target `main` and use a plain, sentence-case title. For example, `Add legal pages` rather than
`feat: add legal pages`.

The description should contain two sections:

- **Context:** What changed and why.
- **Verification Plan:** Numbered steps a reviewer can follow to check the implementation.

Pull requests are merged using rebase, preserving the individual commits on `main`.

We use a few [Claude Code skills](https://code.claude.com/docs/en/skills) to keep this process consistent:

| Skill                       | Purpose                                                                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `git-commit`                | Reviews staged changes, writes a Conventional Commit message and validates it. Claude uses it automatically when committing            |
| `/open-pr`                  | Opens a pull request with the title and description format used by this repository                                                     |
| `/address-pr-comments [PR]` | Reviews unresolved comments, makes relevant changes and replies where needed. Uses the current branch's PR unless a number is provided |

> [!NOTE]
> `/address-pr-comments` is configured for the review comments left by [ChatGPT Codex](https://chatgpt.com/codex)'s bot
> account. It could be extended to support other reviewers.

## Git hooks and CI

[Husky](https://typicode.github.io/husky/) manages
three [Git hooks](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks), which run inside the application container.

| Hook         | Checks                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| `pre-commit` | [lint-staged](https://github.com/lint-staged/lint-staged), running ESLint and Prettier on staged files |
| `commit-msg` | Commit message validation with commitlint                                                              |
| `pre-push`   | The complete test suite with coverage enforcement                                                      |

If the container isn't running, the hook fails rather than silently skipping its checks. Start the environment with
`rift up` before committing or pushing. If necessary, hooks can be bypassed with `--no-verify`, although you should run
the relevant checks manually.

Every pull request and every push to `main` also run a set of [GitHub Actions](https://docs.github.com/en/actions)
workflows. Commitlint and Preview cleanup run on pull requests only, and Audit runs on a pull request only when it
changes `package.json`, `bun.lock` or the workflow itself.

| Workflow        | What it checks                                                                 |
| --------------- | ------------------------------------------------------------------------------ |
| Build           | Production build and CSP validation                                            |
| Tests           | Complete test suite with 100% coverage                                         |
| Types           | `check:type`                                                                   |
| Lint            | `format:check`                                                                 |
| Audit           | Known dependency vulnerabilities, also checked on a schedule                   |
| CodeQL          | [CodeQL](https://codeql.github.com/) security analysis, also run on a schedule |
| Commitlint      | Every commit message in the pull request                                       |
| Preview cleanup | Removes preview deployments when a pull request is closed                      |

Preview cleanup is a maintenance workflow rather than a validation check. Each preview deployment keeps its Neon
branches alive, and Neon's plans limit how many can exist. To use it, create
a [Vercel access token](https://vercel.com/account/settings/tokens) scoped to the project's team and, under **Settings →
Secrets and variables → Actions**, save it as the secret `VERCEL_TOKEN`, and the Vercel project and team IDs as the
variables `VERCEL_PROJECT_ID` and `VERCEL_TEAM_ID`.

## Working in parallel

The development environment is designed around [Git worktrees](https://git-scm.com/docs/git-worktree). With Rift, each
worktree has its own containers, port and local HTTPS domain, so you can run several branches without conflicts.

To create another working copy:

```bash
git worktree add -b my-feature ../my-feature
cd ../my-feature
rift setup
```

The new worktree will be available at **https://my-feature.monetyo-launch.test**, alongside the main checkout at
**https://monetyo-launch.test**.

Stopping it with `rift down` only affects that worktree. The shared router and any other running environments remain
available.

This is particularly useful when working with several AI agents at once. Each agent can work on a separate branch with
its own running website, without interfering with another agent's files or development server.

## AI tooling

We use AI agents throughout development, often running several in parallel on different tasks. Each agent works in an
isolated environment with its own checkout, as described in [Working in parallel](#working-in-parallel), which makes it
easier to review changes and avoid conflicts.

The main agent is [Claude Code](https://claude.com/product/claude-code). Its project instructions live in `CLAUDE.md`
and `.claude/`, which are committed to the repository so every worktree uses the same setup. The site's
[AI content page](https://monetyo.com/ai-content/) explains how AI is used to write and review the website.

### Recording AI-assisted work

Commits created with AI assistance include a `Co-Authored-By: Claude Code <noreply@anthropic.com>` trailer and a
`Model: <name> (<id>)` line identifying the model involved.

We keep this information in the commit history because we want to know which tools and models contributed to a change.
It helps us evaluate how well different workflows work over time.

### Agent skills

In addition to the [commit and pull request skills](#branches-commits-and-pull-requests), there are skills for design
work and one that is invoked manually:

| Skill                  | Purpose                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| `landing-page-design`  | Page structure, conversion copy and the visual rules for this site. Claude uses it automatically for UI work |
| `frontend-design`      | Guidance for distinctive visual design when building or reshaping UI. Claude uses it automatically           |
| `/update-dependencies` | Updates Bun dependencies one at a time, creating a separate commit for each update                           |

> [!NOTE]
> `/update-dependencies` has `disable-model-invocation: true` in its frontmatter, so agents don't run it automatically.

## Deploying and operating

The website itself deploys through Vercel. The waitlist and its supporting functions need a few additional services and
environment variables.

### The waitlist

The form submits requests to `api/waitlist.ts`, a [Vercel Function](https://vercel.com/docs/functions) that validates
the submission, verifies the [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) token, stores the
signup as pending with a record of the privacy notice shown, and sends a confirmation email
through [Brevo](https://developers.brevo.com/).

The confirmation email links to the site's `/confirm/` page with a token, and the address is confirmed by a POST to
`api/confirm.ts` when the button on that page is pressed, rather than by opening the link, because mail scanners open
every link in an email. Every email sent to someone on the list also carries a signed link to the `/unsubscribe/`
page, which works the same way and posts to `api/unsubscribe.ts`. That function also accepts one-click unsubscribe
from mail clients ([RFC 8058](https://www.rfc-editor.org/rfc/rfc8058)). It deletes the signup and sends a last email
confirming the address is gone. Confirming and unsubscribing each store their own consent record.

Configure the following environment variables in the Vercel project:

| Variable                   | Purpose                                                                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `TURNSTILE_SITE_KEY`       | Public Turnstile widget key, read at build time. `.env.example` holds Cloudflare's test key for local development           |
| `TURNSTILE_SECRET_KEY`     | Turnstile secret key, used by `api/waitlist.ts` to verify tokens                                                            |
| `BREVO_API_KEY`            | Brevo API key with permission to send transactional emails. It must be an API key starting with `xkeysib-`, not an SMTP key |
| `DB_WAITLIST_DATABASE_URL` | Neon connection string for the signup database, configured through Vercel's Neon integration with the `DB_WAITLIST` prefix  |
| `DB_CONSENT_DATABASE_URL`  | Neon connection string for the separate consent record database, using the `DB_CONSENT` prefix                              |
| `CONSENT_IP_HASH_SECRET`   | Secret used to calculate keyed hashes of signups' IP addresses                                                              |
| `UNSUBSCRIBE_SECRET`       | Secret used to sign and verify unsubscribe links. Changing it invalidates every link already sent                           |
| `CRON_SECRET`              | Secret used to authenticate scheduled requests to `api/cleanup.ts`                                                          |
| `NOTIFY_SECRET`            | Bearer token `api/notify.ts` requires. If it isn't set, the function refuses every request                                  |
| `NOTIFY_TEST_EMAIL`        | The inbox that `bun run notify ... --test` sends one copy in each language to                                               |

Every email is sent from `hello@monetyo.com`, set as `SENDER` in `src/libs/email.ts`. That domain must be
authenticated in Brevo, or the emails fail DMARC checks.

Both databases create their tables on first use, so new preview branches don't need a separate migration step.

#### Emailing the waitlist

To see every email in every language before sending anything, open `/emails/all/` on your checkout's domain while the
dev server runs (for example `https://monetyo-launch.test/emails/all/`). It exists in development only.

`api/notify.ts` sends one email to everyone confirmed on the list, each in the language they signed up in and with
their own unsubscribe link. There are three templates: `survey` and `invite`, which link to a URL given when sending,
and `policy`, a notice that a legal page changed. The sending happens on Vercel, because the database and Brevo keys
are [sensitive environment variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables)
that Vercel never hands out. `bun run notify` (`scripts/notify.ts`) only tells the function what to send.

The script reads these variables from your shell, not from `.env`, so export them and pass them into the container
with `-e`:

| Variable                          | Purpose                                                                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `NOTIFY_SECRET`                   | The same value as in Vercel                                                                                                              |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Gets the request past Vercel's bot protection and, on a preview, Vercel Authentication. Found under **Settings → Deployment Protection** |
| `NOTIFY_URL`                      | Leave unset for production. Set it to a preview's `/api/notify/` URL to try a send there first                                           |

Each run is a dry run unless you add a flag:

1. Run it without a flag. It checks that the copy is complete in every language the recipients need, counts them by
   language and sends nothing:

   ```bash
   docker compose exec -T -e NOTIFY_SECRET -e VERCEL_AUTOMATION_BYPASS_SECRET app bun run notify survey https://tally.so/r/abc123
   ```

2. Add `--test` to send one copy in each language to `NOTIFY_TEST_EMAIL`, and read them.
3. Add `--send` to send it to everyone confirmed.

For `invite`, pass the app's URL instead of the survey's. For `policy`, pass a notice file instead of a URL:

```bash
docker compose exec -T -e NOTIFY_SECRET -e VERCEL_AUTOMATION_BYPASS_SECRET app bun run notify policy notices/2027-03-01-new-processor.yaml
```

A notice holds the page that changed and a subject and body in every language. Copy `notices/example.yaml` to a file
named after the date and the change, fill it in and commit it, so the repository keeps what was sent. The rest of
the email, such as why the recipient is getting it and how to object, comes from `src/content/emails/policy/`.

Every send is recorded in a `broadcasts` table in the consent database, with the template, the subject, the privacy
policy's version and how many emails were delivered or failed, but no addresses.

#### Deleting expired data

The scheduled function `api/cleanup.ts` runs once a day through a [Vercel Cron Job](https://vercel.com/docs/cron-jobs),
configured under `crons` in `vercel.json`.

It deletes pending signups older than 7 days, confirmed signups older than 24 months and consent records older than
three years, matching the retention periods described in the website's privacy policy. All three periods are configured
in `RETENTION`, in `src/libs/storage.ts`.

Cron jobs run only on the production deployment. If `CRON_SECRET` isn't set, the function refuses every request rather
than running unguarded.

> [!CAUTION]
> Vercel's bot protection may challenge automated requests, including scheduled calls to the cleanup endpoint. After the
> first production deployment, open **Settings → Cron Jobs** and check that the latest run returned `200`. If it
> returned `429`, the firewall blocked the request and expired records won't be deleted until the problem is resolved.

> [!NOTE]
> Functions in `api/` are compiled individually and run as ES modules on Node.js. Relative imports need their `.js`
> extension, for example `../src/libs/storage.js`. Bun resolves extensionless imports locally, so an incorrect import
> may work during development and fail after deployment.

## Reporting bugs

If you find a security vulnerability, follow [SECURITY.md](SECURITY.md) and don't create a public issue.

For other bugs, open an issue in this repository. Include the affected URL, what you did, what you expected to happen and
your browser and version. If you can reproduce the problem consistently, include the steps.
