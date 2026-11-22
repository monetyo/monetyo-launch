import type { CATEGORIES, TINTS } from "@/content.config"

type Category = (typeof CATEGORIES)[number]

type Tint = (typeof TINTS)[number]

/**
 * Written out in full rather than built from the key, so Tailwind finds each
 * class in the source and generates it.
 */
export const CATEGORY_BACKGROUNDS: Record<Category, string> = {
  eatingOut: "bg-category-eating-out",
  groceries: "bg-category-groceries",
  health: "bg-category-health",
  home: "bg-category-home",
  kids: "bg-category-kids",
  other: "bg-category-other",
  transport: "bg-category-transport",
}

/** The text colour each tint needs to stay readable on it. */
export const TINT_CLASSES: Record<Tint, string> = {
  blue: "bg-blue-500 text-white",
  blueSoft: "bg-blue-50 text-ink",
  coralSoft: "bg-coral-50 text-ink",
  greenSoft: "bg-green-50 text-ink",
  ink: "bg-ink text-white",
  lemonSoft: "bg-lemon-50 text-ink",
  peach: "bg-coral-100 text-ink",
  sand: "bg-sand-100 text-ink",
}
