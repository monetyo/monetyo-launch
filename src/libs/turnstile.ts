import { secret } from "./http.js"

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

/**
 * Asks Cloudflare whether a Turnstile token is genuine and unused.
 *
 * @param token - The token the widget issued.
 * @param ip - The Visitor's address, which Cloudflare weighs alongside it.
 *
 * @returns Whether the token passed. An empty token never does, and never
 *   costs a request.
 *
 * @throws When the secret isn't set or Cloudflare can't be reached, which is
 *   the site's fault rather than the Visitor's.
 */
export async function verifyTurnstile(
  token: string,
  ip: string | undefined
): Promise<boolean> {
  const key = secret("TURNSTILE_SECRET_KEY")

  if (!token) return false

  const form = new FormData()

  form.append("secret", key)
  form.append("response", token)
  if (ip) form.append("remoteip", ip)

  const response = await fetch(SITEVERIFY, { body: form, method: "POST" })

  if (!response.ok) {
    throw new Error(`Turnstile answered ${response.status}.`)
  }

  const result = (await response.json()) as { success?: boolean }

  return result.success === true
}
