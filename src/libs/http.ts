import { createHash, timingSafeEqual } from "node:crypto"

/**
 * Builds a JSON response no cache keeps, since every answer here is about one
 * Visitor's own request.
 *
 * @param body - What to send back.
 * @param status - The HTTP status.
 *
 * @returns The response.
 */
export function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  })
}

/**
 * Reads a request's JSON body as a plain object.
 *
 * @param request - The incoming request.
 *
 * @returns The object, or `undefined` when the body isn't JSON or isn't an
 *   object, which is never what a form sends.
 */
export async function readJson(
  request: Request
): Promise<Record<string, unknown> | undefined> {
  try {
    const body: unknown = await request.json()

    return typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}

/**
 * Reads one field of a body as text, treating anything else as empty rather
 * than trusting the browser to send the right type.
 *
 * @param data - The parsed body.
 * @param key - The field.
 *
 * @returns The field's value, or an empty string.
 */
export function text(data: Record<string, unknown>, key: string): string {
  const value = data[key]

  return typeof value === "string" ? value : ""
}

/**
 * Reads a secret the deployment must have.
 *
 * @param name - The environment variable.
 *
 * @returns Its value.
 *
 * @throws When it isn't set, naming where to set it.
 */
export function secret(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(
      `Missing secret. Set \`${name}\` in this Vercel environment.`
    )
  }

  return value
}

/**
 * Checks that a request carries a secret as its bearer token, in constant
 * time, so how long the comparison takes gives nothing away about the secret.
 * Both sides are hashed first, which gives them the same length and keeps the
 * secret's own length hidden too.
 *
 * @param request - The incoming request.
 * @param name - The environment variable holding the secret.
 *
 * @returns Whether the token matches. Always `false` when the secret isn't
 *   set, since running unguarded would let anyone in.
 */
export function hasBearer(request: Request, name: string): boolean {
  const value = process.env[name]

  if (!value) {
    return false
  }

  const digest = (input: string) => createHash("sha256").update(input).digest()

  return timingSafeEqual(
    digest(request.headers.get("authorization") ?? ""),
    digest(`Bearer ${value}`)
  )
}
