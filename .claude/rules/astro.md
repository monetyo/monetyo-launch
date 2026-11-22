---
paths:
  - "src/**/*.astro"
---

# Astro

## Components

Props configure. Slots render. A prop carries a variant, an attribute, a small piece of config (`href`, `size`,
`variant`, `class`, `id`...), or a section's slice of its page's content entry (see below). Markup always arrives
through a slot. No component accepts markup or children through a prop.

### Slots

- A component with more than one distinct content region names each slot (`header`, `body`, `footer`,
  `socialLinks`...). A component that wraps exactly one thing uses the default slot.
- A required slot is checked in the frontmatter and throws if missing. The message names the component in angle
  brackets. Verified pattern, from `src/components/common/ButtonLink.astro`:

  ```ts
  if (!Astro.slots.has("default")) {
    throw new Error("<ButtonLink> requires a label.")
  }
  ```

  For a named slot, name it in backticks (`` `<Card> requires a \`heading\` slot.` ``). When several slots share the
  same shape, loop instead of repeating the check.

- An optional slot is guarded with `Astro.slots.has()`, with the wrapper markup inside the guard, so an unfilled
  slot leaves nothing in the DOM.
- `Astro.slots.render()` reads a slot's rendered HTML to decide whether to show it (trims to check for
  whitespace-only content) or to reuse it elsewhere in the same file. A slot is otherwise only ever passed straight
  through as `<slot name="x" />`.

### Calling a composed component

- A child component placed into a parent's slot carries `slot="name"` on itself.
- A plain value goes in `<Fragment slot="name">`; prose containing inline markup uses `set:html`.
- Mapping an array into a slot puts `slot="name"` on each item; several items can share one slot name.

### `common/`, `legal/` and `sections/`

- `src/components/common/` holds small, generic primitives (`Button`, `ButtonLink`, `Bar`, `TextWithTerms`...).
  Those that wrap an element extend `HTMLAttributes<T>` from `astro/types`, spread `...rest` to forward standard
  HTML attributes, and take a `class` prop merged with `cn()` (`@/libs/utils`) so a caller's classes win over the
  component's own.
- `src/components/legal/LegalPage.astro` renders every legal page from the shared legal schema.
- `src/components/sections/` holds one folder per page section. The folder's root file (e.g. `Hero.astro`) is the
  section itself; each part lives in its own file in the same folder (`HeroApp.astro`, `LanguageSwitch.astro`,
  `Portrait.astro`). A new part file is prefixed with its section's name where that reads naturally. A home page
  section takes its slice of the page entry as one typed prop named after it, such as
  `faq: CollectionEntry<"home">["data"]["faq"]`, passed down from `index.astro`; otherwise its props are small config
  values or a `class` override.

### Naming

- Slot names are camelCase (`socialLinks`, not `social-links`).
- `.astro` component files are PascalCase; files under `src/pages/` stay lowercase, because they are URLs.
- No barrel files: import each component directly, never through an `index.ts`.

### No framework islands

This project has no React, or any other UI framework, and no `client:*` directive anywhere. All interactivity is
either Alpine (`@alpinejs/csp`, wired through `register()` in `src/scripts/alpine.ts`) or a plain script in
`src/scripts/`, imported from the component's own `<script>` tag, unless native HTML and CSS already do it with no
script at all: the FAQ is an exclusive accordion of `<details name="faq">`, and `TextWithTerms.astro`'s tooltips
open on hover and focus in CSS. Structure and composition stay in `.astro`.

## Icons

Icons are never their own `.astro` component. They come from `astro-icon`'s `<Icon name="pack:name" />`
(`astro-icon/components`):

- `ph:<name>` for Phosphor icons (Iconify set `@iconify-json/ph`).
- `local:<name>` for a hand-authored SVG in `src/icons/`.

## Content

Copy comes from the YAML content collections, never a hardcoded string. A component that needs a value shared
across the site reads it through `getSettings(Astro.currentLocale)` (`@/libs/content`), rather than having it
threaded down through props. Internal links go through `localizeHref(href, Astro.currentLocale)` (`@/libs/i18n`).
