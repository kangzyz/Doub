# Fix Chat Answer Citation Links

## Goal

Assistant answers that include upstream citation markers such as `[1]` or `[2]`
should render those markers as clickable links when the upstream response also
provides citation URLs.

## What I Already Know

* The frontend renders assistant content through Streamdown Markdown rendering.
* Normal Markdown links are already routed through `MarkdownLink`, including
  link safety handling.
* Backend LLM adapters already parse upstream citation URLs into
  `llm.GenerateOutput.Citations`.
* Server-side web/search tool citations are currently stored in tool trace rows,
  but the final assistant message content remains plain text with bare markers.

## Assumptions

* The upstream citation order matches numeric markers in the generated answer:
  `[1]` maps to `Citations[0]`, `[2]` maps to `Citations[1]`, and so on.
* This task should not introduce a new API response field unless the existing
  Markdown path cannot solve the issue.

## Requirements

* Preserve the visible assistant answer text.
* When final assistant text contains numeric bracket markers and upstream
  citation URLs are available, rewrite markers to display-only citation links
  such as `[[1]][citation-1]` and append hidden Markdown reference definitions.
* When upstream directly returns inline numeric citation links such as
  `[1](https://example.com)`, remove the URL from the visible body by converting
  it to the same display-only citation reference format.
* Preserve adjacent citation groups such as `[1][2]` as separate clickable
  links without displaying the URL.
* Do not duplicate reference definitions if the model already returned them.
* Ignore empty, invalid, or unreferenced citation URLs.
* Keep streaming deltas unchanged; final persisted/completed message content may
  include the hidden Markdown reference definitions.

## Acceptance Criteria

* [x] An answer containing `... [1][2]` plus two upstream URLs persists as
      Markdown that renders both markers as links.
* [x] An answer with existing `[1]: https://...` definitions is not duplicated.
* [x] Answers without citation markers are unchanged.
* [x] Existing server-side tool trace citation capture remains intact.

## Definition of Done

* Focused backend tests cover citation reference injection.
* Relevant Go tests pass for the touched package.
* No unrelated dirty files are staged or reverted.

## Technical Approach

Add a small application-layer helper that maps `llm.GenerateOutput.Citations` to
Markdown reference definitions and applies it immediately after synchronizing the
final upstream output text. This keeps the frontend contract stable and reuses
the existing Markdown renderer/link safety implementation.

## Out of Scope

* Adding a new frontend citation UI.
* Changing stream event DTOs to send citations separately.
* Rewriting historical messages that were saved before this fix.

## Technical Notes

* Likely implementation files:
  * `backend/internal/application/conversation/service_tool_loop.go`
  * `backend/internal/application/conversation/service_message_send.go`
  * focused tests under `backend/internal/application/conversation/`
* Relevant frontend rendering files:
  * `frontend/features/chat/components/markdown/streamdown-render.tsx`
  * `frontend/features/chat/components/markdown/streamdown-components.tsx`
