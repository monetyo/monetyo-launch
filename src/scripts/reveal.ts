/**
 * Marks each `data-reveal` element `data-revealed` the first time it scrolls
 * into view, which starts its entrance in CSS (see `styles/_animations`).
 *
 * It only happens once: scrolling back up doesn't hide anything again, so the
 * page never moves for the sake of moving.
 */
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue

      entry.target.setAttribute("data-revealed", "")
      observer.unobserve(entry.target)
    }
  },
  // A little past the bottom edge, so things settle while they're in view
  // rather than finishing just below it.
  { rootMargin: "0px 0px -12% 0px" }
)

for (const element of document.querySelectorAll("[data-reveal]")) {
  observer.observe(element)
}
