# Align Reply Prompt And Cherry CSS

## Goal

Make the HTML visual prompt and `.reply` CSS match the user's provided format
and Cherry-style semantic class styling more strictly.

## Requirements

- Replace `htmlVisualPromptInstruction` with the user's provided `<format
  lang="zh-CN">...</format>` content, without the additional DOUB-specific
  wording that currently changes the prompt semantics.
- Keep the existing system-prompt injection mechanism unchanged.
- Update tests to assert the prompt is now aligned with the provided format,
  not the prior expanded prompt.
- Restyle `.reply` to follow the pasted Cherry CSS structure more closely:
  - use `--llm-card`, `--llm-sunken`, `--llm-fg`, `--llm-muted`,
    `--llm-border`, and `--llm-c-*` semantic variables
  - match core selector shapes and metrics for headings, mark, kbd, table,
    dl, details, row/grid, card, badge, and note/warn/tip
  - keep extended approved classes (`pros`, `cons`, `stats`, `timeline`,
    `terminal`, `dialog`, `progress`, etc.) visually consistent with the same
    Cherry semantic variables
- Preserve theme switching by assigning `--llm-*` from DOUB theme tokens rather
  than hard-coding one global palette into every theme.
- Do not change sanitizer allowlists, artifact behavior, backend service
  contracts, ports, database, or Redis.

## Acceptance Criteria

- Current prompt is no longer the previous expanded DOUB prompt; it contains the
  user's exact high-level sections and decision flow.
- `.reply` CSS visibly follows the pasted Cherry style: compact headings,
  `h2` divider, top-rail cards, simple badges, compact tables, and
  left-rail callouts.
- Historical semantic HTML messages still render through the same approved
  classes.
- `go test ./internal/application/conversation`, `pnpm lint`, `pnpm build`, and
  browser style sampling pass.

## Definition of Done

- Backend prompt and tests updated.
- Frontend global CSS updated.
- Frontend component guideline updated if the styling contract changes.
- Quality checks pass.
- Work committed, task archived, and session journal recorded.

## Out of Scope

- Adding new semantic classes.
- Changing HTML sanitizer or source/citation behavior.
- Changing artifact preview behavior.
- Changing theme presets beyond the `.reply` semantic variable bridge.
