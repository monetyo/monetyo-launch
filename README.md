[![Build][badge-build]][workflow-build]
[![Tests][badge-tests]][workflow-tests]
[![Types][badge-types]][workflow-types]
[![Lint][badge-lint]][workflow-lint]
[![CodeQL][badge-codeql]][workflow-codeql]
[![Audit][badge-audit]][workflow-audit]

Source code for [monetyo.com](https://monetyo.com), the pre-launch website of Monetyo, a household money app. The site
presents the product and collects signups for its waitlist. It's built with [Astro](https://astro.build/) and deployed
on [Vercel](https://vercel.com/).

## Features

- **Four languages.** Every page is available in English, Spanish, Catalan and Italian, with translated URLs such as
  `/privacy/`, `/es/privacidad/` and `/it/privacy/`. On their first visit to the homepage, visitors are directed to a
  language based on their browser preferences, and a language picked from the switcher in the header is remembered
  for later visits.
- **Waitlist with double opt-in.** The signup form is protected against spam
  with [Cloudflare Turnstile](https://www.cloudflare.com/application-services/products/turnstile/). Each signup receives
  a confirmation email, and an address only joins the list once its link is opened and the button on that page is
  pressed. Unsubscribing works the same way, because mail scanners open every link in an email to check it. Every
  email sent to someone on the list carries an unsubscribe link, including one-click unsubscribe for mail clients
  that support it, and leaving the list is confirmed by a last email.
- **Emails to the whole list.** A survey, an invitation to try the app, or a notice that a legal page changed is sent
  to every confirmed address in its own language, by hand and one occasion at a time. See
  [Emailing the waitlist](CONTRIBUTING.md#emailing-the-waitlist).
- **Privacy and data retention.** Signups and the records of what each person agreed to are stored in two separate
  databases. Unconfirmed signups are deleted after 7 days, confirmed ones after 24 months, and consent records after
  three years, all automatically. The setup is documented in [Deploying and operating](CONTRIBUTING.md#deploying-and-operating).
- **Strict security headers.**
  The [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP) doesn't allow inline
  scripts, inline styles or `eval`. The build also checks the generated pages for violations.
- **Contact details hidden from scrapers.** Email addresses and the owner details the legal notice must show are
  written reversed in the HTML, displayed the right way round with CSS and restored by a script, so they stay
  readable without JavaScript.
- **SEO and metadata.** A sitemap that can also be read in a browser, `robots.txt`, `hreflang` alternates and Open
  Graph tags, all generated at build time, and a [`security.txt`](https://securitytxt.org/) pointing to how to report
  a vulnerability.
- **Automated checks.** Modules containing application logic must reach 100% unit test coverage. Git hooks check
  formatting, commit messages and coverage before code leaves the machine.
  See [Tests and coverage](CONTRIBUTING.md#tests-and-coverage) and [Git hooks and CI](CONTRIBUTING.md#git-hooks-and-ci).
- **Parallel development with AI agents.** Each AI agent works in its own Git worktree and development environment. The
  site includes a disclosure about AI-assisted content, while [AI tooling](CONTRIBUTING.md#ai-tooling) documents the
  tools used on the code.

## Tech stack

- [Astro](https://astro.build/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Alpine.js](https://alpinejs.dev/)
- [Vercel Functions](https://vercel.com/docs/functions)
- [Neon](https://neon.tech/)
- [Brevo](https://www.brevo.com/)
- [Cloudflare Turnstile](https://www.cloudflare.com/application-services/products/turnstile/)

## Running locally

We use [Rift](https://github.com/LucaPipolo/rift) to manage the local development environment. It runs the site in
Docker with HTTPS and gives every [Git worktree](https://git-scm.com/docs/git-worktree) its own containers and domain,
so several checkouts can run at once.

To get started:

1. Install [Rift](https://github.com/LucaPipolo/rift#install) and [Docker](https://docs.docker.com/get-started/), and
   make sure Docker is running.
2. Configure your machine to resolve `.test` domains locally, for example
   with [dnsmasq](https://formulae.brew.sh/formula/dnsmasq).
3. Clone the repository into a directory named `monetyo-launch`, then run the setup from inside it:

   ```bash
   cd monetyo-launch
   rift setup
   ```

4. Open **https://monetyo-launch.test**.

Rift starts the containers and configures the local environment. The [Vite](https://vite.dev/) development server
handles hot reloading, so changes appear in the browser without restarting anything.

> [!NOTE]
> On the first run, your system will ask for your password to trust the local HTTPS certificate.

You can also run the project with plain [Docker Compose](https://docs.docker.com/compose/) or without Docker. Both
options are covered in [CONTRIBUTING.md](CONTRIBUTING.md#running-this-site-locally).

If you're working with multiple worktrees, see [Working in parallel](CONTRIBUTING.md#working-in-parallel)
and [Rift's README](https://github.com/LucaPipolo/rift#why-use-rift).

## Everyday commands

Run these from the root of the checkout you're working in:

| Command       | What it does                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| `rift up`     | Start the current checkout                                                                               |
| `rift down`   | Stop the current checkout without affecting other worktrees or the shared router                         |
| `rift setup`  | Generate `.env` and start the environment. Use it for a new worktree or after changing its configuration |
| `rift status` | Show the applications registered with the router                                                         |
| `rift doctor` | Check the environment for configuration problems                                                         |

Add `-v` to a command, such as `rift up -v`, to see the full output.

Project scripts, including tests and checks, run inside the application container. You'll find the available scripts and
instructions in [CONTRIBUTING.md](CONTRIBUTING.md#project-scripts).

## Security

The waitlist stores email addresses and records of consent, so please report anything that could expose that information
or weaken the site's security, including its Content Security Policy and the authenticated endpoint that emails the list.

**Don't open a public issue for security vulnerabilities.** Email [privacy@monetyo.com](mailto:privacy@monetyo.com) as
described in [SECURITY.md](SECURITY.md), which also explains what's in scope.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding conventions, tests and pull request guidelines.

## License

The code is released under the [MIT License](./LICENSE.md): reuse it however you like.

The MIT License doesn't cover the Monetyo brand or the site's content, which remain © Luca Pipolo, all rights
reserved:

- the Monetyo name, logos and design tokens, which come from
  [`@monetyo/brand`](https://www.npmjs.com/package/@monetyo/brand) under its own licence,
- the site's copy, legal texts and emails in `src/content/`,
- the policy notices in `notices/`.

Please don't use them to present another site or product as Monetyo.

[badge-build]: https://img.shields.io/github/actions/workflow/status/monetyo/monetyo-launch/build.yml?branch=main&label=build&style=flat-square&logo=githubactions&logoColor=white
[badge-tests]: https://img.shields.io/github/actions/workflow/status/monetyo/monetyo-launch/tests.yml?branch=main&label=tests&style=flat-square&logo=githubactions&logoColor=white
[badge-types]: https://img.shields.io/github/actions/workflow/status/monetyo/monetyo-launch/types.yml?branch=main&label=types&style=flat-square&logo=githubactions&logoColor=white
[badge-lint]: https://img.shields.io/github/actions/workflow/status/monetyo/monetyo-launch/lint.yml?branch=main&label=lint&style=flat-square&logo=githubactions&logoColor=white
[badge-codeql]: https://img.shields.io/github/actions/workflow/status/monetyo/monetyo-launch/codeql.yml?branch=main&label=codeql&style=flat-square&logo=githubactions&logoColor=white
[badge-audit]: https://img.shields.io/github/actions/workflow/status/monetyo/monetyo-launch/audit.yml?branch=main&label=audit&style=flat-square&logo=githubactions&logoColor=white
[workflow-build]: https://github.com/monetyo/monetyo-launch/actions/workflows/build.yml
[workflow-tests]: https://github.com/monetyo/monetyo-launch/actions/workflows/tests.yml
[workflow-types]: https://github.com/monetyo/monetyo-launch/actions/workflows/types.yml
[workflow-lint]: https://github.com/monetyo/monetyo-launch/actions/workflows/lint.yml
[workflow-codeql]: https://github.com/monetyo/monetyo-launch/actions/workflows/codeql.yml
[workflow-audit]: https://github.com/monetyo/monetyo-launch/actions/workflows/audit.yml
