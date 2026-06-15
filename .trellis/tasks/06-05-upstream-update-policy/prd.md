# Integrate Upstream Updates With Local Policy

## Goal

Update local `main` to the current `origin/main`, then selectively integrate useful upstream non-billing improvements while preserving this fork's intentional DOUB customizations.

## Requirements

- Fast-forward local `main` to `origin/main` before any upstream integration.
- Compare current `upstream/main` and `upstream/dev` updates against local `main`.
- Prefer local behavior when upstream and local implement the same feature at roughly the same quality.
- Merge or port upstream behavior only when it is clearly an improvement over local behavior.
- Do not reintroduce billing, subscription, pricing, usage accounting, billing DTO fields, billing routes, billing repositories, billing UI, or billing i18n.
- Do not integrate upstream default MCP tools management.
- Do not integrate upstream PWA, service worker, app version guard, or version endpoint work.
- Do not integrate upstream SQLite / sqlite-vec support or SQLite-specific Docker/config/test changes.
- Partially integrate account/settings refactors only for the account security improvements; leave subscription and billing-related settings out.
- Partially integrate file/storage quota work only for the file selection improvements; leave storage quota/product limit behavior out unless it is required by the file selection UX.
- Integrate remaining upstream user-visible or correctness features after comparing them against the local implementation; when local behavior is equivalent, keep local code, and when upstream is a clear improvement, port it without overwriting DOUB-specific behavior.
- Preserve local DOUB branding, icons, favicon, Android release metadata, landing-site assets, and theme/style system.
- Preserve local icon/style choices unless upstream style is part of a separate new feature being adopted.
- Follow prior fork divergence guidance in `FORK_DIVERGENCE.md` and the Session 6 merge notes.
- Keep the integration scoped; avoid a raw `git merge upstream/main` if it would reintroduce broad conflicts or deleted billing/branding files.

## Acceptance Criteria

- [x] `main` is up to date with `origin/main`.
- [x] Required upstream updates are either merged, cherry-picked, or manually ported with excluded areas removed.
- [x] No deleted billing packages/files are restored.
- [x] No default MCP tools management, PWA/service-worker/version-guard, or SQLite support is restored.
- [x] Account/security and file-selection partial integrations are scoped to the approved subfeatures.
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
- Restoring redemption code, payment order, payment settings, billing audit, usage accounting, or subscription UI/API.
- Integrating default MCP tools management.
- Integrating upstream PWA, service worker registration, app version guard, version endpoint, or generated PWA assets.
- Integrating SQLite/sqlite-vec support, SQLite config examples, SQLite Docker changes, or SQLite-specific tests.
- Integrating storage quota management beyond file selection behavior.
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
  - `5e8d761` Chinese page-size copy fix for shared table pagination.
  - `927b42c` disabled spellcheck on upstream API key entry.
  - `728e865` prevented clipped model names in the chat model picker.
  - `38596d1` refreshed MCP server list after tool sync success or failure, adapted to the local admin settings path.
  - `406a932` accepted numeric enum tool arguments by normalizing JSON numbers before enum comparison, with a focused regression test.
  - `c5f94f6` counted distinct upstream models in upstream list statistics.
  - `18e92e0` + `610de1d` moved JSON editor hints to Monaco placeholder support and hid the overview ruler.
  - `56a94b9` prevented register/sign-in switch text clipping on the login page.
  - `98bdf3c` hid the project create action until hover/focus on desktop.
  - `bcc3736` restored pointer cursor behavior for enabled buttons.
  - `49e5439` hid the user email from the collapsed navigation trigger while keeping it available in the account dropdown.
  - `84dc57a`, `49b77c3`, `23cb6e3`, and `e9d902c` model ordering improvements: admin model order now targets available/routable models, default model listing groups available models by vendor order and `sort_order`, the model table explains unavailable rows, and the chat model picker groups by explicit vendor identity. Adapted without upstream billing/access-scope fields and without adding upstream SQLite test dependencies that are absent locally.
- Skipped for this pass:
  - Billing/subscription/payment/redemption/admin billing updates.
  - Default MCP tools management.
  - PWA/service worker/app version guard/version endpoint changes.
  - SQLite/sqlite-vec support and related config/Docker/test changes.
  - Upstream branding, favicon, logo, Android, README, and version metadata changes.
  - Wholesale upstream KaTeX/Markdown renderer replacement, because it would drop local citation chips, currency-dollar protection, richer HTML visual normalization, and custom theme behavior.
  - LobeHub icon sprite/cache changes, because they alter the icon loading/rendering path and should be reviewed as a dedicated icon performance task if needed.
- Newly approved integration scope:
  - Integrate remaining upstream features not listed as out of scope, including announcements, context compression, user-message collapse/expand, unified composer mentions, model catalog refresh/default option sync, conversation export, non-billing model capability improvements, non-PWA chat/layout/copy/security fixes, and selected account-security/file-selection improvements.
  - For account/settings refactors, port account security behavior only and avoid subscription/billing pages or i18n.
  - For file/storage changes, port file selection improvements only and avoid quota enforcement or quota UI unless required by the selection flow.
  - Before porting each feature group, compare upstream with local implementation and keep local behavior where it is equivalent or intentionally customized.
- Verification on 2026-06-12:
  - `go test ./...` passed in `backend`.
  - `go vet ./...` passed in `backend`.
  - `go build ./cmd/server` passed in `backend`; the generated local `server.exe` artifact was removed.
  - `pnpm lint` passed in `frontend`.
  - `pnpm build` passed in `frontend`.
  - `git diff --check` passed; output contained only line-ending warnings.
  - `make swagger` could not run because `make` is unavailable in this PowerShell environment. Equivalent generation was run with `node ../scripts/sync-version.mjs backend` and `swag init -g cmd/server/main.go -o docs --parseDependency --parseInternal`; it completed with only known upstream warnings about the root package name and a Go runtime const.
