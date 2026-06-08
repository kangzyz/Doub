# HTML Theme Color Distinction

## Goal

Make semantic HTML replies (`.reply`, cards, tags, notes, pros/cons, stats, timelines, etc.) render with stronger per-theme color personality instead of sharing a nearly identical palette across theme presets.

## Requirements

- Increase visual distinction between theme presets for model-authored semantic HTML replies.
- Keep the existing semantic HTML contract unchanged: no new prompt classes and no stored message rewrites.
- Use theme-scoped CSS variables so historical HTML replies automatically restyle when switching preset or dark mode.
- Preserve light and dark mode readability and avoid hard-coded component-level colors inside message content.
- Keep the change focused on frontend theme/CSS behavior.

## Acceptance Criteria

- [x] Each existing theme preset has a distinct `.reply` color palette for surfaces, borders, accents, and semantic tones.
- [x] Cards, badges/tags, notes/tips/warnings, pros/cons, progress, and timelines visibly inherit the active theme personality.
- [x] Dark mode keeps enough contrast and does not collapse into the same colors as light mode.
- [x] No backend prompt/class contract changes are required.
- [x] Frontend lint/build checks pass.

## Definition of Done

- Scope stays limited to theme CSS/spec/task bookkeeping unless inspection reveals a required adjacent change.
- No new app port is introduced; local services remain on 3000/8080 if restarted.
- Trellis specs are updated if a reusable theme styling rule is established.
- Changes are committed before wrap-up.

## Technical Approach

Use per-theme overrides for the existing `--reply-*` variables in `frontend/app/globals.css`. This lets all existing `.reply` component rules pick up a richer palette without modifying rendered message HTML, sanitizer allowlists, or prompt instructions.

## Decision (ADR-lite)

**Context**: The current `.reply` styles already use variables, but the variables are mostly shared and conservative, so different presets render semantic HTML with similar cards and badges.

**Decision**: Keep semantic classes stable and make the theme preset own the reply palette through `--reply-surface`, `--reply-surface-muted`, `--reply-surface-strong`, `--reply-border`, `--reply-accent`, and the semantic tone variables.

**Consequences**: Theme switching immediately restyles old and new replies. The trade-off is a larger CSS variable matrix, but it keeps behavior centralized and avoids content migration.

## Out of Scope

- Adding new semantic HTML classes or changing the model prompt.
- Reworking theme picker UI.
- Rewriting persisted messages.
- Adding theme-specific JavaScript rendering logic.

## Technical Notes

- Primary target: `frontend/app/globals.css`.
- Relevant spec: `.trellis/spec/frontend/component-guidelines.md`, especially the Markdown rendering and theme-adaptive `.reply` sections.
