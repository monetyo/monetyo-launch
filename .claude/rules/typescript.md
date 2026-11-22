---
paths:
  - "src/**/*.ts"
  - "api/**/*.ts"
  - "middleware.ts"
---

# TypeScript conventions

## Errors

A function that can fail throws a plain `Error` whose message names the exact fix, not just what went wrong.
Verified pattern, from `src/libs/content.ts`:

```ts
throw new Error(
  `No settings entry for the locale \`${resolved}\`. Add src/content/settings/${resolved}.yaml.`
)
```

A missing secret in a Vercel Function is read through `secret(name)` (`src/libs/http.ts`), which throws naming the
variable to set.

## Imports in `api/` and `middleware.ts`

Both are compiled file by file by Vercel, not by Vite, so they import from `src/` with a relative path and a `.js`
extension (`../src/libs/storage.js`), never the `@/` alias. Modules under `src/libs/` that these import follow the
same rule among themselves (`./http.js`).
