# AGENTS

## Discussion-First Policy

- When the user asks an open question (e.g., "как сделать...", "может...", "что если..."), do NOT start implementing. First discuss options, then wait for explicit confirmation ("делай", "давай", "ok") before executing.

## Commit Policy

- NEVER commit unless the user explicitly says "коммит" or "commit". Ask first.

## Styling Preferences

- If this project uses Tailwind CSS, prefer Tailwind utility classes for basic styling changes.
- Do not suggest plain CSS or scoped CSS solutions for routine typography, spacing, sizing, layout, or color adjustments when the same result can be expressed cleanly with Tailwind classes.
- Only suggest CSS rules when Tailwind is not sufficient, when the user explicitly asks for CSS, or when the change requires selectors/pseudo-elements/custom animations that are not reasonable to express with utilities alone.
