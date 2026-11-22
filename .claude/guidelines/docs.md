# Docs

`README.md` is the big picture: the site's features, the tech stack, running it with Rift, everyday `rift` usage,
and security. `CONTRIBUTING.md` holds everything someone working on the code needs: the other ways to run it and
the project scripts, the project structure, editing content, tests and coverage, code style, branch, commit and pull
request conventions with their skills, git hooks, working in parallel, the AI tooling (agents, commit trailers and
skills), deploying and operating what runs on Vercel, and reporting bugs. The README links to a CONTRIBUTING section
inline wherever a topic has more detail there. `SECURITY.md` holds the vulnerability reporting policy and its scope.

Keep all three true to the current state of the repo in the same task that changes it, in two directions: update
them when a change makes something they already say inaccurate (a command, a setup step, a script's behavior, a
feature they describe, an endpoint in scope), and add to them when a change introduces something they should cover
but don't yet (a new feature, a new `api/` function, a new human-invocable skill, a new project-specific MCP server,
CI workflows, a new setup step, a new environment variable, a change to the tech stack or the project structure).
Silence is only correct when nothing in that list actually moved.
