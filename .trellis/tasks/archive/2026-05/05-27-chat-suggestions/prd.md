# brainstorm: chat suggestions

## Goal

Add a chat suggestion feature to DOUB, using open-webui's chat suggestion behavior as a reference, so users can quickly continue or start a conversation from suggested prompts/actions.

## What I already know

* The user wants DOUB to add a chat suggestion feature.
* The requested reference implementation is `open-webui/open-webui` on GitHub.
* This is requirements discovery only for now; implementation should wait until the MVP scope and technical approach are confirmed.
* DOUB's empty chat page currently renders greeting text plus the shared `ChatInput`, with no prompt suggestion surface.
* DOUB's send flow already creates a conversation automatically when sending from an empty chat.
* Open WebUI has two different features under the suggestion umbrella: initial prompt suggestions on empty/new chat, and generated follow-up suggestions after assistant replies.

## Assumptions (temporary)

* The feature belongs primarily in DOUB's chat UI and may require both frontend rendering and backend/API support depending on current architecture.
* "Chat suggestions" may include initial prompt suggestions, follow-up suggestions after assistant replies, or both.
* The MVP should follow DOUB's existing design system and state-management conventions rather than copying open-webui's UI directly.
* Follow-up suggestions require backend model task execution, message persistence, DTO/API changes, and frontend message rendering changes.

## Requirements

* Use open-webui's chat suggestion feature as product/behavior reference.
* Keep implementation consistent with DOUB's current chat flow and UI conventions.
* Preserve a data shape that can later support backend/admin-managed suggestions.
* Add static initial suggestions on the empty new-chat state.
* Show 4-6 built-in suggestion items in the new conversation empty state.
* Use a general workflow suggestion set for the static empty-chat suggestions.
* Add generated follow-up suggestions after assistant replies.
* Generate 3-5 follow-up suggestions after each assistant response, similar to Open WebUI's dynamic follow-up suggestions.
* Generate follow-up suggestions only for normal text chat assistant replies.
* Show generated follow-up suggestions only under the latest assistant message.
* Automatic follow-up generation is always enabled in this MVP.
* Clicking any suggestion sends it directly through the existing chat flow.
* Do not add a user-facing "insert suggestion into input" behavior in this MVP.
* If follow-up generation fails, times out, or returns invalid output, hide follow-up suggestions silently and keep the assistant response successful.

## Acceptance Criteria

* [ ] Users can see 4-6 built-in suggestions on the empty new-chat screen.
* [ ] Empty-chat static suggestions cover general workflows: writing/rewrite, summarization, code explanation, learning plan, creative ideation, and problem breakdown.
* [ ] Clicking an empty-chat suggestion sends that prompt immediately and creates/continues the conversation through the existing send flow.
* [ ] After an assistant reply completes, users can see 3-5 generated follow-up suggestions.
* [ ] Follow-up suggestions are generated only for text chat assistant responses, not image/media responses.
* [ ] Follow-up suggestions are visible only for the latest assistant message.
* [ ] Clicking a follow-up suggestion sends that prompt immediately as the next user message.
* [ ] Follow-up generation failure does not block or mark the assistant response as failed.
* [ ] Suggestions are localized for English and Chinese UI.
* [ ] The behavior is covered by focused tests or verified through the project's accepted quality gates.

## Definition of Done (team quality bar)

* Tests added/updated where appropriate.
* Lint / typecheck / CI-equivalent checks pass.
* Docs/notes updated if behavior changes.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* No implementation until requirements are confirmed.
* No wholesale UI clone of open-webui.
* User-facing "insert suggestion into input" mode.
* Admin-editable suggestion management, unless later selected as a separate follow-up.
* Backend/admin/runtime toggle for automatic follow-up generation.
* Displaying follow-up suggestions under older assistant messages.
* Follow-up suggestions for image generation or image editing responses.

## Technical Notes

* Task directory: `.trellis/tasks/05-27-chat-suggestions`
* Reference repository: https://github.com/open-webui/open-webui
* Open WebUI reference snapshot: `3660bc00fd807deced3400a63bfa6db47811a3bb`
* DOUB key files inspected:
  * `frontend/features/chat/components/app-chat-area.tsx`
  * `frontend/features/chat/components/sections/chat-empty.tsx`
  * `frontend/features/chat/components/sections/chat-input.tsx`
  * `frontend/features/chat/hooks/use-chat-runtime.ts`
  * `frontend/features/chat/hooks/use-chat-message-submit.ts`
  * `frontend/features/chat/hooks/use-chat-model-options.ts`
  * `frontend/i18n/messages/en-US/chat.json`
  * `frontend/i18n/messages/zh-CN/chat.json`
  * `frontend/features/admin/model/conversation-settings.ts`
  * `backend/internal/application/settings/seed.go`

## Research References

* [`research/open-webui-chat-suggestions.md`](research/open-webui-chat-suggestions.md) — Open WebUI separates initial prompt suggestions from generated follow-up suggestions.
* [`research/doub-chat-constraints.md`](research/doub-chat-constraints.md) — DOUB can support a low-risk empty-chat suggestion MVP in the existing chat page, while backend-managed or generated suggestions are larger.
* [`research/doub-follow-up-implementation.md`](research/doub-follow-up-implementation.md) — DOUB can reuse text-task routing for generated follow-ups, but needs message schema/DTO/UI support.

## Research Notes

### What Similar Tools Do

* Open WebUI uses prompt suggestion objects with separate display title/subtitle and sent content.
* Open WebUI lets users choose whether prompt suggestions insert into the composer or send immediately.
* Open WebUI generates follow-up suggestions from recent chat history as a separate background task and stores them on assistant messages.

### Constraints From DOUB

* The current chat composer sends from `draft`; a prompt-specific send API would be cleaner if suggestions should auto-send.
* There is no existing prompt suggestion storage in public model options or frontend chat config.
* Admin/runtime settings exist and can be extended, but that turns the feature into backend + admin UI work.
* Current message DTOs do not include persisted follow-up suggestions.
* Current stream events do not include follow-up updates; generating follow-ups inside the main response stream would delay completion unless the stream/client flow is changed.

### Feasible Approaches

**Approach A: Static Initial Suggestions**

* How it works: Add localized built-in suggestion items to the empty chat page. Clicking a suggestion inserts the prompt into the input, or sends it if selected by product decision.
* Pros: Smallest surface, no backend schema/API work, gives users immediate value, can be refactored later to use admin settings.
* Cons: Suggestions are not admin-editable and not model-specific in the first slice.

**Approach B: Admin-Managed Initial Suggestions**

* How it works: Add system setting JSON for default suggestions, expose it to chat users, and provide admin settings UI for editing.
* Pros: Closer to Open WebUI's configurable prompt suggestions; operators can tune prompts without deploys.
* Cons: Requires backend settings validation/API exposure plus admin UI, more testing, and migration/default behavior decisions.

**Approach C: Generated Follow-Up Suggestions** (Selected)

* How it works: After assistant replies, generate 3-5 follow-up prompts from recent history using a task model, stream/persist them, and render on the latest assistant message.
* Pros: Most dynamic and closest to Open WebUI's newer "follow-up suggestions" feature.
* Cons: Largest scope; requires backend LLM task orchestration, message schema changes, stream events, persistence, UI, and settings.

## Technical Approach

* Static empty-chat suggestions: add localized built-in suggestions to the empty chat state and send directly on click.
* Direct-send support: expose a prompt-specific send function from the chat runtime instead of relying on setting `draft` before sending.
* Follow-up persistence: add a message-level follow-up suggestion field, likely JSON array storage exposed as `followUps`.
* Follow-up generation: reuse internal text-task model routing and JSON parsing conventions from conversation title/label generation.
* Follow-up failure behavior: fail closed and hide the suggestion UI; do not show a toast or fail the answer.

## Implementation Plan

* PR1 / backend data contract: add persisted message follow-up suggestions, DTO fields, repository update method, and focused tests for serialization/hydration.
* PR2 / backend generation: add follow-up generation service using text-task routing, JSON parsing/sanitization, and text-chat-only trigger after successful assistant messages.
* PR3 / frontend behavior: add static empty-chat suggestion UI, prompt-specific direct-send path, follow-up rendering under the latest assistant message, and localized copy.
* PR4 / verification: cover direct-send interactions and follow-up visibility with focused frontend/backend tests or project quality gates.

## Decisions

* Include Approach A static initial suggestions in MVP.
* Include Approach C generated follow-up suggestions in MVP.
* Suggestion click behavior is direct-send only.
* Follow-up suggestions are displayed only under the latest assistant message.
* Static empty-chat suggestions use the general workflow set.
* Automatic follow-up generation has no admin/runtime kill switch in MVP.
* Follow-up suggestions apply only to normal text chat replies.
* Do not implement insert-into-input behavior for this task.

## Static Suggestion Set

The MVP should ship 6 localized built-in suggestions:

1. Writing/rewrite: improve a draft for clarity, tone, and structure.
2. Summarization: summarize long content into key points and next actions.
3. Code explanation: explain a code snippet or error in practical terms.
4. Learning plan: build a short learning plan for a topic.
5. Creative ideation: generate several options or ideas for a project.
6. Problem breakdown: break a vague problem into concrete steps.
