# Default HTML Visual Prompt

## Goal

Make semantic HTML visual replies the default chat behavior while preventing that
format contract from interfering with explicit HTML-page generation or opening
the right-side HTML preview/artifact panel unnecessarily.

## Requirements

- Default new chat appearance/options should enable the HTML visual prompt.
- Existing user preference loading should still respect an explicit saved user
  choice.
- Enabling semantic HTML visual replies must not automatically open the
  right-side HTML artifact preview because the assistant is returning raw
  semantic HTML for chat rendering.
- The system prompt must clearly state that if the user explicitly asks for a
  full HTML page, interactive demo, or HTML source artifact, the semantic `.reply`
  visual prompt should not override that request; the user's artifact/source
  request takes precedence.

## Acceptance Criteria

- [x] Fresh/default chat options send with HTML visual prompt enabled.
- [x] Saved preferences can still disable HTML visual prompt.
- [x] Normal semantic HTML replies are rendered in the chat body without opening
  the HTML preview panel.
- [x] Explicit user requests for full HTML pages/demos still produce HTML source
  as requested.
- [x] Frontend lint/type-check/build and relevant backend tests pass.

## Definition of Done

- Scope stays limited to chat option defaults, artifact-preview behavior, and
  backend prompt wording.
- Specs are updated if a behavior contract changes.
- Local frontend/backend services remain on their existing ports.
- Changes are committed before wrap-up.

## Out of Scope

- Removing artifact preview for all code blocks.
- Reworking the whole chat settings UI.
- Database migration for existing saved preferences.

## Technical Notes

- Need inspect chat option defaults, send payload construction, and artifact
  preview triggers.
- Backend prompt lives in
  `backend/internal/application/conversation/system_prompt.go`.
