import { register } from "@/scripts/alpine"

register("languageMenu", () => ({
  open: false,

  /**
   * Turns the caret upside down while the list is open.
   *
   * @returns The class to add, or none.
   */
  caret() {
    return this.open ? "rotate-180" : ""
  },

  /**
   * Closes the list once keyboard focus moves past it, so it doesn't stay
   * open over the page after the last language is tabbed through.
   *
   * @param event - The focus leaving an element inside the menu.
   */
  leave(event: FocusEvent) {
    const next = event.relatedTarget
    if (next instanceof Node && this.$el.contains(next)) return

    this.close()
  },

  /** Opens or closes the list of languages. */
  toggle() {
    this.open = !this.open
  },

  /**
   * Closes the list.
   *
   * @param refocus - Whether to put focus back on the button, as after
   *   Escape, so it doesn't fall to the page once the list is hidden.
   */
  close(refocus = false) {
    if (!this.open) return

    this.open = false
    if (refocus) this.$refs.button?.focus()
  },
}))
