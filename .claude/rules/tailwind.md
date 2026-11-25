---
paths:
  - "src/**/*.astro"
  - "src/libs/button.ts"
  - "src/libs/palette.ts"
  - "src/styles/**/*.css"
---

# Tailwind CSS

## Type

Text styles are named `@utility` classes from `@monetyo/brand` (imported by `global.css`), not size utilities:
`display-1`, `display-2`, `heading-2` through `heading-6`, `eyebrow`, `lead`, `lead-hero`, `quote`, `body-2` through
`body-6`, `button-md`, `button-sm`. Each one sets size, line height, weight and tracking together, and scales with the
viewport. Use one of them before reaching for `text-*`/`leading-*`/`tracking-*` by hand. A new text style every Monetyo
site would use belongs in `@monetyo/brand`; one only this site needs, like `rich-text` and `prose-legal`, goes in
`_typography.css`.

## Values

Before writing an arbitrary value (`w-[16px]`), check for an existing token instead, in this order:

1. This project's own `@theme` extensions: the containers in `_layout.css` (`max-w-page`, `max-w-band`,
   `max-w-measure`), its vertical rhythm (`pt-section`, `mt-intro`...), the easing and animations in
   `_animations.css` (`animate-enter`...), and the brand palette and `ease-out-expo` from `@monetyo/brand`.
2. Tailwind's own built-in scale.

An arbitrary value is for something with no scale equivalent at all, such as a fluid `clamp()` gutter or an offset
measured against another element, not a substitute for a scale step that already exists under a different name.

## Colors

`@monetyo/brand` resets Tailwind's palette (`--color-*: initial`) and defines the brand's, so only Monetyo's colors
exist; `_colors.css` adds only the spending category colors of the app mock-ups. Never add a brand color here: it
belongs in `@monetyo/brand`. Prefer the semantic role aliases: `background`, `foreground`, `surface`, `muted`,
`muted-foreground`, `border`, `accent`, `accent-soft`, `danger`, `danger-soft`. Reach for a brand scale step (`sand-*`,
`blue-*`, `coral-*`, `green-*`, `lemon-*`, `ink`, `white`) only where a fixed brand color is the point, such as a
colored band or an app mock-up, never a literal hex value in a component. Category and tint colors are looked up through
`CATEGORY_BACKGROUNDS` and `TINT_CLASSES` (`src/libs/palette.ts`), written out in full so Tailwind finds each class in
the source. There is no dark mode.

## Custom utilities

A pattern repeated across components becomes a named `@utility` in the relevant `src/styles/_*.css` partial
(`container-page`, `section`, `band`, `reveal`, `appear`, `draw`...) rather than the same class chain copied into
every caller. Shared button styles live in `src/libs/button.ts`, used by both `Button` and `ButtonLink`.

## Conditional classes

- `class:list` for a component's own internal conditional classes, when there is no caller-supplied `class` to
  merge.
- `cn()` (`@/libs/utils`, clsx + tailwind-merge) when the component takes a `class` prop and a caller's classes
  need to win over its own.

## CSP

The Content-Security-Policy blocks `style` attributes, so no inline `style="..."` and no `style={...}`, however
small; `bun run check:csp` fails the build over one. A value only known at render time, such as a bar's length, goes
in an SVG attribute instead (see `Bar.astro`) or picks one of a fixed set of classes.

## Config

There is no `tailwind.config.*`; everything is configured in CSS through `@theme` blocks in `src/styles/*.css`,
assembled by `global.css`. Class order is not worth hand-sorting: `prettier-plugin-tailwindcss` does it on save.
