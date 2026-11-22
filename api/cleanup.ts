import { hasBearer } from "../src/libs/http.js"
import {
  deleteExpiredProofs,
  deleteExpiredSignups,
} from "../src/libs/storage.js"

/**
 * We decided to delete expired data from a daily Vercel Cron Job rather than
 * on each new signup, because a list nobody joins for a month would otherwise
 * keep unconfirmed addresses past the date the privacy policy promises.
 */

export default {
  /**
   * Deletes what's been kept longer than the privacy policy allows.
   *
   * @param request - Vercel's scheduled call, carrying `CRON_SECRET`.
   *
   * @returns How many rows each database lost, or why it couldn't run.
   */
  async fetch(request: Request): Promise<Response> {
    // Without the secret set, anyone could trigger it, so `hasBearer` refuses
    // every request rather than running unguarded.
    if (!hasBearer(request, "CRON_SECRET")) {
      return new Response(null, { status: 401 })
    }

    const [signups, proofs] = await Promise.allSettled([
      deleteExpiredSignups(),
      deleteExpiredProofs(),
    ])

    const report = Object.fromEntries(
      Object.entries({ proofs, signups }).map(([name, outcome]) => {
        if (outcome.status === "fulfilled") return [name, outcome.value]

        console.error(outcome.reason)

        return [name, "failed"]
      })
    )

    const failed = Object.values(report).includes("failed")

    return Response.json(report, {
      headers: { "Cache-Control": "no-store" },
      status: failed ? 500 : 200,
    })
  },
}
