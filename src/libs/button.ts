/**
 * The look every button on the site shares, whether it is a link or a real
 * button, so the two cannot drift apart.
 */
export const BUTTON_BASE =
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full whitespace-nowrap transition duration-300 ease-out-expo select-none active:scale-[0.98] disabled:pointer-events-none"

export const BUTTON_SIZES = {
  sm: "button-sm h-11 px-5",
  md: "button-md h-12 px-[1.375rem]",
} as const

export const BUTTON_VARIANTS = {
  primary: "bg-ink text-white hover:bg-sand-900",
  quiet: "text-foreground hover:bg-sand-150",
} as const

export type ButtonSize = keyof typeof BUTTON_SIZES
export type ButtonVariant = keyof typeof BUTTON_VARIANTS
