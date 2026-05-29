# brainstorm: compact chat suggestions

## Goal

Refine the DOUB chat suggestion feature so empty-chat suggestions are compact, sit directly above the composer, and do not visually dominate the empty state, while preserving the previously confirmed dynamic follow-up suggestion behavior.

## Baseline

This task revises the archived chat suggestions PRD:

* `.trellis/tasks/archive/2026-05/05-27-chat-suggestions/prd.md`

Confirmed baseline requirements retained:

* Reference open-webui's chat suggestion behavior.
* Add static initial suggestions on the new conversation empty state.
* Add generated follow-up suggestions after normal text chat assistant replies.
* Show follow-up suggestions only under the latest assistant message.
* Clicking any suggestion sends it directly through the existing chat flow.
* Do not implement an insert-into-input mode.
* Follow-up generation is always enabled in MVP and fails closed.
* Do not include image/media reply follow-up suggestions.

## Requirements

* Empty-chat suggestions must be visually small and secondary to the composer.
* Empty-chat suggestions should render directly below the input box as lightweight role links, not as a large block higher in the empty state.
* Reduce the static empty-chat suggestion count from 6 to 3 for the MVP.
* Keep suggestion labels short and role-oriented enough to fit compact text links on desktop and mobile.
* Ship a larger built-in role prompt pool and randomly show 3 prompts on the empty-chat screen.
* Role prompts should state who the assistant is, what it can help with, and how it should work; they should initialize the role for later user requests, not answer the role prompt with a full plan.
* Preserve direct-send behavior when clicking a static empty-chat suggestion.
* Preserve generated follow-up behavior from the baseline PRD.

## Static Suggestion Set

The MVP should show 3 localized built-in role prompts at a time, randomly selected from a larger built-in pool:

1. Product advisor.
2. Technical architect.
3. Code mentor.
4. AI workflow advisor.
5. Writing editor.
6. Decision consultant.
7. Data analyst.
8. Project operator.
9. Learning coach.
10. Review coach.
11. Growth operator.
12. Interview coach.

The visible copy should render as three lightweight rows below the composer. Each row shows an underlined role name and a short capability description. The sent prompt should be a complete role-playing prompt that establishes role, capabilities, working style, and expected output for future turns. The assistant should reply only with a short readiness acknowledgement after the role prompt is sent, then wait for the user's real request.

## Acceptance Criteria

* [x] Empty-chat static suggestions appear immediately below the composer.
* [x] Empty-chat static suggestions are three compact underlined role rows with short descriptions, not large cards or boxed chips.
* [x] Empty-chat static suggestions display 3 items.
* [x] Empty-chat static suggestions are randomly selected from a larger built-in pool.
* [x] Empty-chat static suggestion copy is role-oriented and capability-focused.
* [x] Static suggestion prompts establish role-play instructions rather than only asking the user for more information.
* [x] Static suggestion prompts instruct the assistant to acknowledge readiness only and wait for the next user request.
* [x] Suggestion text is localized for English and Chinese UI.
* [x] Clicking a static suggestion sends that prompt immediately.
* [x] Follow-up suggestions still appear only below the latest text assistant response.
* [x] Follow-up suggestion clicks still send immediately as the next user message.
* [x] The behavior is covered by focused tests or verified through the project's accepted quality gates.

## Definition of Done

* Tests added/updated where appropriate.
* Lint / typecheck / CI-equivalent checks pass.
* Docs/notes updated if behavior changes.

## Verification

* `pnpm lint` in `frontend`
* `pnpm build` in `frontend`
* `go test ./internal/application/conversation` in `backend`

## Out of Scope

* Large empty-state suggestion cards.
* Six-item empty-chat suggestion grid.
* User-facing insert-into-input mode.
* Admin-editable suggestion management.
* Backend/admin/runtime toggle for automatic follow-up generation.
* Displaying follow-up suggestions under older assistant messages.
* Follow-up suggestions for image generation or image editing responses.

## Technical Notes

* Likely frontend files:
  * `frontend/features/chat/components/app-chat-area.tsx`
  * `frontend/features/chat/components/sections/chat-empty.tsx`
  * `frontend/features/chat/components/sections/chat-input.tsx`
  * `frontend/i18n/messages/en-US/chat.json`
  * `frontend/i18n/messages/zh-CN/chat.json`
* Static empty-chat suggestion UI should be placed below the composer in the same max-width column so it visually belongs to the input surface.
* Use compact, stable dimensions so suggestions do not shift the composer layout.
