import { register } from "@/scripts/alpine"

/** Every note at full strength, nothing filtered. */
const ALL = "all"

register("ideaBoard", () => ({
  active: ALL,

  /**
   * Picks a theme, or goes back to every note when the theme already picked
   * is chosen again.
   *
   * @param group - The theme to bring forward.
   */
  select(group: string) {
    this.active = this.active === group ? ALL : group

    // On a phone the notes are a row to swipe, so the theme's first note may
    // be off to the side; wider screens show every note and never scroll.
    this.$nextTick(() => {
      const row = this.$refs.notes
      if (!row || row.scrollWidth <= row.clientWidth) return

      const first =
        row.querySelector<HTMLElement>("[data-lit]") ?? row.firstElementChild
      if (!(first instanceof HTMLElement)) return

      const still = matchMedia("(prefers-reduced-motion: reduce)").matches
      row.scrollTo({
        behavior: still ? "auto" : "smooth",
        left: first.offsetLeft - row.offsetLeft - 20,
      })
    })
  },

  /**
   * Tells whether a chip is the one picked, for its `aria-pressed`.
   *
   * @param group - The chip's theme.
   * @returns Whether it is picked.
   */
  pressed(group: string) {
    return this.active === group
  },

  /**
   * Marks a note that belongs to the picked theme, so it straightens and
   * comes forward.
   *
   * @param group - The note's theme.
   * @returns `true` to set the attribute, `null` to remove it.
   */
  lit(group: string) {
    return this.active !== ALL && this.active === group ? true : null
  },

  /**
   * Marks a note outside the picked theme, so it fades back.
   *
   * @param group - The note's theme.
   * @returns `true` to set the attribute, `null` to remove it.
   */
  dim(group: string) {
    return this.active !== ALL && this.active !== group ? true : null
  },
}))
