# Security policy

This repository is the source of [monetyo.com][site], Monetyo's pre-launch
website. Most of the site is static, but its waitlist stores the email
addresses people sign up with, and the proof of the privacy notice they were
shown, in two [Neon] databases. Reports of anything that could expose that
data, or weaken the site's Content-Security-Policy, are very welcome.

The Monetyo app is not part of this repository and will have its own security
policy when it launches.

## Supported versions

Only the site as currently deployed from `main` receives security fixes. There
are no releases or older versions to patch.

## Reporting a vulnerability

Do not open a public issue, and please don't share the problem publicly until
it has been fixed. Report it privately by email to
[privacy@monetyo.com](mailto:privacy@monetyo.com).

Include:

- what an attacker could do, and under which conditions,
- the steps to reproduce it, with the URL or request involved,
- the browser and its version, if the issue happens client-side.

You will get a reply as soon as possible, and word once the fix is deployed.
The site's [security page][security] describes the same process for
non-developers.

## Scope

In scope:

- the pages served at [monetyo.com][site] and their client-side scripts,
- the Vercel Functions in `api/`: the waitlist signup, the address
  confirmation, unsubscribing, the daily data cleanup, the translated 404
  page (`api/not-found`), and `api/notify`, which
  emails everyone on the waitlist and only answers requests carrying its
  bearer token,
- how signups and their consent records are stored, kept and deleted,
  including the confirmation tokens and signed unsubscribe links,
- the Content-Security-Policy and other headers in `vercel.json`, and the locale
  negotiation in `middleware.ts`.

Out of scope, so report it to the project concerned instead:

- vulnerabilities in [Vercel], Neon, [Brevo], [Cloudflare Turnstile][turnstile]
  or other services and dependencies, unless the site's use of them causes the
  issue,
- the Monetyo app, which this repository doesn't contain,
- findings from automated scanners with no demonstrated impact,
- denial of service through traffic volume, and social engineering.

[Brevo]: https://www.brevo.com/
[Neon]: https://neon.tech/
[security]: https://monetyo.com/security/
[site]: https://monetyo.com
[turnstile]: https://www.cloudflare.com/application-services/products/turnstile/
[Vercel]: https://vercel.com/
