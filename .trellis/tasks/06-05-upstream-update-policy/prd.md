# Integrate Upstream Updates With Local Policy

## Goal

Update local `main` to the current `origin/main`, then selectively integrate useful upstream non-billing improvements while preserving this fork's intentional DOUB customizations.

## Requirements

- Fast-forward local `main` to `origin/main` before any upstream integration.
- Compare current `upstream/main` and `upstream/dev` updates against local `main`.
- Prefer local behavior when upstream and local implement the same feature at roughly the same quality.
- Merge or port upstream behavior only when it is clearly an improvement over local behavior.
- Do not reintroduce billing, subscription, pricing, usage accounting, billing DTO fields, billing routes, billing repositories, billing UI, or billing i18n.
- Preserve local DOUB branding, icons, favicon, Android release metadata, landing-site assets, and theme/style system.
- Preserve local icon/style choices unless upstream style is part of a separate new feature being adopted.
- Follow prior fork divergence guidance in `FORK_DIVERGENCE.md` and the Session 6 merge notes.
- Keep the integration scoped; avoid a raw `git merge upstream/main` if it would reintroduce broad conflicts or deleted billing/branding files.

## Acceptance Criteria

- [x] `main` is up to date with `origin/main`.
- [x] Selected upstream updates are either merged, cherry-picked, or manually ported with billing excluded.
- [x] No deleted billing packages/files are restored.
- [x] No local DOUB branding/icon/theme customization is overwritten by upstream branding.
- [x] Any adopted upstream feature has matching frontend/backend/i18n contracts where applicable.
- [x] Verification commands are run or failures are documented.

## Definition of Done

- Review dirty changes before finalizing.
- Run relevant backend and frontend verification for touched areas.
- Update fork notes if a new long-term divergence or merge rule is discovered.
- Leave the worktree in a clear state with no accidental upstream billing or branding regressions.

## Technical Approach

Use `origin/main` as the baseline update. For upstream, inspect the new commit ranges and avoid full-branch merge because prior preflight showed hundreds of conflicts. Group upstream changes by feature area, then port only high-value non-billing improvements. For conflicts, apply the user's priority rules: local first for equivalent behavior, upstream only for clear optimization, billing never.

## Decision (ADR-lite)

**Context**: This fork intentionally removed billing/subscription and customized branding, Android shell, site assets, and theme tokens. Upstream continues to evolve those same areas.

**Decision**: Use selective integration instead of raw upstream merge. Keep local divergence in billing, branding, icons, and theme. Evaluate upstream feature groups manually.

**Consequences**: This avoids reintroducing deleted billing/branding code but requires manual review of upstream improvements and targeted verification.

## Out of Scope

- Full `upstream/main` or `upstream/dev` merge.
- Restoring any billing/subscription/usage functionality.
- Replacing DOUB branding, favicon, Android icon assets, or theme palette with upstream DEEIX assets.
- Adopting upstream documentation or release metadata that contradicts this fork.

## Technical Notes

- `origin/main` update commit: `85d7210 chore(android): publish DOUB 4.3.1 APK metadata`.
- `FORK_DIVERGENCE.md` records the existing merge policy for custom theme and billing removal.
- Prior Session 6 merged selected non-billing upstream features and deliberately skipped billing.
- Initial upstream preflight found `upstream/main` is not fast-forwardable and has broad conflicts across backend, frontend, admin, chat, billing, and i18n.
- Adopted from upstream:
  - `c54808f` navigation/sidebar/recent/settings/admin `Link` prefetch suppression, ported without local UI style changes.
  - `f1c50f0` + `711d665` JSON editor external-value synchronization and refill fix, ported to the local Monaco component.
  - `d9ec9bb` media image edit input normalization and filename extension correction, ported to the local backend module path with tests.
  - `4869443` logo carousel source-image preloading, ported without changing icon styling.
  - `168ccf6` KaTeX formula-structure fixes, partially ported: keep local richer Markdown/HTML visual renderer, but isolate `.katex` from prose font/wrapping rules and allow KaTeX span `top` offsets through the local sanitizer.
- Skipped for this pass:
  - Billing/subscription/payment/redemption/admin billing updates.
  - Upstream branding, favicon, logo, Android, README, and version metadata changes.
  - Wholesale upstream KaTeX/Markdown renderer replacement, because it would drop local citation chips, currency-dollar protection, richer HTML visual normalization, and custom theme behavior.
  - LobeHub icon sprite/cache changes, because they alter the icon loading/rendering path and should be reviewed as a dedicated icon performance task if needed.
