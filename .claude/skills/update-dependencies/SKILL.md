---
name: update-dependencies
description: >-
  Updates this repo's Bun dependencies, one per commit, working through them in a fixed order: production
  before development, and within each group, a foundational package before what depends on it.
when_to_use: >-
  Use when asked to update dependencies, upgrade packages, or run a dependency update pass. Only reachable via
  the /update-dependencies slash command; never invoke this on your own.
disable-model-invocation: true
context: fork
model: sonnet
---

# Updating dependencies

Updates dependencies one at a time, each in its own commit. Never batch multiple dependency updates into a
single commit.

This project runs every `bun` command through Docker, never on the host: `docker compose exec -T app ...`, run
from the checkout's own root (see `.claude/guidelines/dev-env.md`). If the container isn't running, these
commands fail outright; start it with `rift up` rather than falling back to the host.

## Preflight (mandatory)

Before updating anything, confirm the starting point is green. A dependency update is only meaningful if a
failure afterwards can be attributed to it.

```bash
git status --short
docker compose exec -T app bunx prettier --check src tests
docker compose exec -T app sh -c "bun run lint && bun run check:type && bun run test && bun run build"
```

- `git status --short` must be empty. If the working tree is dirty, stop and report; never mix an update with
  unrelated changes.
- If any check already fails, stop and report which one. Do not begin the update pass, and do not "fix" the
  pre-existing failure as part of it; that is a separate task with its own commit.

## Branch

Once preflight is green, create and switch to a dated branch:

```bash
git checkout -b "update/$(date +%F)"
```

`date +%F` gives `YYYY-MM-DD`, e.g. `update/2026-08-14`. If that branch already exists, an update pass already
ran today; check it out instead of creating a new one (`git checkout "update/$(date +%F)"`) and continue the
queue from there rather than starting over.

## Update order (mandatory)

Before updating anything, build an ordered queue of the outdated packages:

1. **Production before development.** Every package in `dependencies` is fully updated before any package in
   `devDependencies`.
2. **General before specific.** Within each group, a foundational package is updated before the packages that
   extend, configure, or plug into it.

Ecosystem groups in this project, in the order they must be updated:

| First             | Then                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| `astro`           | `@astrojs/check`                                                                                        |
| `astro-icon`      | `@iconify-json/ph`                                                                                      |
| `tailwindcss`     | `@tailwindcss/vite`                                                                                     |
| `typescript`      | `typescript-eslint`                                                                                     |
| `eslint`          | `@eslint/js`, `eslint-plugin-astro`, `eslint-plugin-jsx-a11y`, `eslint-plugin-perfectionist`, `globals` |
| `prettier`        | `prettier-plugin-astro`, `prettier-plugin-tailwindcss`                                                  |
| `vitest`          | `@vitest/coverage-v8`                                                                                   |
| `@commitlint/cli` | `@commitlint/config-conventional`                                                                       |
| `husky`           | `lint-staged`                                                                                           |

`astro` and `@astrojs/check` sit in different groups (production and development); the production-first rule
already puts `astro` ahead.

Everything else (`@fontsource-variable/host-grotesk`, `@neondatabase/serverless`, `@vercel/functions`, `yaml`, `@types/node`, `clsx`, `tailwind-merge`) has no dependent in this list; update it in
its normal production/development position, in whatever order `bun outdated` lists it.

### Packages that need extra care

- `@alpinejs/csp` is patched: `patchedDependencies` in `package.json` maps `@alpinejs/csp@{version}` to a patch
  file in `patches/` named after that exact version. A new version won't pick the patch up. Don't update it in this
  pass: report it as deferred, with the reason that the patch has to be checked and regenerated for the new version
  as its own task.
- `vitest` and `@vitest/coverage-v8` are pinned to an exact version and must stay on the same one. Update them
  together, with both names in one command
  (`docker compose exec -T app bun update vitest @vitest/coverage-v8 --latest`), in one commit
  (`build: update dependency vitest to {version}`, naming both in the body). Afterwards, check that `package.json`
  still pins both to the same exact version (no `^`); restore the pins by hand if Bun widened them.
- `typescript` is held at `~6`. A bump to a new major is a breaking change: check it as in step 2 below.

## The update pass

1. List outdated dependencies:

   ```bash
   docker compose exec -T app bun outdated
   ```

   Split the results into `dependencies` and `devDependencies` by reading `package.json`, then sort each group
   with the rules above. That ordered list is the queue.

2. For each package in the queue, one at a time:

   ```bash
   docker compose exec -T app bun update {package} --latest
   ```

   `--latest` resolves to the true latest version, ignoring the existing semver range, so it can cross a major
   boundary.

   Before crossing a major on `astro`, `tailwindcss`, `eslint`, `typescript`, `vitest`, or
   `@neondatabase/serverless`, check the package's own changelog or release notes for breaking changes (fetch it,
   or search for it). A major bump that needs code changes here is not a dependency update: stop and report it so it
   can be planned as its own task.

3. Verify, in this order:

   ```bash
   docker compose exec -T app bun run format
   docker compose exec -T app sh -c "bun run lint && bun run check:type && bun run test && bun run build"
   ```

   - `bun run format` may rewrite files. That's expected, and those changes belong in this dependency's commit.
   - If any check fails, stop. Do not commit, and do not continue to the next package. Report the failing
     package and the output. Never work around a failure by loosening a type, disabling a rule, or pinning back
     silently.

4. Stage only what this dependency touched:

   ```bash
   git add package.json bun.lock
   ```

   If step 3 reformatted tracked files, stage them into this same commit too. Then hand off to the `git-commit`
   skill to write and make the commit; it already knows this repo's dependency-commit shape
   (`build: update dependency {name} to {version}`, resolved version from `package.json`/`bun.lock`, never the
   semver range). Never push.

5. Move to the next package and repeat steps 2 to 4.

## Transitive security fixes

Once the queue is done, audit the whole lockfile. `bun update` only moves direct dependencies, and a
transitive package keeps its locked version for as long as it still satisfies its parent's range, so updating
`astro` does not move a vulnerable `undici` underneath it.

```bash
docker compose exec -T app bun audit fix --dry-run
```

If it lists packages under `fixing:`, apply them and verify exactly as in step 3:

```bash
docker compose exec -T app bun audit fix
```

Then stage `bun.lock` and hand off to `git-commit` with the subject
`build: update vulnerable transitive dependencies`, and a body listing each package as
`{name} {old version} → {new version}`, read from the `bun.lock` diff.

This is the one exception to one dependency per commit, along with the `vitest` pair: Bun resolves these fixes
together, and splitting them would mean assembling lockfiles by hand that Bun never wrote.

Packages it lists under `blocked by a dependent's range` cannot be fixed here; they wait for the dependent to
widen its range. Never force them with an override or `--latest`.

Finally, run `docker compose exec -T app bun run check:audit` and include anything it still reports at high
severity or above in the summary.

## Boundaries

- If `bun update --latest` reports no change for a package, skip it. Never create an empty commit.
- Adding a dependency that isn't installed yet is a different task (`build: add dependency {name} {version}`),
  not this one.
- Do not squash, reorder, or amend a prior dependency commit; each stays an isolated, individually revertible
  unit (`.claude/guidelines/git.md`).
- Never push at the end of a pass. Pushing needs explicit confirmation.

## When finished

Report a summary: which packages were updated, which were skipped and why, which were deferred (breaking majors,
and `@alpinejs/csp` while it is patched), which transitive packages were fixed, and which advisories remain because
a dependent's range blocks them.

`open-pr` builds the `## Deferred` section of its PR body from this summary and has no other source for it
(nothing was committed for a deferred package), and only within the same session. So for each deferred package,
the summary must name the package, its old and new version numbers (the resolved versions, never the semver
range), and a one-line reason it was deferred.
