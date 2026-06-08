# Simplify Reply Theme Colors

## Goal

Make semantic HTML reply styling cleaner by removing broad colored fills from
visual components while preserving theme-specific identity through vivid borders
and accents.

## Requirements

- Keep broad `.reply` component surfaces neutral and theme-adaptive through
  `--card`, `--muted`, `--background`, and related base tokens.
- Use active theme `--primary` and `--chart-*` colors primarily for borders,
  left rails, tag outlines, timeline markers, and functional progress values.
- Avoid colored card, table, dialog, details, badge, and checklist fills that
  make every theme look heavy or visually noisy.
- Preserve dark-mode contrast and historical message compatibility without
  rewriting stored message content.
- Do not change the semantic HTML prompt contract or sanitizer allowlist in this
  task.

## Acceptance Criteria

- `.card`, `.pros`, `.cons`, `.note`, `.warn`, `.tip`, `.tldr`, `.formula`,
  `blockquote`, `details`, tables, terminal/filetree blocks, dialog bubbles,
  badges, tags, checklist markers, and timeline markers no longer use broad
  theme-colored fills.
- Variant borders and left rails remain vivid and derived from the active theme
  palette.
- Progress bars keep a neutral track and a theme-colored value fill.
- Frontend lint and production build complete successfully.
- The frontend component guideline documents the neutral-surface, colored-border
  rule for semantic HTML replies.
