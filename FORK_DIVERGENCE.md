# Fork Divergence Notes

This repo (`origin` = `kangzyz/Doub`) intentionally diverges from upstream
(`upstream` = `DEEIX-AI/DEEIX-Chat`) in two areas. Keep this file in mind when
pulling upstream updates so the local customizations survive a merge.

Baseline divergence commit: `635498d` — *"feat: custom theme system + remove billing/subscription"*.

---

## 1. Custom theme system

The stock "warm clay" preset family was replaced with a custom, WCAG-AA
**8-theme identity system**, light + dark, plus a refined shared shape/texture
language. The 8 `data-theme` **keys are unchanged** (`default, azure, cobalt,
graphite, lagoon, ink, ochre, sepia`) — only their token values, radius, shadow,
and display labels changed, so stored user preferences keep working.

Identities: `default`=Warm Sand · `sepia`=Dusk · `ochre`=Vivid · `cobalt`=Midnight
· `lagoon`=Aurora · `azure`=Azure · `ink`=Ink · `graphite`=Graphite.

**Files that own the customization (expect merge conflicts here):**
- `frontend/app/globals.css` — all `:root` / `.dark` / `:root[data-theme=...]`
  token blocks, the shared shadow ramp, `@media (prefers-reduced-motion)`, and
  the token-driven `.brand-wordmark`.
- `frontend/features/settings/components/sections/settings-general.tsx` —
  `THEME_PREVIEW_PALETTES` + `THEME_PRESET_PREVIEWS` (hardcoded mirrors of the
  tokens; must stay in sync with `globals.css`).
- `frontend/shared/components/theme-provider.tsx` — `applyTheme()` FOUC fallback
  hex (`#191714`/`#e7e2da` dark, `#f9f5f0`/`#29241f` light).
- `frontend/i18n/messages/{zh-CN,en-US}/{settings,guide}.json` — `preset` /
  `themePreset` display labels.

**Merge guidance:** keep OUR token values, preview palettes, FOUC colors, and
labels. If upstream restructures the preview/theme machinery, re-apply our
palette values on top of the new structure. The generator that produced the
tokens lives (uncommitted, gitignored) at `.tmp/themegen/` if a regen is needed.

---

## 2. Billing / subscription / usage removed

The entire billing/subscription/pricing/usage feature was removed (frontend +
backend). The app is free-to-use, not monetized. The chat send/stream flow is
intact — only the billing access-check, balance reservation, and usage
accounting were stripped.

**Backend — deleted packages/files:** `internal/domain/billing/`,
`internal/application/billing/`, `internal/infra/persistence/postgres/billing/`,
`internal/transport/http/billing/`, `internal/repository/billing.go`,
`internal/infra/persistence/models/billing.go`,
`internal/application/conversation/service_billing.go`.
**Backend — surgically edited:** `internal/app/app.go`,
`internal/transport/http/server.go`, `application/auth/service.go`,
`application/channel/{service,service_model,dto}.go`,
`application/conversation/{service,service_generation_support,service_message_send,...}.go`,
`transport/http/conversation/{handler_message_send,handler_media,dto_response}.go`,
`application/admin/{service,dto}.go` + `transport/http/admin/{handler,dto,router}.go`,
`application/user/service.go` + `application/userview/view.go` +
`repository/user.go` + `infra/persistence/postgres/user/repository.go`,
`infra/persistence/postgres/postgres.go` (billing model registration/seed/index removed).

**Frontend — deleted:** `app/(project)/setting/subscription/`,
`app/(admin)/admin/billing/`, `shared/api/billing*`, `shared/lib/billing-display.ts`,
`features/admin/api/billing*`, `features/admin/components/sections/billing/`,
`features/admin/model/billing-page.ts`,
`features/settings/components/sections/settings-subscription.tsx`,
`i18n/messages/*/admin-billing.json`.
**Frontend — surgically edited:** nav-user (upgrade-plan), settings sidebar +
types, admin sidebar/sections, chat model picker + message-meta (price/cost UI),
`shared/api/{auth,model,conversation}.types.ts` (billing fields), and billing
i18n keys across settings/common/guide/errors/chat json.

**Residuals scrubbed (second pass):** the billing settings namespace
(`settings/seed.go`, `service.go`, `sensitive.go`), the billing/payment error
codes (`shared/response/error_code.go`), the dead user-creation subscription
params (`repository/user.go`, `repository/auth.go`, auth registration/provider),
the `chat.show_billing_cost` user setting, and the per-message billing columns on
the GORM/domain models (`UpdateMessageBilling`, `BilledCurrency`/`BilledNanousd`/
`PricingSnapshot`) were all removed.

**Database:** GORM auto-migrate never DROPs, so dormant, unused columns remain on
`chat_messages` (`billed_currency`, `billed_nanousd`, `pricing_snapshot`) plus the
old billing tables. Run **`backend/drop_billing.sql`** (optional, destructive) for
a fully clean schema.

**Docs-only residue (harmless):** generated `backend/docs/` (swagger) still lists
old billing endpoints (not regenerated — `swag` is not installed) and `README*`
still describe billing features. These are documentation only; regenerate swagger
via `make -C backend swagger` and trim the README prose when convenient.

**Merge guidance:** any upstream billing changes are moot here — do NOT re-add
billing files or fields. Expect conflicts in `app.go`, `server.go`, the
conversation send/stream handlers, admin user DTOs, user creation, and
`postgres.go`. Resolution rule: take upstream's *non-billing* changes, drop the
billing accounting. After any upstream merge, run the verification below.

---

## 3. Upstream features synced in

Selected NON-billing upstream features have been merged into this fork (so the
divergence is smaller than the raw commit gap): Release Note skill, HTML-visual
system-prompt guidance + CSS sanitizer (our richer inline-HTML renderer kept),
Anthropic tool-trace fix, artifact preview, system-prompt refactor, conversation
file-cleanup on delete, model connectivity test, MCP tool grouping/search, KaTeX
math rendering, and Turnstile registration. Upstream **billing** commits were
deliberately skipped — keep skipping them on future merges.

---

## After pulling upstream — verification

```bash
# backend
go -C backend build ./...
go -C backend vet ./...
# frontend
pnpm --dir frontend lint
pnpm --dir frontend build
```

If the build surfaces re-introduced billing references (deleted imports/symbols),
that's an upstream billing change that slipped through the merge — remove it.
