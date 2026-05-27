# Rename product branding to DOUB Chat

## Goal

Rebrand product naming from DEEIX to DOUB across both user-visible surfaces and technical identifiers while preserving the existing UI style, layout, and runtime behavior. The primary display name should become `DOUB Chat`, hyphenated product references should become `DOUB-Chat`, and standalone brand references should become `DOUB`.

## What I Already Know

- The user wants to use Trellis planning and brainstorm before implementation.
- Existing visible product names include `DEEIX Chat`, `DEEIX-Chat`, and standalone `DEEIX`.
- Required replacement rules:
  - `DEEIX Chat` -> `DOUB Chat`
  - `DEEIX-Chat` -> `DOUB-Chat`
  - standalone visible `DEEIX` -> `DOUB`
- The user confirmed this is now a full technical identifier migration, not only a user-visible display-name change.
- Logo/image binary or vector assets are out of scope for this task. The user will replace same-name assets later.
- UI style must remain strictly consistent with the current product: do not redesign components, spacing, typography, colors, layout, or interaction behavior.
- Current logo rendering is centralized through `frontend/shared/components/app-logo.tsx`, which reads `/logo.svg` and `/logo-white.svg`.
- Frontend user-visible brand surfaces found so far include metadata, login, share page, sidebar fallback, about page, browser notifications, onboarding text, chat placeholder text, and image-generation loading watermark.
- Backend-generated user-visible brand surfaces found so far include default app name, build info, settings seed values, verification emails, 2FA issuer, OpenRouter attribution title/referer, and Swagger metadata.

## Assumptions

- Existing image/icon file contents remain unchanged; the user will replace same-name assets later.
- Technical identifiers should be migrated to DOUB naming, including storage keys, event names, package names, Docker resource names, database names, Go module path, import paths, build outputs, service names, tracing/logger names, default accounts/secrets, cache namespaces, and documentation examples.
- Replacement brand channels are available:
  - Website: `about.doub.chat`
  - Support email: `support@doub.chat`
  - Social account: `@doubingchat`
  - Repository: `https://github.com/kangzyz/Doub`

## Requirements

- Replace user-visible `DEEIX Chat` with `DOUB Chat`.
- Replace user-visible `DEEIX-Chat` with `DOUB-Chat`.
- Replace standalone user-visible `DEEIX` with `DOUB`.
- Keep image and icon file contents unchanged:
  - `frontend/public/logo.svg`
  - `frontend/public/logo-white.svg`
  - `frontend/public/logo-black.svg`
  - `frontend/public/logo-color.svg`
  - `frontend/app/favicon.ico`
  - `frontend/public/DEEIX-Chat.jpg`
  - `frontend/public/DEEIX-Chat-Image.png`
  - `frontend/public/DEEIX-Chat-Dark.png`
  - `frontend/public/DEEIX-Chat-Usage.png`
- Keep current UI styling and component structure unchanged except for text values.
- Update both English and Chinese frontend message files where visible brand text appears.
- Update backend defaults that can surface to users, including emails, 2FA issuer, app/build metadata, settings defaults, and API documentation title/description.
- Update visible brand channel labels and links to:
  - Website label/link: `about.doub.chat`
  - Contact email/link: `support@doub.chat`
  - Social label/link: `@doubingchat`
  - Repository label/link: `DOUB-Chat` / `https://github.com/kangzyz/Doub`
- Migrate technical identifiers from DEEIX/deeix naming to DOUB/doub naming.
- Update Go module and import paths to the new repository path once the canonical module path is confirmed.
- Update Docker/Compose names, image references, managed service container names, build output names, and documentation commands to DOUB naming.
- Update database/user/example credentials and backend defaults from `deeix_chat` / `deeix-chat` to DOUB equivalents.
- Update frontend localStorage/event/cookie-style namespaces from `deeix-chat:*` to DOUB equivalents, accepting that existing browser state may not migrate automatically unless a compatibility shim is added.

## Acceptance Criteria

- [x] No user-facing UI text still shows `DEEIX Chat`, `DEEIX-Chat`, or standalone `DEEIX`, except where explicitly out of scope.
- [x] Browser metadata displays `DOUB Chat`.
- [x] Login, share, onboarding, settings/about, sidebar fallback, notifications, and chat placeholder text use `DOUB Chat` / `DOUB`.
- [x] Backend-generated verification email and 2FA issuer use `DOUB Chat`.
- [x] Swagger/API documentation product title uses `DOUB Chat`.
- [x] About/contact/repository/social links use the provided DOUB channels.
- [x] Image/icon files are not modified.
- [x] Technical identifiers use the confirmed DOUB naming map.
- [x] Go imports and module path are consistent after migration.
- [x] Docker/Compose services, managed extraction service names, build outputs, database examples, env var examples, local storage/event namespaces, tracing/logger service names, and documentation commands use DOUB naming.
- [x] Frontend lint/build and backend tests pass or any inability to run them is documented.
- [x] A final grep audit identifies remaining `deeix` / `DEEIX` matches and classifies them as approved asset filenames/content, generated artifacts, or follow-up items.

## Out of Scope

- Redesigning or regenerating SVG/ICO/PNG/JPG assets.
- Editing binary/vector image contents directly.
- A full white-label architecture or runtime-configurable product branding system.

## Technical Approach

1. Build an explicit replacement map for product text and technical identifiers:
   - `DEEIX Chat` -> `DOUB Chat`
   - `DEEIX-Chat` -> `DOUB-Chat`
   - visible standalone `DEEIX` -> `DOUB`
   - tentative lowercase/hyphen technical ID: `deeix-chat` -> `doub-chat`
   - tentative lowercase/underscore technical ID: `deeix_chat` -> `doub_chat`
   - tentative env prefix: `DEEIX_CHAT_` -> `DOUB_CHAT_`
   - tentative Go module/import path: `github.com/DEEIX-AI/DEEIX-Chat/backend` -> `github.com/kangzyz/Doub/backend`
2. Update frontend visible surfaces:
   - metadata/layout
   - shared logo alt text
   - about/devtools/banner content
   - notifications
   - feature components with hardcoded product names
   - i18n JSON message files for both locales
3. Update backend visible surfaces:
   - config default app name
   - settings seed login title
   - build info product
   - verification email subjects/body/header alt text
   - 2FA issuer
   - OpenRouter attribution display title
   - Swagger comments and generated docs
4. Update technical identifiers:
   - frontend package name, storage/event namespaces, generated download filenames
   - backend Go module/import paths and generated docs references
   - Dockerfile binary path/name
   - compose project/service/container/network/volume/image names
   - managed extraction service host/container/image names
   - config defaults and example DSNs/passwords/default admin username/password
   - tracing/logger service names and temporary object/pdfrender/OCR prefixes
   - docs command examples and image names
5. Update documentation display references while keeping image contents unchanged.
6. Run validation:
   - frontend lint/build
   - backend tests
   - grep audit with remaining matches classified

## Implementation Plan

### Step 1: Confirm Scope

Confirm the canonical technical naming map before implementation.

### Step 2: Frontend Display Text And Technical Namespaces

Update visible strings in `frontend/app`, `frontend/features`, `frontend/shared`, and `frontend/i18n/messages`; update frontend package/storage/event/download namespaces.

### Step 3: Backend Generated Display Text

Update backend-generated visible defaults and regenerate API docs if the existing tooling is available.

### Step 4: Backend And Deployment Technical Identifiers

Update Go module/import path, Docker/Compose identifiers, managed service names, config defaults, tracing/logger names, temporary prefixes, and generated docs.

### Step 5: Docs

Update README/NOTICE/security/contribution display names and command examples.

### Step 6: Validation And Audit

Run checks and classify remaining `DEEIX`/`deeix` occurrences.

## Open Questions

- Resolved: use `doub-chat`, `doub_chat`, `DOUB_CHAT_`, `github.com/kangzyz/Doub/backend`, `ghcr.io/kangzyz/doub-chat`, `https://doub.chat`, `support@doub.chat`, and `@doubingchat`.
- Resolved: keep existing SVG/ICO/PNG/JPG file contents and existing screenshot filenames unchanged for later same-name asset replacement by the user.

## Execution Results

- Updated product display text, i18n messages, docs, backend defaults, Swagger metadata, technical namespaces, Go module/import paths, Docker/Compose names, env examples, local storage/event namespaces, and managed extraction service names.
- Left only README references to existing screenshot filenames under `frontend/public/DEEIX-Chat*.png|jpg`; these are approved asset filename references because image assets are out of scope.
- Validation passed:
  - `go test ./...`
  - `go vet ./...`
  - `go build ./cmd/server`
  - `go run github.com/swaggo/swag/cmd/swag@v1.16.4 init -g cmd/server/main.go -o docs --parseDependency --parseInternal`
  - `pnpm lint`
  - `pnpm build`
- `make swagger` could not run directly because `make` is not installed in the current Windows environment; the equivalent `swag init` command above was run successfully.

## Technical Notes

- The frontend is a Next.js App Router app under `frontend/`.
- Relevant Trellis frontend specs start at `.trellis/spec/frontend/index.md`.
- Cross-layer changes may touch both frontend and backend, so `.trellis/spec/guides/cross-layer-thinking-guide.md` should be consulted before implementation.
- Existing logo SVGs are path-based assets, not editable text nodes, and are intentionally excluded.
