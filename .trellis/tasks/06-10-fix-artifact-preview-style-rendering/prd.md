# Fix artifact preview style rendering

## Goal

Fix HTML Artifact preview so user-provided HTML that depends on runtime style assets, especially Tailwind CDN snippets, renders visually instead of falling back to mostly unstyled document flow.

## Requirements

- HTML Artifact preview must preserve and execute the user's full-document styling path when the code includes `<script src="https://cdn.tailwindcss.com">`, `<link rel="stylesheet" ...>`, `@import`, inline `<style>`, and normal HTML body classes.
- The preview must remain isolated from the parent application: no parent-page access, no forms, no popups, no storage access, and no same-origin privileges.
- The UI source/preview tabs, copy, download, artifact selection, and resizing behavior must remain unchanged.
- The downloaded HTML preview should match the in-app preview policy because it uses the same preview document builder.

## Acceptance Criteria

- [x] A Tailwind CDN HTML artifact like the provided Jinan weather example renders with Tailwind utility styles applied in preview.
- [x] Inline `<style>` blocks and stylesheet links in the user's `<head>` are preserved in the generated preview document.
- [x] The generated iframe CSP still blocks parent integration and high-risk browser capabilities while allowing style/script/font/image resources needed by visual HTML previews.
- [x] `cd frontend && pnpm lint` passes.

## Definition of Done

- Frontend lint passes.
- The change is limited to the Artifact preview path unless verification exposes a directly related issue.
- Trellis finish notes can clearly explain the security trade-off.

## Technical Approach

Update the Artifact preview document policy in `frontend/features/chat/model/chat-artifacts.ts` so full HTML previews can load declared external visual/runtime assets from HTTPS/CDN sources while keeping sandbox isolation in `frontend/features/chat/components/sections/chat-artifact.tsx`.

## Decision (ADR-lite)

**Context**: The current preview builder keeps user `<head>` and `<body>`, but its CSP only allows inline styles/scripts plus data/blob media. Tailwind CDN, Font Awesome CDN, Google Fonts, and stylesheet imports are blocked, so Tailwind-heavy HTML artifacts render as plain text/layout.

**Decision**: Keep iframe sandbox isolation and relax only the preview document CSP resource directives needed for visual HTML rendering.

**Consequences**: Preview fidelity improves for common AI-generated HTML, but external resources declared by the artifact can make network requests. Parent-page access remains blocked by iframe sandboxing and CSP.

## Out of Scope

- Building a local Tailwind compiler or adding a new dependency for in-browser CSS generation.
- Changing markdown inline semantic HTML rendering.
- Changing backend streaming, model prompts, or artifact extraction beyond what is required for preview rendering.

## Technical Notes

- User-provided example uses Tailwind CDN, Font Awesome CDN, Google Fonts `@import`, and many Tailwind utility classes.
- Current CSP lives in `frontend/features/chat/model/chat-artifacts.ts` as `ARTIFACT_CSP`.
- Current iframe sandbox lives in `frontend/features/chat/components/sections/chat-artifact.tsx` as `sandbox="allow-scripts"` and does not include `allow-same-origin`, forms, popups, modals, or storage flags.
