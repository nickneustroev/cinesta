# AGENTS

## Discussion-First Policy

- When the user asks an open question (e.g., "как сделать...", "может...", "что если..."), do NOT start implementing. First discuss options, then wait for explicit confirmation ("делай", "давай", "ok") before executing.

## Commit Policy

- NEVER commit unprompted or ask if you should commit.
- Only commit when the user explicitly says "коммит" or "commit".

## Edit Rules

- When using the `edit` tool, always include 2-3 lines of surrounding context in both `oldString` and `newString` to guarantee a unique match and avoid "Found multiple matches" errors.

- If this project uses Tailwind CSS, prefer Tailwind utility classes for basic styling changes.
- Do not suggest plain CSS or scoped CSS solutions for routine typography, spacing, sizing, layout, or color adjustments when the same result can be expressed cleanly with Tailwind classes.
- Only suggest CSS rules when Tailwind is not sufficient, when the user explicitly asks for CSS, or when the change requires selectors/pseudo-elements/custom animations that are not reasonable to express with utilities alone.

## Lint Policy

- After completing any task, always run `pnpm lint` and fix any errors before committing.
- Do not explicitly report that `pnpm lint` was run unless the user asks about it or lint results are relevant to the outcome.
