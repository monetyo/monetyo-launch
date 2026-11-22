/**
 * Triggers `api/notify`, which emails everyone confirmed on the waitlist.
 *
 * We decided to send from Vercel rather than from this machine, because the
 * database and Brevo keys are Sensitive variables Vercel never hands out:
 * this script only carries what to send and `NOTIFY_SECRET`.
 *
 * Usage, from the repository root:
 *
 *   docker compose exec -T -e NOTIFY_SECRET -e VERCEL_AUTOMATION_BYPASS_SECRET \
 *     app bun run notify survey https://tally.so/r/abc123 [--test | --send]
 *   ... bun run notify invite https://app.monetyo.com/join [--test | --send]
 *   ... bun run notify policy notices/2027-03-01-new-processor.yaml [--test | --send]
 *
 * Without a flag it's a dry run: it checks the copy, counts the recipients by
 * language and sends nothing. `NOTIFY_URL` points it at a preview instead.
 */

import { readFile } from "node:fs/promises"
import { parse } from "yaml"

const DEFAULT_URL = "https://monetyo.com/api/notify/"

const [template, target, flag] = process.argv.slice(2)
const mode = flag === "--send" ? "send" : flag === "--test" ? "test" : "dry-run"
const secret = process.env.NOTIFY_SECRET
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
const url = process.env.NOTIFY_URL || DEFAULT_URL

if (
  !["invite", "policy", "survey"].includes(template) ||
  !target ||
  (flag && !["--send", "--test"].includes(flag))
) {
  console.error(
    "Usage: bun run notify <survey|invite> <https url> [--test | --send], or bun run notify policy <notice.yaml> [--test | --send]. Without a flag, nothing is sent."
  )
  process.exit(1)
}

if (!secret) {
  console.error(
    "No NOTIFY_SECRET. Export it in your shell and pass it with `docker compose exec -e NOTIFY_SECRET`."
  )
  process.exit(1)
}

const body =
  template === "policy"
    ? { mode, notice: parse(await readFile(target, "utf8")), template }
    : { mode, template, url: target }

const headers: Record<string, string> = {
  Authorization: `Bearer ${secret}`,
  "Content-Type": "application/json",
}

// Vercel's bot protection challenges non-browsers and a preview sits behind
// Vercel Authentication; the automation bypass secret gets past both.
if (bypass) headers["x-vercel-protection-bypass"] = bypass

console.log(`${template}, ${mode} → ${url}`)

const response = await fetch(url, {
  body: JSON.stringify(body),
  headers,
  method: "POST",
})
const mitigated = response.headers.get("x-vercel-mitigated")

if (mitigated) {
  console.error(
    `${response.status}: Vercel's bot protection stopped the request (${mitigated}). Set VERCEL_AUTOMATION_BYPASS_SECRET and pass it with \`-e\`.`
  )
} else if (response.headers.get("content-type")?.includes("json")) {
  console.log(response.status, JSON.stringify(await response.json(), null, 2))
} else {
  // Anything else is a Vercel page (a 404 before the deploy, an error), not
  // the endpoint's answer, so only its status is worth showing.
  console.error(
    `${response.status}: not an answer from api/notify. Is it deployed at ${url}?`
  )
}

process.exit(response.ok ? 0 : 1)
