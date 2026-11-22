import { register } from "@/scripts/alpine"

/** What the confirm and unsubscribe endpoints answer with when they fail. */
type Failure = "expired" | "generic" | "invalid"

/**
 * Takes the one action an email link asks for, confirming an address or
 * unsubscribing it, once the Visitor presses the button.
 *
 * We decided against acting on page load because mail scanners open links
 * to check them, and a scanner must never confirm or delete an address.
 */
register("emailAction", () => ({
  state: "idle" as "done" | "idle" | "sending" | Failure,

  /** Whether the page is waiting for the Visitor or the server. */
  waiting() {
    return this.state === "idle" || this.state === "sending"
  },

  /** Whether the request is in flight, to disable the button. */
  sending() {
    return this.state === "sending"
  },

  /** Whether the button can still be pressed, to show its label. */
  ready() {
    return this.state !== "sending"
  },

  /**
   * Whether a given outcome is the one to show.
   *
   * @param state - The outcome a block of the page belongs to.
   * @returns Whether it is the current one.
   */
  is(state: string) {
    return this.state === state
  },

  /** Whether the link itself was the problem: expired, used or cut short. */
  linkFailed() {
    return this.state === "expired" || this.state === "invalid"
  },

  /**
   * Sends the parameters the email link carried to the page's endpoint.
   */
  async submit() {
    if (this.state === "sending") return

    const endpoint = this.$refs.action?.dataset.endpoint ?? ""
    const params = Object.fromEntries(new URLSearchParams(location.search))
    this.state = "sending"

    try {
      const response = await fetch(endpoint, {
        body: JSON.stringify({ ...params, page: location.pathname }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
      if (response.ok) {
        this.state = "done"
        return
      }

      const { error } = (await response.json()) as { error?: Failure }
      this.state =
        error === "expired" || error === "invalid" ? error : "generic"
    } catch {
      this.state = "generic"
    }
  },
}))
