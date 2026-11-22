---
paths:
  - "README.md"
  - "CONTRIBUTING.md"
  - "SECURITY.md"
---

# Human docs

`README.md`, `CONTRIBUTING.md` and `SECURITY.md` are for developers: someone reading the code, setting it up
locally, or reporting a problem. They are not the place for agent instructions or anything that belongs in
`CLAUDE.md` or `.claude/`; those serve a different reader, and the two sets of documents are meant to drift apart,
not mirror each other.

## What each covers

`README.md` is the big picture, in this order:

- `Features`: what the site does, plainly stated, for a reader who doesn't know it yet.
- `Tech stack`.
- `Running locally`: the Rift option only, slim.
- `Everyday commands`: the `rift` commands.
- `Security`: a summary of `SECURITY.md`, linking to it.
- A link to `CONTRIBUTING.md`, and the licence.

`CONTRIBUTING.md` holds everything someone working on the code needs, in this order: the other ways to run it
locally and the project scripts, the project structure, editing content, tests and coverage, code style, branches,
commits and pull requests (with the skills that handle them), git hooks, working in parallel, AI tooling (worktrees,
the agent used, the commit trailers, and the remaining skills), deploying and operating what runs on Vercel, and
reporting bugs.

`SECURITY.md` is the vulnerability policy: supported versions, how to report (by email to `privacy@monetyo.com`;
there is no `security@` address), and what's in scope. It matches what the site's own `/security/` page promises.

`README.md` never lists what `CONTRIBUTING.md` contains. Where a README topic has more detail there (running it
another way, working in parallel, tests, git hooks, AI tooling, operating the waitlist), it links to that section
inline, at the point the topic comes up. A detail only someone working on the code needs goes in
`CONTRIBUTING.md`, never back in `README.md`.

## Voice

Plain facts, the same standard as the site's own copy, written as "we": no invented colour, no marketing adjectives
("powerful", "seamless", "blazing fast"), no "why choose this project" framing, no badges other than CI status, no
emoji, no demo GIFs. This is a developer's reference, not a landing page; state what's true and let the reader
decide for themselves. Explain the why behind a constraint when it saves the reader from guessing, the same as
everywhere else in this project. Verified pattern, from `CONTRIBUTING.md`:

> Tests live outside `api/` because Vercel deploys every file in that directory as a function. Keeping test files
> there would create unwanted endpoints.

Never use an em dash or an en dash. Rewrite the sentence instead.

## Structure

- In `README.md`, CI status badges, one per workflow in `.github/workflows/`, sit above the first paragraph, their
  links as references at the end of the file. A new workflow gets its badge in the same change.
- No `#` title in `README.md`. GitHub renders the repository name as the page heading already; a duplicate
  first-level heading is dead weight. `CONTRIBUTING.md` and `SECURITY.md` have no such heading, so they open with
  `# Contributing` and `# Security policy`.
- Organize by what a reader is actually trying to do (`Running this site locally`, `Editing content`), not by
  feature list or category.
- A warning or a caveat worth a reader's attention becomes a GitHub admonition, `> [!CAUTION]` or `> [!NOTE]`,
  not bold text buried in a paragraph.
- A sequence a reader follows once, such as install, clone, run, is a numbered list. A reference a reader scans,
  such as which command does what, is a table.
- Every command, filename, and path is inline code, and copy-pasteable as written: a reader should never have to
  guess what to substitute. A multi-line example is a fenced code block with a language tag (`bash`, `yaml`); a
  directory layout is a fenced block with `text`.
- Every mention of a technology, tool, named pattern, or architecture (Astro, Docker, a git hook, a Content Security Policy)
  links to it: its official site for a technology or tool, a real reference (MDN, a language spec, a well-known
  write-up) for a pattern or architecture. A reader should never have to leave to search for what something is.
- The `Tech stack` list names each technology as it's actually known (`TypeScript`, not `typescript`), never a
  package identifier, and never a version number; that belongs in `CLAUDE.md`, not here. List only what a reader
  evaluating the project would recognize as the stack, not every dev-tooling dependency (a linter, a formatter,
  a git hook runner).

## What stays out

- No comment inside a code block explaining what the line above it already shows.
- No exhaustive option or config reference; that duplicates what the file itself already documents, such as a
  schema or a config file's own comments. Link to the file instead of restating it.
- Nothing that only matters to an AI agent working in this repo. That belongs in `CLAUDE.md` instead.
- No badge other than a CI status badge, no screenshot, no demo GIF, no acknowledgments section.
