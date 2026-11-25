import { readFile } from "node:fs/promises"
import { join } from "node:path"

/**
 * Serves the brand's favicon.ico at the site root, where browsers and crawlers
 * that don't read the `<link rel="icon">` look for it.
 *
 * We decided to copy it from @monetyo/brand at build time rather than keep a
 * copy in `public/`, so the icon can't drift from the brand.
 */
export async function GET() {
  const icon = await readFile(
    join(process.cwd(), "node_modules/@monetyo/brand/exports/icons/favicon.ico")
  )

  return new Response(icon, { headers: { "Content-Type": "image/x-icon" } })
}
