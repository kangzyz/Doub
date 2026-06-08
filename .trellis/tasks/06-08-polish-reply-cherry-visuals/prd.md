# Polish Reply Cherry-Style Visuals

## Goal

Improve semantic HTML reply rendering so it feels closer to the pasted Cherry
Studio "deep yan-yu" style while remaining native to DOUB's theme variable
system and preserving the existing semantic HTML contract.

## Requirements

- Do not strictly copy the pasted CSS selectors or hard-coded colors into DOUB.
  Map the same visual intent onto DOUB variables (`--card`, `--muted`,
  `--primary`, `--chart-*`, `--foreground`, `--border`).
- Improve visual hierarchy for `.reply` content:
  - headings should use theme semantic accent colors instead of plain foreground
  - `h2` should have a subtle divider
  - `h3` should read as a secondary accent
- Make card-like blocks feel more like the pasted style:
  - use a top semantic color rail for `.card-*`
  - use a left semantic rail for `.note`, `.warn`, `.tip`, `.pros`, `.cons`,
    and `.tldr`
  - keep fills light and neutral, not broad saturated color blocks
- Restore restrained low-opacity tint only where it clarifies role:
  `mark`, table headers, badges/tags, note/warn/tip/pros/cons, checklist dots,
  timeline dots, and right dialog bubbles.
- Preserve theme switching and historical messages by using CSS variables only.
- Do not change sanitizer allowlists, prompt behavior, artifact behavior, API
  behavior, ports, database, or backend services.

## Acceptance Criteria

- `.reply` headings, cards, badges, tables, notes, pros/cons, dialogs, and
  checklist/timeline markers have clearer hierarchy and more distinctive theme
  personality than the current neutral-border-only version.
- Colored surfaces remain low-opacity/supportive; no large saturated panels are
  introduced.
- Light and dark mode remain readable.
- The pasted semantic classes continue to render through the existing `.reply`
  contract.
- `pnpm lint`, `pnpm build`, and a browser style sampling pass succeed.

## Definition of Done

- Frontend CSS updated.
- Frontend component guideline updated if the visual convention changes.
- Quality checks pass.
- Work is committed, task archived, and session journal recorded.

## Technical Approach

Use a medium CSS polish pass on `frontend/app/globals.css`: add dedicated
reply tint variables, strengthen accent assignment for headings and semantic
variants, switch card variants from left rails to top rails, and restore subtle
role tints using `color-mix()` against neutral surfaces. Keep the implementation
theme-adaptive and avoid inline styles.

## Decision

**Context**: The previous neutral-border-only implementation satisfied the
"avoid broad fills" request, but looked too flat compared with the pasted
Cherry-style reference.

**Decision**: Implement a DOUB-native interpretation of the reference: stronger
typographic color, semantic rails, and low-opacity role tints, without copying
hard-coded Cherry colors.

**Consequences**: The UI will be more expressive and closer to the reference,
while still changing with DOUB themes. It will not be pixel-identical to the
pasted CSS.

## Out of Scope

- Adding new HTML classes or changing the model prompt.
- Replacing app-wide theme palettes.
- Preview/artifact behavior changes.
- Backend, database, Redis, or port changes.

## Technical Notes

- Reference CSS came from
  `C:\Users\Administrator\.codex\attachments\fe99db39-78b2-4e2e-b940-697a36f74890\pasted-text.txt`.
- Existing ownership:
  - `frontend/app/globals.css`
  - `.trellis/spec/frontend/component-guidelines.md`
