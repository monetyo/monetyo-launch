import { ipAddress } from "@vercel/functions"
import { randomUUID } from "node:crypto"

import { hashIp, type Purpose, readNotice } from "./consent.js"
import { secret } from "./http.js"
import { type Locale } from "./i18n.js"
import { storeProof } from "./storage.js"

/** Longer than any real browser's, so the rest is never worth keeping. */
const MAX_USER_AGENT = 512

/** What a proof is about, beyond what the request itself tells. */
interface Subject {
  locale: Locale
  page: string
  purpose: Purpose
  signupId: string
}

/**
 * Records what a Visitor was told and when, alongside a pseudonymised trace of
 * who did it, as the proof GDPR asks a controller to be able to show.
 *
 * @param request - The request that gave, confirmed or withdrew consent.
 * @param subject - Which signup, in which language, from which page, and why.
 *
 * @throws When the hashing secret is missing, the notice can't be read or the
 *   database refuses it.
 */
export async function recordProof(
  request: Request,
  subject: Subject
): Promise<void> {
  const key = secret("CONSENT_IP_HASH_SECRET")
  const notice = await readNotice(subject.locale)

  await storeProof({
    ...subject,
    id: randomUUID(),
    ipHash: hashIp(ipAddress(request) ?? "", key),
    notice: notice.text,
    noticeVersion: notice.version,
    recordedAt: new Date().toISOString(),
    userAgent: (request.headers.get("user-agent") ?? "").slice(
      0,
      MAX_USER_AGENT
    ),
  })
}
